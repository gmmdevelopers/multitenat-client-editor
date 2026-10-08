"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

/**
 * Lista de objetos editables dentro de un item de otra lista.
 *
 * Existe porque un miembro del equipo tiene sus PROPIAS redes sociales
 * (`members[].socialLinks`), y el panel solo sabia editar un nivel de
 * anidacion: al llegar a la lista interna la mostraba como texto de solo
 * lectura (`0`, `1`, `2`). Con esto, cada red social tiene sus inputs y sus
 * botones de anadir y borrar, igual que cualquier otra lista.
 */
export interface NestedListProps {
  /** Etiqueta visible de la lista (`Social links`). */
  label: string;
  /** Items actuales. */
  items: unknown[];
  /** Sufijo unico para las `key` del DOM. */
  idPrefix: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onChange: (innerIndex: number, fieldKey: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (innerIndex: number) => void;
  /** Renderiza un campo con el control que le corresponda. */
  renderField: (
    key: string,
    value: unknown,
    onChange: (next: unknown) => void,
    locationKey: string,
  ) => React.ReactNode;
}

export function NestedList({
  label,
  items,
  idPrefix,
  isCollapsed,
  onToggleCollapse,
  onChange,
  onAdd,
  onRemove,
  renderField,
}: NestedListProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold capitalize text-stone-400">
            {label}
          </span>
          <span className="rounded-full bg-stone-800 px-1.5 text-[10px] text-stone-400">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-md bg-stone-800 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-stone-700"
          >
            <Plus className="h-3 w-3" /> Añadir
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-stone-800 p-2 text-center text-[10px] text-stone-600">
              Sin elementos. Pulsa «Añadir».
            </p>
          ) : null}

          {items.map((item, index) => (
            <div
              key={`${idPrefix}-${index}`}
              className="relative flex flex-col gap-2 rounded-lg border border-stone-800/80 bg-stone-900 p-2.5"
            >
              <div className="flex items-center justify-between border-b border-stone-800 pb-1">
                <span className="text-[10px] font-bold text-stone-500">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="text-stone-500 hover:text-red-400"
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {typeof item === "object" && item !== null ? (
                Object.entries(item as Record<string, unknown>).map(
                  ([fieldKey, fieldValue]) =>
                    renderField(
                      fieldKey,
                      fieldValue,
                      (next) => onChange(index, fieldKey, next),
                      `${idPrefix}-${index}-${fieldKey}`,
                    ),
                )
              ) : (
                renderField(
                  "value",
                  item,
                  (next) => onChange(index, "", next),
                  `${idPrefix}-${index}`,
                )
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
