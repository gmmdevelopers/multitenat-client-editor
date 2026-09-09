"use client";

import { useState } from "react";
import { Canvas } from "@/components/editor/Canvas";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import {
  ViewportSelector,
  ViewportMode,
} from "@/components/editor/ViewportSelector";
import { ZoomControls } from "@/components/editor/ZoomControls";
import { OrganismTooltipPreview } from "@/components/editor/OrganismTooltipPreview";
import { useEditorStore } from "@/hooks/useEditorStore";
import { ORGANISMS_REGISTRY } from "@/lib/editor-registry";

export default function PageBuilderPage() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [zoom, setZoom] = useState<number>(1);

  const {
    blocks,
    selectedBlockId,
    setSelectedBlockId,
    addOrganism,
    updateBlockProp,
    resetBlockProps,
    reorderBlocksById,
    deleteBlock,
  } = useEditorStore();

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.4));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-950 font-sans text-white">
      <header className="flex h-14 items-center justify-between border-b border-stone-800 bg-stone-900 px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Editor de Clínica
          </h1>
          <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-[10px] text-stone-400">
            {blocks.length} {blocks.length === 1 ? "sección" : "secciones"}
          </span>
        </div>

        {/* Grupo de controles centrales: Viewport y Zoom juntos */}
        <div className="flex items-center gap-3">
          <ViewportSelector mode={viewportMode} onChange={setViewportMode} />

          <div className="h-4 w-[1px] bg-stone-800" />

          <ZoomControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
          />
        </div>

        <button
          onClick={() => console.log("Esquema publicado:", blocks)}
          className="rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-amber-300"
        >
          Publicar Cambios
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Izquierdo */}
        <aside className="w-72 border-r border-stone-800 bg-stone-900/50 p-4 overflow-y-auto">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-400">
            Agregar Secciones
          </h2>

          <div className="flex flex-col gap-2">
            {ORGANISMS_REGISTRY.map(({ meta }) => (
              <OrganismTooltipPreview
                key={meta.name}
                metaName={meta.name}
                displayName={meta.displayName}
                description={meta.description || ""}
                onAdd={() => addOrganism(meta.name)}
              />
            ))}
          </div>
        </aside>

        {/* Canvas Central */}
        <Canvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          viewportMode={viewportMode}
          zoom={zoom}
          onZoomChange={setZoom}
          onSelectBlock={setSelectedBlockId}
          onDeleteBlock={deleteBlock}
          onResetBlock={resetBlockProps}
          onReorderBlocks={reorderBlocksById}
        />

        {/* Sidebar Derecho */}
        <PropertiesPanel
          selectedBlock={selectedBlock}
          onUpdateProp={updateBlockProp}
        />
      </div>
    </div>
  );
}
