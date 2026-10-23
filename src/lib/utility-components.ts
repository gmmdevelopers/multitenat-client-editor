"use client";

import { BLOCK_METAS_BY_NAME } from "@multitenant/design-system/block-metas";

/**
 * Lo que la web publica necesita saber de las **utilidades**, sin sus componentes.
 *
 * ## La cadena de intentos fallidos (para no repetirlos)
 *
 * | Intento | Por que no funciono |
 * |---|---|
 * | Filtrar `ALL_BLOCKS_MAP` en runtime | Filtrar no ahorra bytes: el bundler incluye todo para poder filtrar |
 * | Importar `UTILITIES_REGISTRY` | Ese modulo llama a `getRegistryComponents()`, que arma el registro completo |
 * | `sideEffects: false` en el design system | `componentRegistry` **es** un efecto: se calcula al importar |
 *
 * Resultado en los tres casos: **1205 KB** de JS en la web del visitante.
 *
 * ## La forma definitiva
 *
 * Los componentes llegan **por props**, resueltos en el SERVIDOR por
 * `resolvePageComponents` (`lib/page-components.ts`). Este modulo se queda con lo
 * unico que no pesa: los metadatos.
 *
 * > **No importar `editor-registry` ni `ALL_BLOCKS_MAP` aqui.** Si se hace, el
 * > visitante vuelve a descargar el catalogo del editor. Ver `MEDICION-BUNDLE.md`.
 */

/**
 * Metadatos de una utilidad: nombre visible, campos e icono.
 *
 * `BLOCK_METAS_BY_NAME` son **solo datos**: el design system los expone aparte
 * de los componentes precisamente para esto.
 */
export function utilityMeta(name: string) {
  return BLOCK_METAS_BY_NAME[name];
}
