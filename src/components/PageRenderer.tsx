"use client";

import { ORGANISMS_MAP } from "@/lib/editor-registry";
import { BlockInstance } from "@/types/editor-state";

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

        const Component = entry.component;

        return <Component key={block.id} {...block.props} />;
      })}
    </div>
  );
}
