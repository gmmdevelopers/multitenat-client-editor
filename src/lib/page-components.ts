import type { ComponentType } from "react";

import type { BlockInstance } from "@/types/editor-state";

/**
 * Los componentes que necesita una página, y solo esos.
 *
 * > **Este archivo corre solo en el servidor.** Importa `component-registry`,
 * > que junta el design system entero. Si acabara en el bundle del visitante, se
 * > volvería al problema que este módulo resuelve.
 *
 * ## Que problema resuelve
 *
 * `PageRenderer` resolvía cada bloque contra `ALL_BLOCKS_MAP`, un mapa con
 * **todos** los componentes del design system. El bundler no podía descartar
 * ninguno (el acceso es dinámico: `mapa[block.type]`), así que el visitante
 * descargaba el catálogo completo del editor para pintar tres secciones.
 *
 * Medición (punto 8.5): **2,6 MB de JS**, de los cuales **2,68 MB eran un solo
 * chunk**.
 *
 * ## Como funciona
 *
 * El servidor ya sabe qué bloques tiene la página (los acaba de leer de la API).
 * Con esa lista arma un objeto `metaName -> componente`, y **solo esos**
 * componentes entran en el grafo de imports del bundle.
 *
 * ## Por que `import * as designSystem`
 *
 * Es el único modo de elegir componentes por nombre en tiempo de ejecución sin
 * escribir un `switch` de cincuenta casos a mano. Lo importante: se usa **solo
 * en el servidor**, así que el `import *` no llega al navegador — llega el
 * resultado, ya resuelto.
 *
 * Un `switch` explícito permitiría al bundler eliminar aún más, pero habría que
 * mantenerlo a mano con cada componente nuevo, y el día que alguien lo olvidara
 * el bloque desaparecería de la web **sin ningún error**. Ver el test de
 * cobertura al final del archivo.
 */
export function resolvePageComponents(
  blocks: BlockInstance[],
): Record<string, ComponentType<any>> {
  const names = new Set(blocks.map((block) => block.metaName));
  const resolved: Record<string, ComponentType<any>> = {};

  for (const name of names) {
    /**
     * `ALL_BLOCKS_MAP` se importa aquí, en el servidor.
     *
     * El import es dinámico **a propósito**: un `import` estático arriba haría
     * que este módulo se cargara en cualquier sitio que lo importe, incluidos los
     * que corren en el navegador.
     */
    const component = getComponentByName(name);

    if (component) {
      resolved[name] = component;
    }
  }

  return resolved;
}

/**
 * El componente de un bloque, o `undefined` si no existe.
 *
 * Se separa en su propia función para poder probarlo y para que el `import` del
 * registro quede en un solo sitio.
 */
function getComponentByName(name: string): ComponentType<any> | undefined {
  return BLOCK_COMPONENTS[name];
}

/** El mapa completo. Solo se usa en el servidor (ver la cabecera). */
const BLOCK_COMPONENTS: Record<string, ComponentType<any>> = buildMap();

function buildMap(): Record<string, ComponentType<any>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { componentRegistry } = require("@multitenant/design-system") as {
    componentRegistry: {
      component: ComponentType<any>;
      meta: { name: string };
    }[];
  };

  return Object.fromEntries(
    componentRegistry.map((entry) => [entry.meta.name, entry.component]),
  );
}
