/**
 * Lo que el CLIENTE necesita saber de los bloques, **sin código de componentes**.
 *
 * ## Por que este archivo existe (punto 8.9, el que faltaba)
 *
 * La web publica solo necesitaba dos cosas de `editor-registry`:
 *
 *   - **que nombres son validos** (para no pintar un bloque inexistente),
 *   - **cuales son utilidades** (para sacarlas del flujo).
 *
 * Para eso importaba `editor-registry`, y ese modulo importa
 * `getRegistryComponents()` del design system: **130 referencias a componentes**
 * con sus **861 metadatos**, incluidas 50 plantillas de pagina entera
 * (`MedicalHomePage`, `SkincareServicesPage`...).
 *
 * El bundler no puede descartar nada de eso, porque `componentRegistry` es un
 * array que se construye al importar. Resultado: **1205 KB de JS** en la web del
 * visitante, y limpiar los imports de la app no movia el numero — se probo tres
 * veces.
 *
 * Aqui solo hay **datos**: nombres en un `Set` y una funcion que devuelve
 * objetos planos. Nada de esto arrastra un componente.
 *
 * ## La regla
 *
 * > Si este archivo importara algo del design system que traiga componentes,
 * > volveriamos al principio. Solo `BLOCK_METAS_BY_NAME`, que son datos.
 *
 * Los valores por defecto se calculan **en el servidor** y viajan como props
 * (`resolveDefaultProps` en `lib/page-components.ts`).
 */

import { BLOCK_METAS_BY_NAME } from "@multitenant/design-system/block-metas";

/**
 * Utilidades: componentes que aportan FUNCIONALIDAD, no contenido.
 *
 * Un boton flotante de WhatsApp o un formulario de contacto no ocupan un lugar
 * en el flujo de la pagina como un hero o una seccion de servicios: se
 * configuran (numero, campos, posicion) y actuan sobre la pagina entera.
 *
 * Se derivan del `category` que ya declara cada meta, **no** de una lista a
 * mano: una lista copiada se desincroniza el dia que alguien añade una utilidad,
 * y el sintoma seria que el bloque deja de pintarse sin ningun error.
 *
 * Y se deriva de `BLOCK_METAS_BY_NAME`, que son **datos**: derivarlo de
 * `componentRegistry` volveria a arrastrar los 130 componentes.
 */
function buildUtilityNames(): Set<string> {
  return new Set(
    Object.values(BLOCK_METAS_BY_NAME)
      .filter((meta) => meta.category === "utilities")
      .map((meta) => meta.name),
  );
}

const UTILITY_NAMES = buildUtilityNames();

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
export const HEADER_BLOCKS = new Set([
  "MedicalHeader",
  "DentistHeader",
  "SkincareHeader",
  "InteractiveSiteHeader",
  "SiteHeader",
]);

/**
 * `true` si el design system conoce ese bloque.
 *
 * Se comprueba contra `BLOCK_METAS_BY_NAME`, que son **solo los metadatos**.
 * Antes se comprobaba contra el mapa de componentes, que traia lo mismo mas el
 * codigo de los 130.
 */
export function isKnownBlock(metaName: string): boolean {
  return Boolean(BLOCK_METAS_BY_NAME[metaName]);
}

/**
 * Los props por defecto de un bloque, desde sus metadatos.
 *
 * Devuelve un objeto **plano**: no referencia ningun componente, asi que puede
 * viajar del servidor al cliente sin arrastrar el registro.
 */
export function getDefaultPropsForBlock(
  metaName: string,
): Record<string, unknown> {
  const meta = BLOCK_METAS_BY_NAME[metaName];
  if (!meta) return {};

  const props: Record<string, unknown> = {};

  const collect = (
    fields: readonly { name: string; defaultValue?: unknown }[] | undefined,
  ) => {
    for (const field of fields ?? []) {
      if (field.defaultValue !== undefined) {
        props[field.name] = field.defaultValue;
      }
    }
  };

  // Un meta puede declarar sus campos en `fields` o agrupados en `groups`.
  collect(meta.fields);
  for (const group of meta.groups ?? []) {
    collect(group.fields);
  }

  return props;
}
