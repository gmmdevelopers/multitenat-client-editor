"use client";

import type { ComponentType } from "react";

import { BLOCK_METAS_BY_NAME } from "@multitenant/design-system";

import { ALL_BLOCKS_MAP, UTILITY_NAMES } from "@/lib/editor-registry";

/**
 * Los componentes de las **utilidades**, y solo esos.
 *
 * ## Por que no `ALL_BLOCKS_MAP`
 *
 * `UtilityLayer` es cliente y pintaba las utilidades resolviéndolas contra
 * `ALL_BLOCKS_MAP`, el mapa con **todos** los componentes. Con eso, el navigador
 * del visitante acababa descargando el catálogo entero del design system.
 *
 * Medido (punto 8.5): **2,6 MB de JS**, casi todo un solo chunk. Este import era
 * el último que quedaba tras convertir `PageRenderer` en componente de servidor.
 *
 * ## Que se gana
 *
 * Las utilidades son dos o tres componentes (botón de WhatsApp, formulario de
 * contacto). Acotar el mapa a esos deja fuera todo lo demás.
 *
 * ## Por que se filtra al cargar el módulo
 *
 * Es una sola pasada sobre el mapa completo, que ya está en memoria por el
 * import. No hay coste apreciable, y así la resolución en el render es un acceso
 * directo.
 */
export const UTILITY_COMPONENTS: Record<
  string,
  ComponentType<any>
> = Object.fromEntries(
  Array.from(UTILITY_NAMES)
    .map((name) => {
      const component = ALL_BLOCKS_MAP.get(name)?.component;
      return component ? [name, component] : null;
    })
    .filter((entry): entry is [string, ComponentType<any>] => entry !== null),
);

/**
 * Metadatos de las utilidades, para sus props por defecto.
 *
 * Se usan los del design system, que ya vienen por nombre y no arrastran
 * componentes.
 */
export function utilityMeta(name: string) {
  return BLOCK_METAS_BY_NAME[name];
}
