"use client";

import { useState } from "react";
import * as LucideIcons from "lucide-react";
import * as SimpleIcons from "react-icons/si";

interface IconPickerSelectProps {
  value: string;
  onChange: (iconName: string) => void;
}
type IconComponent = React.ElementType<{ className?: string }>;

const ALL_ICONS: Record<string, IconComponent> = {
  ...(LucideIcons as unknown as Record<string, IconComponent>),
  ...(SimpleIcons as unknown as Record<string, IconComponent>),
};

export function IconPickerSelect({ value, onChange }: IconPickerSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const iconNames = Object.keys(ALL_ICONS).filter(
    (name) =>
      name !== "default" &&
      typeof (ALL_ICONS as Record<string, unknown>)[name] !== "undefined" &&
      name.toLowerCase().includes(search.toLowerCase()),
  );

  const CurrentIcon =
    (
      ALL_ICONS as unknown as Record<
        string,
        React.ComponentType<{ className?: string }>
      >
    )[value] || ALL_ICONS.HelpCircle;

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition hover:bg-white/10 focus:border-amber-300"
      >
        <div className="flex items-center gap-3">
          <CurrentIcon className="h-5 w-5 text-amber-300" />
          <span>{value || "Seleccionar ícono..."}</span>
        </div>
        <span className="text-xs text-stone-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-stone-800 bg-stone-900 p-2 shadow-2xl backdrop-blur">
          <input
            type="text"
            placeholder="Buscar ícono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-amber-300"
          />

          <div className="grid grid-cols-1 gap-1">
            {iconNames.slice(0, 50).map((iconName) => {
              const IconComp = (
                ALL_ICONS as unknown as Record<
                  string,
                  React.ComponentType<{ className?: string }>
                >
              )[iconName];
              if (!IconComp) return null;

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    onChange(iconName);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition ${
                    value === iconName
                      ? "bg-amber-300/20 font-semibold text-amber-300"
                      : "text-stone-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <IconComp className="h-4 w-4 shrink-0" />
                  <span className="truncate">{iconName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
