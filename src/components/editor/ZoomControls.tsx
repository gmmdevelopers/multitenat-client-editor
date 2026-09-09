"use client";

import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: ZoomControlsProps) {
  const percentage = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-1 rounded-xl bg-stone-900 border border-stone-800 p-1 shadow-lg text-xs">
      <button
        onClick={onZoomOut}
        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition"
        title="Reducir zoom (Ctrl + Rueda)"
      >
        <ZoomOut className="h-4 w-4" />
      </button>

      <button
        onClick={onResetZoom}
        className="px-2 py-1 font-mono text-[11px] font-medium text-stone-300 hover:text-white transition"
        title="Restablecer a 100%"
      >
        {percentage}%
      </button>

      <button
        onClick={onZoomIn}
        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition"
        title="Aumentar zoom (Ctrl + Rueda)"
      >
        <ZoomIn className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-stone-800 mx-0.5" />

      <button
        onClick={onResetZoom}
        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition"
        title="Restablecer 100%"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
