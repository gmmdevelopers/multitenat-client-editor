/**
 * Listas de nombres que el CLIENTE necesita, sin importar **nada** del design system.
 *
 * ## Por que este archivo existe (8.9, la ultima capa)
 *
 * `PageRenderer` y `UtilityLayer` solo necesitaban dos respuestas:
 * "¿es una utilidad?" y "¿es una cabecera?". Las pedian a `block-metas.ts`, que
 * importa los **130 metadatos** del design system para poder derivarlas.
 *
 * Y esos metadatos pesan: los 50 de plantillas de pagina suman **252 KB de
 * fuente**, porque cada uno lleva un `defaultValue` con la pagina entera (hero,
 * servicios, testimonios, precios, FAQ...).
 *
 * Resultado medido: **1.059 KB** en un chunk del visitante, por dos `Set` de
 * cinco y tres nombres.
 *
 * ## La regla de oro de este archivo
 *
 * > **Cero imports.** Ni del design system, ni de la app. Es el suelo del camino
 * > publico: si esto pesa, pesa todo lo demas.
 *
 * ## Y por que las listas van escritas a mano
 *
 * Porque derivarlas exige leer los metadatos, que es justo lo que se acaba de
 * sacar del cliente.
 *
 * El riesgo (que una lista se desincronice) se cubre con **`block-metas.test`**
 * —no en runtime, en el build—: compara estas listas contra los metadatos
 * reales y falla si alguien añade una utilidad al design system sin ponerla
 * aqui. Es una prueba que se corre una vez y protege para siempre.
 */

/**
 * Utilidades: componentes que aportan FUNCIONALIDAD, no contenido.
 *
 * Un boton flotante de WhatsApp no ocupa un lugar en el flujo de la pagina como
 * un hero o una seccion de servicios: se configura (numero, posicion) y actua
 * sobre la pagina entera. Va en su propia capa (`UtilityLayer`).
 *
 * ## Solo `WhatsAppButton` (verificado 2026-10-23)
 *
 * Es la unica entrada del design system con `COMPONENT_CATEGORY.utilities`.
 * Los formularios (`ContactForm`, `AppointmentForm`) son **moleculas** y si van
 * en el flujo: se pinta donde el cliente los puso.
 *
 * ## Coincide con el design system, y se comprueba
 *
 * `block-names.test.ts` compara esta lista contra los metadatos reales. Si
 * alguien añade una utilidad al design system y no la pone aqui, la prueba falla
 * en el build en vez de que el bloque desaparezca de la web sin ningun error.
 */
const UTILITY_NAMES = new Set<string>(["WhatsAppButton"]);

/** `true` si el bloque es una utilidad y no contenido de la pagina. */
export function isUtilityBlock(metaName: string): boolean {
  return UTILITY_NAMES.has(metaName);
}

/**
 * Cabeceras del design system, que muestran el logo del sitio.
 *
 * Vive aqui y no en cada renderizador para que el editor y la web publica usen
 * LA MISMA lista: son dos sitios distintos que deben mostrar el logo igual, y
 * dos listas copiadas acabarian divergiendo (una con la cabecera nueva y la
 * otra sin ella) sin que nada lo avisara.
 *
 * Se identifican por nombre porque las props del bloque vienen del editor y el
 * cliente no elige ahi su logo: es un dato del SITIO, y se inyecta al renderizar.
 */
export const HEADER_BLOCKS = new Set<string>([
  "MedicalHeader",
  "DentistHeader",
  "SkincareHeader",
  "InteractiveSiteHeader",
  "SiteHeader",
]);

/** Para la prueba de cobertura: las utilidades declaradas aqui, en orden. */
export const DECLARED_UTILITY_NAMES: readonly string[] = Array.from(
  UTILITY_NAMES,
);
