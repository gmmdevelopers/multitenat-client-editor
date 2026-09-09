"use client";

import { Monitor, Smartphone } from "lucide-react";

export type ViewportMode = "desktop" | "mobile";

interface ViewportSelectorProps {
  mode: ViewportMode;
  onChange: (mode: ViewportMode) => void;
}

export function ViewportSelector({ mode, onChange }: ViewportSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-stone-800 p-1">
      <button
        onClick={() => onChange("desktop")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
          mode === "desktop"
            ? "bg-amber-400 text-black shadow-sm"
            : "text-stone-400 hover:text-white"
        }`}
      >
        <Monitor className="h-3.5 w-3.5" />
        <span>Escritorio</span>
      </button>

      <button
        onClick={() => onChange("mobile")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
          mode === "mobile"
            ? "bg-amber-400 text-black shadow-sm"
            : "text-stone-400 hover:text-white"
        }`}
      >
        <Smartphone className="h-3.5 w-3.5" />
        <span>Móvil</span>
      </button>
    </div>
  );
}
