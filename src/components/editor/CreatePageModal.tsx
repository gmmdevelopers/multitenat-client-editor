"use client";

import { useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";

interface CreatePageModalProps {
  templateName: string;
  /** Ruta sugerida a partir del tipo de página del template. */
  suggestedPath: string;
  templateDescription?: string;
  isCreating: boolean;
  /** Páginas existentes, para avisar si la ruta ya está ocupada. */
  existingPaths: string[];
  onCancel: () => void;
  onConfirm: (path: string, title: string) => void;
}

/**
 * Modal para crear una pagina desde una plantilla.
 *
 * Pide la ruta y el titulo antes de crear. Sustituye al `window.prompt`, que
 * bloqueaba el navegador y no permitia validar nada.
 */
export function CreatePageModal({
  templateName,
  suggestedPath,
  templateDescription,
  isCreating,
  existingPaths,
  onCancel,
  onConfirm,
}: CreatePageModalProps) {
  const [path, setPath] = useState(suggestedPath);
  const [title, setTitle] = useState(templateName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCreating) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreating, onCancel]);

  // Normalizamos igual que el backend: sin espacios y con barra inicial.
  const normalized = (() => {
    const trimmed = path.trim();
    if (trimmed === "" || trimmed === "/") return "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  })();

  const isHome = normalized === "/";
  const isDuplicate = existingPaths.includes(normalized);
  const canCreate =
    normalized.length > 0 && !isDuplicate && title.trim().length > 0;

  // El overlay va en z-[60]: por encima del contenedor de toasts (z-50), que
  // se monta despues en el DOM y tapaba el boton de confirmar.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-page-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) onCancel();
      }}
    >
      <div
        data-create-modal="true"
        className="w-full max-w-md rounded-2xl border-stone-800 bg-stone-900 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
            <FilePlus2 className="h-4 w-4" />
          </span>
          <div>
            <h2 id="create-page-title" className="text-sm font-bold text-white">
              Crear página desde «{templateName}»
            </h2>
            {templateDescription ? (
              <p className="mt-1 text-xs leading-relaxed text-stone-400">
                {templateDescription}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Ruta
            </span>
            <input
              data-create-path="true"
              autoFocus
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isCreating}
              placeholder={suggestedPath}
              className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 font-mono text-sm text-white placeholder-stone-700 outline-none focus:border-amber-400"
            />
            {isDuplicate ? (
              <span className="mt-1.5 block text-[11px] text-red-400">
                Ya existe una página en «{normalized}». Elige otra ruta.
              </span>
            ) : isHome ? (
              <span className="mt-1.5 block text-[11px] text-amber-400">
                «/» es el home del sitio y ya existe; no puedes crear otro.
              </span>
            ) : (
              <span className="mt-1.5 block text-[11px] text-stone-500">
                Se guardará como <span className="font-mono">{normalized}</span>
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Título
            </span>
            <input
              data-create-title="true"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
              className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-create-confirm="true"
            disabled={!canCreate || isCreating}
            onClick={() => onConfirm(normalized, title.trim())}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? "Creando..." : "Crear página"}
          </button>
        </div>
      </div>
    </div>
  );
}
