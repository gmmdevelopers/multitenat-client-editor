"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LayoutTemplate } from "lucide-react";
import type { ComponentRegistryEntry, PageKind, Plan } from "@multitenant/design-system";

import { OrganismTabs } from "@/components/editor/OrganismTabs";
import type { OrganismTab } from "@/components/editor/OrganismTabs";
import {
  getTemplateCountsBySiteType,
  getTemplateGroups,
} from "@/lib/editor-registry";

interface TemplateGalleryProps {
  plan: Plan;
  /** Carga la plantilla reemplazando los bloques actuales. */
  onApplyToCurrent: (entry: ComponentRegistryEntry) => void;
  /** Crea una pagina nueva a partir de la plantilla. */
  onCreatePage: (entry: ComponentRegistryEntry) => void;
  busy?: boolean;
}

/**
 * Selector de plantillas para arrancar una pagina desde un diseno existente.
 *
 * Los templates se agrupan por `pageKind` (Inicio, Servicios, Agenda...) para
 * que la lista no se vuelva un muro de opciones. Cada plantilla ofrece las dos
 * acciones: reemplazar el contenido actual o crear una pagina nueva.
 *
 * ## Tabs de vertical
 *
 * Los mismos tabs que la pestana de Secciones (`OrganismTabs`), para que las dos
 * listas se naveguen igual. Son un filtro de NAVEGACION: acotan la lista, no
 * prohiben usar una plantilla de otro vertical.
 *
 * El tab vive aqui y no en la pagina del editor a proposito: es estado de ESTA
 * lista. Compartirlo con Secciones haria que filtrar plantillas por "Barber"
 * cambiara tambien los organismos, que es otra cosa.
 */
export function TemplateGallery({
  plan,
  onApplyToCurrent,
  onCreatePage,
  busy = false,
}: TemplateGalleryProps) {
  const [activeTab, setActiveTab] = useState<OrganismTab>("all");

  const groups = useMemo(
    () =>
      getTemplateGroups({
        plan,
        siteType: activeTab === "all" ? undefined : activeTab,
      }),
    [plan, activeTab],
  );

  const counts = useMemo(() => getTemplateCountsBySiteType({ plan }), [plan]);

  /*
   * Al cambiar de tab se abre el primer grupo del resultado. Si se conservara
   * el estado anterior, un vertical con otro `pageKind` (p. ej. solo "Inicio")
   * apareceria con todos los grupos cerrados y pareceria vacio.
   *
   * Se hace en el handler del tab y no comparando `lastTab` durante el render:
   * llamar a `setState` en el cuerpo del componente provoca un render extra y
   * React lo desaconseja.
   */
  const [openKinds, setOpenKinds] = useState<PageKind[]>(() =>
    groups.length ? [groups[0].kind] : [],
  );

  const handleTabChange = (tab: OrganismTab) => {
    setActiveTab(tab);

    const next = getTemplateGroups({
      plan,
      siteType: tab === "all" ? undefined : tab,
    });
    setOpenKinds(next.length ? [next[0].kind] : []);
  };

  const toggle = (kind: PageKind) => {
    setOpenKinds((current) =>
      current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <LayoutTemplate className="h-3.5 w-3.5" />
        Armar desde template
      </p>

      <OrganismTabs active={activeTab} onChange={handleTabChange} counts={counts} />

      {!groups.length ? (
        <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
          {activeTab === "all"
            ? "No hay plantillas disponibles para tu plan actual."
            : "Este vertical no tiene plantillas en tu plan actual."}
        </p>
      ) : null}

      {groups.map((group) => {
        const isOpen = openKinds.includes(group.kind);

        return (
          <div
            key={group.kind}
            className="overflow-hidden rounded-xl border-stone-800 bg-stone-950/40"
          >
            <button
              type="button"
              onClick={() => toggle(group.kind)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-stone-800/60"
            >
              <span className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-stone-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-stone-500" />
                )}
                <span className="text-xs font-semibold text-stone-200">
                  {group.label}
                </span>
              </span>
              <span className="rounded-full bg-stone-800 px-1.5 text-[10px] text-stone-500">
                {group.templates.length}
              </span>
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-1.5 border-t border-stone-800 p-2">
                {group.templates.map((entry) => (
                  <div
                    key={entry.meta.name}
                    data-template={entry.meta.name}
                    className="rounded-lg border-white/5 bg-white/5 p-2.5"
                  >
                    <p className="text-[11px] font-semibold text-white">
                      {entry.meta.displayName}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-stone-500">
                      {entry.meta.description}
                    </p>

                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onApplyToCurrent(entry)}
                        title="Reemplaza los bloques de la página actual"
                        className="flex-1 rounded-md bg-amber-400/90 px-2 py-1 text-[10px] font-bold text-black transition hover:bg-amber-300 disabled:opacity-40"
                      >
                        Usar aquí
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onCreatePage(entry)}
                        title="Crea una página nueva con este template"
                        className="flex-1 rounded-md border-stone-700 px-2 py-1 text-[10px] font-bold text-stone-300 transition hover:bg-stone-800 hover:text-white disabled:opacity-40"
                      >
                        Página nueva
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
