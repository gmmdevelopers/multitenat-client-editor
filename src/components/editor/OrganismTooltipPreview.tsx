"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ORGANISMS_MAP,
  getDefaultPropsForOrganism,
} from "@/lib/editor-registry";

interface OrganismTooltipPreviewProps {
  metaName: string;
  displayName: string;
  description: string;
  onAdd: () => void;
}

export function OrganismTooltipPreview({
  metaName,
  displayName,
  description,
  onAdd,
}: OrganismTooltipPreviewProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const buttonRef = useRef<HTMLDivElement>(null);

  const entry = ORGANISMS_MAP.get(metaName);
  const Component = entry?.component;
  const defaultProps = getDefaultPropsForOrganism(metaName);

  const TOOLTIP_HEIGHT = 260;

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      let calculatedTop = rect.top;
      if (calculatedTop + TOOLTIP_HEIGHT > windowHeight - 16) {
        calculatedTop = Math.max(16, windowHeight - TOOLTIP_HEIGHT - 16);
      }

      setCoords({
        top: calculatedTop,
        left: rect.right + 12,
      });
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const handleAddBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd();
  };

  return (
    <div
      ref={buttonRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      <button
        type="button"
        onClick={handleAddBlock}
        className="w-full flex flex-col gap-1 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-amber-400/50 hover:bg-white/10 active:scale-[0.98] cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">
            {displayName}
          </span>
          <span className="text-xs font-bold text-amber-300">+</span>
        </div>
        <p className="line-clamp-2 text-[10px] text-stone-400">{description}</p>
      </button>

      {/* Portal del Tooltip Preview */}
      {showTooltip &&
        Component &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="pointer-events-none z-[9999] w-[460px] rounded-2xl border border-stone-700 bg-stone-900 p-3 shadow-2xl transition-all"
          >
            <div className="mb-2 flex items-center justify-between border-b border-stone-800 pb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Vista previa: {displayName}
              </span>
            </div>

            <div className="relative h-[210px] w-full overflow-hidden rounded-xl border border-stone-800 bg-stone-950">
              <div className="absolute left-0 top-0 w-[1150px] origin-top-left transform scale-[0.38] pointer-events-none select-none">
                <Component {...defaultProps} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
