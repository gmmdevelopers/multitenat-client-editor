"use client";

import {
  ALL_BLOCKS_MAP,
  isUtilityBlock,
} from "@/lib/editor-registry";
import type { BlockInstance } from "@/types/editor-state";

interface UtilityLayerProps {
  blocks: BlockInstance[];
  /**
   * `true` dentro del editor: ancla las utilidades al lienzo en vez de a la
   * ventana, para que no floten sobre los paneles del editor.
   */
  contained?: boolean;
}

/**
 * Pinta las utilidades del sitio.
 *
 * Vive separado del flujo del canvas porque las utilidades no son secciones: el
 * boton de WhatsApp se ancla a la ventana (`position: fixed`), no al documento
 * de la pagina. El listado de organismos del canvas las ignora, asi que sin
 * esta capa se guardarian pero nunca se verian.
 *
 * El `pointer-events` es deliberado: la capa no debe interceptar clics del
 * editor en general, pero el boton en si SI tiene que ser clicable, porque es
 * el resultado que vera el visitante y conviene poder comprobarlo desde el
 * editor sin publicar.
 */
export function UtilityLayer({ blocks, contained = false }: UtilityLayerProps) {
  const utilities = blocks.filter((block) => isUtilityBlock(block.metaName));

  if (utilities.length === 0) return null;

  return (
    <div
      aria-hidden={false}
      data-utility-layer={contained ? "contained" : "fixed"}
      style={{ pointerEvents: "none" }}
    >
      {utilities.map((block) => {
        const entry = ALL_BLOCKS_MAP.get(block.metaName);
        if (!entry) return null;

        const Component = entry.component;

        return (
          <div key={block.id} style={{ pointerEvents: "auto" }}>
            {/*
              `contained` en el editor y `fixed` en la web.

              En el editor la utilidad NO puede anclarse a la ventana: se
              pintaria encima de los paneles (propiedades incluido) y
              confundiria a quien esta disenando, que ve el boton como parte de
              su web cuando en realidad es de la interfaz.
            */}
            <Component
              {...block.props}
              anchor={contained ? "contained" : "fixed"}
            />
          </div>
        );
      })}
    </div>
  );
}
