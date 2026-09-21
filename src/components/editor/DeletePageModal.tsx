"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface DeletePageModalProps {
  pageTitle: string;
  pagePath: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmación de borrado de pagina.
 *
 * No basta con un "¿estas seguro?" de un clic: se pide escribir la RUTA exacta
 * para confirmar. Borrar una pagina es irreversible y arrastra sus bloques, asi
 * que la friccion es deliberada.
 */
export function DeletePageModal({
  pageTitle,
  pagePath,
  isDeleting,
  onCancel,
  onConfirm,
}: DeletePageModalProps) {
  const [typed, setTyped] = useState("");
  const canDelete = typed.trim() === pagePath;

  // Escape cierra el modal, salvo mientras se esta borrando.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDeleting, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-page-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div
        data-delete-modal="true"
        className="w-full max-w-md rounded-2xl border-stone-800 bg-stone-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 id="delete-page-title" className="text-sm font-bold text-white">
              Eliminar «{pageTitle}»
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-400">
              Esta acción no se puede deshacer. Se borrarán la página y todos sus
              bloques, publicados o no.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Escribe la ruta para confirmar
          </span>
          <input
            data-delete-input="true"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={pagePath}
            disabled={isDeleting}
            className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 font-mono text-sm text-white placeholder-stone-700 outline-none focus:border-red-500"
          />
          <span className="mt-1.5 block font-mono text-[11px] text-stone-500">
            Ruta de la página: {pagePath}
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-delete-confirm="true"
            disabled={!canDelete || isDeleting}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? "Eliminando..." : "Eliminar página"}
          </button>
        </div>
      </div>
    </div>
  );
}
