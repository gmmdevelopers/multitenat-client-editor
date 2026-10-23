"use client";

import {
  HEADER_BLOCKS,
  isUtilityBlock,
} from "@/lib/block-names";
import { CONNECTED_ORGANISMS } from "@/components/editor/connected-organisms";
import { UtilityLayer } from "@/components/editor/UtilityLayer";
import { BlockInstance } from "@/types/editor-state";
import { transformImagesInProps } from "@/lib/image-transform";
import { sendContactMessage } from "@/lib/api/contact";
import { TurnstileWidget } from "@/components/captcha/TurnstileWidget";

interface PageRendererProps {
  blocks: BlockInstance[];
  /**
   * Si los formularios se pueden rellenar y enviar.
   *
   * `true` en la web publicada y en la vista previa real. El canvas del editor
   * los deja en modo diseno: ahi escribir no envia nada y hace creer que el
   * formulario funciona.
   */
  interactive?: boolean;
  /**
   * Ruta de la pagina, para el aviso por correo.
   *
   * Es un dato del SITIO (que pagina contiene el formulario), no del bloque:
   * por eso llega por prop y no se guarda en los props del organismo. Asi, mover
   * el formulario de pagina no obliga a reconfigurarlo.
   */
  pagePath?: string;
  /**
   * URL del logo del sitio (el icono de Configuracion -> Banner e icono).
   *
   * Se inyecta en los CABECERAS, que son bloques pero no saben del sitio: sus
   * props vienen del editor, y el cliente no elige ahi su logo. Sin esto, el
   * logo subido no aparece en la web y parece que la subida no sirvio.
   */
  logoUrl?: string | null;
  /**
   * Los componentes a pintar, resueltos por `metaName` **en el servidor**.
   *
   * ## Por que llegan por prop y no se buscan aqui
   *
   * Antes se resolvian contra `ALL_BLOCKS_MAP`, que importaba el
   * `componentRegistry` completo del design system: **130 componentes, 50 de
   * ellos plantillas de pagina entera** (`MedicalHomePage`, `SkincareServicesPage`
   *...). Como el acceso es dinamico (`mapa[block.metaName]`), el bundler no
   * podia descartar ninguno y **el visitante descargaba todo el catalogo del
   * editor** para pintar tres secciones.
   *
   * Medido (2026-10-23): **1822 KB de JS** en la web publica, con **1196 KB en un
   * solo chunk**.
   *
   * La solucion: el servidor ya sabe que bloques tiene la pagina (los acaba de
   * leer de la API), asi que arma con ellos un objeto `metaName -> componente` y
   * lo pasa aqui. Solo esos componentes entran en el grafo del navegador.
   */
  components: Record<string, import("react").ComponentType<any>>;
  /**
   * Los props por defecto de cada bloque, tambien resueltos en el servidor.
   *
   * Traerlos aqui obligaria a importar `editor-registry` en el cliente, que es
   * justo lo que se acaba de sacar del bundle.
   */
  defaultProps?: Record<string, Record<string, unknown>>;
}

/**
 * Bloques que, directa o indirectamente, contienen un formulario de contacto.
 *
 * Incluye tanto las MOLECULAS que son el formulario (`ContactForm`,
 * `AppointmentForm`) como los ORGANISMOS que lo llevan dentro
 * (`AppointmentSection`). Olvidar los segundos fue justo el fallo: la seccion se
 * pintaba, pero como a ella nadie le pasaba `interactive`, su formulario interno
 * se quedaba en modo diseno y los campos no se podian rellenar.
 */
const CONTACT_FORMS = new Set([
  "ContactForm",
  "AppointmentForm",
  "AppointmentSection",
]);

/**
 * Renderiza una pagina completa a partir de sus bloques, sin los adornos del
 * editor (drag handles, anillos de seleccion, botones flotantes).
 *
 * Es el mismo mecanismo que usa el Canvas: resolver cada bloque contra el
 * registry del design system y pasarle sus props.
 */
export function PageRenderer({
  blocks,
  interactive = false,
  pagePath,
  logoUrl,
  components,
  defaultProps = {},
}: PageRendererProps) {
  // Se excluyen las utilidades del FLUJO: no son secciones. Se pintan aparte,
  // en `UtilityLayer`, porque un boton flotante no ocupa un lugar en la pagina.
  //
  // Se comprueba contra el mapa que llego por props, no contra el registry: si
  // un bloque no tiene componente, pintarlo daria un error de React en vez de
  // omitirse. La lista de nombres validos la sigue decidiendo el servidor.
  const visibleBlocks = (blocks ?? []).filter(
    (block) =>
      Boolean(components[block.metaName]) && !isUtilityBlock(block.metaName),
  );

  const hasUtilities = (blocks ?? []).some((block) =>
    isUtilityBlock(block.metaName),
  );

  if (visibleBlocks.length === 0 && !hasUtilities) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ backgroundColor: "var(--site-background)" }}
      >
        <p className="text-sm" style={{ color: "var(--site-muted)" }}>
          Esta página todavía no tiene secciones.
        </p>
      </div>
    );
  }

  return (
    // El fondo sale de la paleta del sitio (`--site-background`), no de un
    // `bg-white` fijo: con un tema oscuro, un fondo blanco hardcodeado dejaria
    // bandas blancas entre las secciones que no pintan su propio fondo.
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--site-background)" }}
    >
      {visibleBlocks.map((block) => {
        const entry = components[block.metaName];
        if (!entry) return null;

        // La agenda (y cualquier organismo con logica de cliente) necesita su
        // version conectada tambien en la web publica, no solo en el editor.
        const Component = CONNECTED_ORGANISMS[block.metaName] ?? entry;

        // Los defaults del meta rellenan lo que falte. Sin esto, una pagina
        // cuyos bloques lleguen sin props (migracion, edicion por API) se
        // renderiza en blanco en vez de mostrar su contenido por defecto.
        //
        // Vienen resueltos del servidor, junto con los componentes: pedirlos
        // aqui obligaria a importar el registry en el navegador.
        const props = {
          ...(defaultProps[block.metaName] ?? {}),
          ...(block.props ?? {}),
        };

        // Los formularios necesitan algo mas que props estaticas: hay que
        // habilitarlos y darles a donde enviar. Sin esto, los campos quedan en
        // `readOnly` y el boton no hace nada, que era justo el sintoma: se veia
        // el formulario pero no se podia escribir ni enviar.
        const isForm = CONTACT_FORMS.has(block.metaName);

        const formProps = isForm
          ? {
              interactive,
              // El widget de captcha se inyecta como slot: el design system no
              // puede importarlo (vive en esta app) y asi sigue siendo agnostico.
              //
              // Solo en la web real: en el editor el captcha no tiene sentido,
              // porque no se envia nada.
              captchaSlot: interactive
                ? (onToken: (token: string) => void) => (
                    <TurnstileWidget onToken={onToken} />
                  )
                : undefined,
              onSubmit: async (payload: {
                fields: Array<{ label: string; value: string }>;
                email?: string;
                captchaToken?: string;
              }) => {
                await sendContactMessage({
                  fields: payload.fields,
                  email: payload.email,
                  captchaToken: payload.captchaToken,
                  pagePath,
                });
              },
            }
          : {};

        const transformedProps = transformImagesInProps(props);

        // El logo va DESPUES de transformar: lo inyectamos nosotros, no viene de
        // los props del editor, y no debe pasar por la sustitucion de URLs de
        // los bloques (esa resuelve imagenes guardadas en el bloque).
        const brandProps = HEADER_BLOCKS.has(block.metaName)
          ? { logoUrl: logoUrl ?? undefined }
          : {};

        return (
          <Component
            key={block.id}
            {...transformedProps}
            {...formProps}
            {...brandProps}
          />
        );
      })}

      {/*
        Utilidades (boton de WhatsApp...).

        Se montan aqui, dentro del renderizador compartido, para que aparezcan
        en los TRES sitios a la vez: el canvas del editor, la vista previa y la
        web publicada. Antes solo las pintaba el canvas, asi que el cliente
        configuraba el boton, lo veia en el editor y no en su pagina.
      */}
      {hasUtilities ? (
        <UtilityLayer blocks={blocks} components={components} />
      ) : null}
    </div>
  );
}
