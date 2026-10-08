"use client";

import { Check, Plus, Puzzle, Trash2 } from "lucide-react";

import { UTILITIES_REGISTRY } from "@/lib/editor-registry";
import type { BlockInstance } from "@/types/editor-state";

interface UtilitiesPanelProps {
  blocks: BlockInstance[];
  /** Añade la utilidad al sitio. */
  onAdd: (metaName: string) => void;
  onRemove: (blockId: string) => void;
  onSelect: (blockId: string) => void;
  selectedBlockId: string | null;
}

/**
 * Panel de utilidades del sitio.
 *
 * A diferencia de los organismos, una utilidad no se repite ni se reordena: se
 * ACTIVA o se quita. Tiene sentido tener solo un botón de WhatsApp; dos
 * flotando en la misma esquina se solaparían. Por eso cada utilidad aparece una
 * vez, con un estado de activada o no, en vez de una lista de bloques.
 *
 * Las utilidades siguen guardándose como bloques (para reutilizar el guardado,
 * la publicacion y el panel de propiedades), pero el cliente las ve como un
 * interruptor, no como una seccion que se arrastra.
 */
export function UtilitiesPanel({
  blocks,
  onAdd,
  onRemove,
  onSelect,
  selectedBlockId,
}: UtilitiesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <Puzzle className="h-3.5 w-3.5" />
        Utilidades
      </p>

      <p className="text-[11px] leading-relaxed text-stone-500">
        Funciones que se configuran una vez y actúan sobre todo el sitio.
      </p>

      <div className="flex flex-col gap-2">
        {UTILITIES_REGISTRY.map((entry) => {
          const active = blocks.filter(
            (b) => b.metaName === entry.meta.name,
          );
          const isActive = active.length > 0;
          const block = active[0];
          const isSelected = block?.id === selectedBlockId;

          return (
            <div
              key={entry.meta.name}
              data-utility={entry.meta.name}
              className={`rounded-lg border p-2.5 transition ${
                isActive
                  ? "border-amber-400/60 bg-amber-400/10"
                  : "border-stone-800 bg-stone-950/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* El titulo NO es un boton envolvente: cuando lo era, se
                    superponia al boton de anadir y se quedaba el clic, asi que
                    anadir una utilidad no hacia nada. El area clicable es un
                    `div` con `onClick` propio, y solo cuando hay bloque que
                    seleccionar. */}
                <div
                  role={isActive ? "button" : undefined}
                  tabIndex={isActive ? 0 : undefined}
                  onClick={() => block && onSelect(block.id)}
                  onKeyDown={(e) => {
                    if (isActive && block && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelect(block.id);
                    }
                  }}
                  className={`min-w-0 flex-1 text-left ${
                    isActive ? "cursor-pointer" : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold text-white">
                      {entry.meta.displayName}
                    </span>
                    {isActive ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-stone-500">
                    {entry.meta.description}
                  </span>
                </div>

                {isActive && block ? (
                  <button
                    type="button"
                    onClick={() => onRemove(block.id)}
                    title="Quitar"
                    className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAdd(entry.meta.name)}
                    title="Añadir"
                    className="shrink-0 rounded-md bg-amber-400/90 p-1 text-black transition hover:bg-amber-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isActive ? (
                <p
                  className={`mt-1.5 text-[10px] ${
                    isSelected ? "text-amber-300" : "text-stone-500"
                  }`}
                >
                  {isSelected
                    ? "Editando en el panel de la derecha"
                    : "Pulsa el nombre para configurarla"}
                </p>
              ) : null}
            </div>
          );
        })}

        {UTILITIES_REGISTRY.length === 0 ? (
          <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
            Todavía no hay utilidades disponibles.
          </p>
        ) : null}
      </div>
    </div>
  );
}
