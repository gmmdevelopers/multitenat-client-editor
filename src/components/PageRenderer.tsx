"use client";

import {
  ORGANISMS_MAP,
  getDefaultPropsForOrganism,
} from "@/lib/editor-registry";
import { CONNECTED_ORGANISMS } from "@/components/editor/connected-organisms";
import { BlockInstance } from "@/types/editor-state";
import { transformImagesInProps } from "@/lib/image-transform";

interface PageRendererProps {
  blocks: BlockInstance[];
}

/**
 * Renderiza una pagina completa a partir de sus bloques, sin los adornos del
 * editor (drag handles, anillos de seleccion, botones flotantes).
 *
 * Es el mismo mecanismo que usa el Canvas: resolver cada bloque contra el
 * registry del design system y pasarle sus props.
 */
export function PageRenderer({ blocks }: PageRendererProps) {
  const visibleBlocks = (blocks ?? []).filter((block) =>
    ORGANISMS_MAP.has(block.metaName),
  );

  if (visibleBlocks.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <p className="text-sm text-stone-500">
          Esta página todavía no tiene secciones.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {visibleBlocks.map((block) => {
        const entry = ORGANISMS_MAP.get(block.metaName);
        if (!entry) return null;

        // La agenda (y cualquier organismo con logica de cliente) necesita su
        // version conectada tambien en la web publica, no solo en el editor.
        const Component =
          CONNECTED_ORGANISMS[block.metaName] ?? entry.component;

        // Los defaults del meta rellenan lo que falte. Sin esto, una pagina
        // cuyos bloques lleguen sin props (migracion, edicion por API) se
        // renderiza en blanco en vez de mostrar su contenido por defecto.
        const props = {
          ...getDefaultPropsForOrganism(block.metaName),
          ...(block.props ?? {}),
        };

        // Optimizacion de imagenes SOLO aqui, en la web publica: el editor las
        // muestra tal cual porque su objetivo es elegir, no servir trafico.
        //
        // `transformImagesInProps` devuelve el valor intacto cuando la imagen no
        // es del bucket propio (una de Unsplash, por ejemplo): esas no estan en
        // la zona de Cloudflare y `/cdn-cgi/image` les daria 404.
        const transformedProps = transformImagesInProps(props);

        return <Component key={block.id} {...transformedProps} />;
      })}
    </div>
  );
}
