"use client";

import { SITE_TYPE } from "@multitenant/design-system";
import type { SiteType } from "@multitenant/design-system";

export type OrganismTab = SiteType | "all";

/**
 * Tabs para acotar la lista de organismos por vertical.
 *
 * No prohiben nada: son una ayuda de navegacion para que la lista no se vuelva
 * interminable. El cliente puede seguir arrastrando el organismo que quiera
 * aunque el tab activo sea de otro vertical.
 */
const TAB_LABELS: Array<{ value: OrganismTab; label: string }> = [
  { value: "all", label: "Todos" },
  { value: SITE_TYPE.medical, label: "Medical" },
  { value: SITE_TYPE.dental, label: "Dental" },
  { value: SITE_TYPE.skincare, label: "Skincare" },
  { value: SITE_TYPE.barber, label: "Barber" },
  { value: SITE_TYPE.massage, label: "Massage" },
];

interface OrganismTabsProps {
  active: OrganismTab;
  onChange: (tab: OrganismTab) => void;
  counts: Record<OrganismTab, number>;
}

export function OrganismTabs({ active, onChange, counts }: OrganismTabsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-stone-950/60 p-1">
      {TAB_LABELS.map(({ value, label }) => {
        const isActive = value === active;
        const count = counts[value] ?? 0;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              isActive
                ? "bg-amber-400 text-black"
                : "text-stone-400 hover:bg-stone-800 hover:text-white"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                isActive
                  ? "bg-black/20 text-black"
                  : "bg-stone-800 text-stone-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
