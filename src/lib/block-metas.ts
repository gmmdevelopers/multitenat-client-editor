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
 * Las dos listas de nombres viven en `block-names.ts`, que **no importa nada**.
 *
 * Se re-exportan aqui para que el editor tenga un solo import, pero el camino
 * publico debe usar `block-names` directamente: este archivo importa los 130
 * metadatos.
 */
export { HEADER_BLOCKS, isUtilityBlock } from "./block-names";

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
