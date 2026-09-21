"use client";

import { useState } from "react";
import { Eye, FileText, Plus, Trash2 } from "lucide-react";

import type { PageSummary } from "@/types/site";

interface PagesPanelProps {
  pages: PageSummary[];
  activePageId: string | null;
  isLoading: boolean;
  onOpen: (pageId: string) => void;
  onDelete: (page: PageSummary) => void;
  onCreate: () => void;
}

const HOME_PATH = "/";

/**
 * Listado de paginas del sitio, en el sidebar del editor.
 *
 * El home (`/`) no se puede borrar: el backend tambien lo rechaza, pero aqui se
 * deshabilita para no ofrecer una accion que va a fallar.
 */
export function PagesPanel({
  pages,
  activePageId,
  isLoading,
  onOpen,
  onDelete,
  onCreate,
}: PagesPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = pages.filter((page) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      page.title.toLowerCase().includes(q) || page.path.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          <FileText className="h-3.5 w-3.5" />
          Páginas ({pages.length})
        </p>
        <button
          type="button"
          onClick={onCreate}
          title="Crear una página desde una plantilla"
          className="flex items-center gap-1 rounded-md bg-amber-400/90 px-2 py-1 text-[10px] font-bold text-black transition hover:bg-amber-300"
        >
          <Plus className="h-3 w-3" />
          Nueva
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título o ruta..."
        className="mb-1 w-full rounded-lg border-stone-800 bg-stone-950 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder-stone-600 outline-none focus:border-amber-400"
      />

      {isLoading ? (
        <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
          Cargando páginas...
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
          {query
            ? "Ninguna página coincide con la búsqueda."
            : "Todavía no hay páginas."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((page) => {
            const isActive = page.id === activePageId;
            const isHome = page.path === HOME_PATH;

            return (
              <div
                key={page.id}
                data-page-item={page.path}
                className={`rounded-lg border p-2.5 transition ${
                  isActive
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-white/5 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(page.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[11px] font-semibold text-white">
                      {page.title}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-stone-400">
                      {page.path}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {isActive ? (
                      <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                        Abierta
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpen(page.id)}
                        title="Abrir en el editor"
                        className="rounded-md p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDelete(page)}
                      disabled={isHome}
                      title={
                        isHome
                          ? "El home del sitio no se puede eliminar"
                          : "Eliminar página"
                      }
                      className="rounded-md p-1 text-stone-400 transition hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-stone-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
