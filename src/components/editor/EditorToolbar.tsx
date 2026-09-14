"use client";

import { ViewportMode, ViewportSelector } from "./ViewportSelector";
import { ZoomControls } from "./ZoomControls";

interface EditorToolbarProps {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  handleSaveDraft: () => void;
  handlePublishPage: () => void;
  handleViewportChange: (viewport: ViewportMode) => void;
  viewportMode: ViewportMode;
  zoom: number;
  blocksLength: number;
}

export function EditorToolbar({
  handleResetZoom,
  handleZoomIn,
  handleZoomOut,
  handlePublishPage,
  handleSaveDraft,
  viewportMode,
  handleViewportChange,
  zoom,
  blocksLength,
}: EditorToolbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-stone-800 bg-stone-900 px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Editor de Clínica
        </h1>
        <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-[10px] text-stone-400">
          {blocksLength} {blocksLength === 1 ? "sección" : "secciones"}
        </span>
      </div>

      {/* Grupo de controles centrales: Viewport y Zoom juntos */}
      <div className="flex items-center gap-3">
        <ViewportSelector mode={viewportMode} onChange={handleViewportChange} />

        <div className="h-4 w-[1px] bg-stone-800" />

        <ZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
      </div>
      <div>
        <button
          onClick={handleSaveDraft}
          className="mr-2 rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-amber-300"
        >
          Guardar Borrador
        </button>
        <button
          onClick={handlePublishPage}
          className="rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-bold text-black transition hover:bg-amber-300"
        >
          Publicar Cambios
        </button>
      </div>
    </header>
  );
}
