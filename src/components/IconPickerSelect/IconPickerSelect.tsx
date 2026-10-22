"use client";

import { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { BUSINESS_ICONS, type BusinessIcon } from "@multitenant/design-system";

interface IconPickerSelectProps {
  value: string;
  onChange: (iconName: string) => void;
}

type IconComponent = React.ElementType<{ className?: string }>;

/**
 * Selector de icono para los bloques.
 *
 * ## Dos grupos, y por qué
 *
 * | Grupo | De dónde | Cuántos |
 * |---|---|---|
 * | **Marca** (redes, WhatsApp) | `BUSINESS_ICONS`, del design system | 12 |
 * | **Interfaz** (flechas, checks, estrellas) | Lucide | ~1.500 |
 *
 * Los de marca salen de `BUSINESS_ICONS` y **no** de `react-icons` directo: es la
 * misma lista que `DynamicIcon` usa para pintar. Antes el selector ofrecía los
 * ~3.000 `Si*` de simple-icons, de los que la web solo sabía dibujar unos pocos:
 * el negocio elegía uno, lo veía bien en el editor y **su página salía sin
 * icono**, sin ningún error.
 *
 * Es la regla: **el selector no puede ofrecer nada que la web no sepa pintar.**
 *
 * ## La búsqueda
 *
 * Busca en tres cosas a la vez: el nombre técnico (`FaWhatsapp`), la etiqueta
 * (`WhatsApp (relleno)`) y las palabras clave (`wsp`, `contacto`). Buscar solo
 * por nombre hacía que escribir "whatsapp" encontrara el icono y "wsp" no.
 *
 * Ignora tildes y mayúsculas: "instagrám" e "INSTAGRAM" llegan igual.
 */
export function IconPickerSelect({ value, onChange }: IconPickerSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  /** Normaliza para comparar: sin tildes, minúsculas. */
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const query = normalize(search.trim());

  /**
   * Los iconos de interfaz (Lucide), sin duplicados.
   *
   * `lucide-react` exporta cada icono TRES veces (`Newspaper`, `NewspaperIcon`,
   * `LucideNewspaper`): 6.356 exports para ~2.100 iconos. En el selector
   * aparecian como tres opciones distintas que hacen lo mismo.
   *
   * Se queda la forma corta, que es la que guardan los bloques.
   *
   * Se calcula una sola vez y no en cada render: son ~2.100 nombres y el
   * selector se abre y cierra a menudo.
   */
  const lucideIcons = useMemo(() => {
    return Object.keys(LucideIcons).filter(
      (name) =>
        /^[A-Z]/.test(name) &&
        !name.endsWith("Icon") &&
        !name.startsWith("Lucide"),
    );
  }, []);

  const brandMatches = useMemo(() => {
    if (!query) return BUSINESS_ICONS;

    return BUSINESS_ICONS.filter((icon) =>
      [icon.name, icon.label, ...(icon.keywords ?? [])]
        .map(normalize)
        .some((text) => text.includes(query)),
    );
  }, [query]);

  const lucideMatches = useMemo(() => {
    if (!query) return lucideIcons;

    return lucideIcons.filter((name) => normalize(name).includes(query));
  }, [query, lucideIcons]);
  const CurrentIcon = useMemo(() => {
    const brand = BUSINESS_ICONS.find((icon) => icon.name === value);
    if (brand) return brand.component;

    return (
      (LucideIcons as unknown as Record<string, IconComponent>)[value] ??
      LucideIcons.HelpCircle
    );
  }, [value]);

  /** Etiqueta legible del valor actual, para el botón cerrado. */
  const currentLabel =
    BUSINESS_ICONS.find((icon) => icon.name === value)?.label ?? value;

  return (
    <div className="relative w-full">
      <button
        type="button"
        data-icon-picker-toggle="true"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition hover:bg-white/10 focus:border-amber-300"
      >
        <div className="flex min-w-0 items-center gap-3">
          <CurrentIcon className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="truncate">{currentLabel || "Seleccionar ícono..."}</span>
        </div>
        <span className="shrink-0 text-xs text-stone-400">▼</span>
      </button>

      {isOpen ? (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-stone-800 bg-stone-900 p-2 shadow-2xl backdrop-blur">
          <input
            type="text"
            data-icon-picker-search="true"
            placeholder="Buscar: whatsapp, instagram, flecha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            className="mb-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-amber-300"
          />

          {brandMatches.length > 0 ? (
            <div className="mb-2">
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Marcas y redes
              </p>
              <div className="grid grid-cols-2 gap-1">
                {brandMatches.map((icon) => (
                  <BrandOption
                    key={icon.name}
                    icon={icon}
                    isSelected={value === icon.name}
                    onSelect={onChange}
                    onClose={() => setIsOpen(false)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {lucideMatches.length > 0 ? (
            <div>
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Interfaz
              </p>
              <div className="grid grid-cols-2 gap-1">
                {/*
                  Se cortan a 60. Sin búsqueda son ~1.500 y el panel tarda en
                  pintarlos todos; con búsqueda, si hay más de 60 coincidencias
                  conviene afinar el texto. El aviso de abajo lo dice.
                */}
                {lucideMatches.slice(0, 60).map((iconName) => {
                  const IconComp = (
                    LucideIcons as unknown as Record<string, IconComponent>
                  )[iconName];
                  if (!IconComp) return null;

                  return (
                    <button
                      key={iconName}
                      type="button"
                      data-icon-option={iconName}
                      onClick={() => {
                        onChange(iconName);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[11px] transition ${
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
          ) : null}

          {brandMatches.length === 0 && lucideMatches.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-stone-500">
              Ningún ícono coincide con «{search}».
            </p>
          ) : null}

          {/*
            Si se cortó la lista, se dice. Sin esto parece que la búsqueda no
            encontró más, cuando en realidad hay coincidencias sin mostrar.
          */}
          {lucideMatches.length > 60 || (!query && lucideIcons.length > 60) ? (
            <p className="mt-2 px-2 text-center text-[10px] text-stone-600">
              {query
                ? `Mostrando 60 de ${lucideMatches.length}. Escribe más para afinar.`
                : `Mostrando 60 de ${lucideIcons.length}. Escribe para buscar.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Una opción de marca. Separada para que el `map` del render quede legible. */
function BrandOption({
  icon,
  isSelected,
  onSelect,
  onClose,
}: {
  icon: BusinessIcon;
  isSelected: boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const IconComponent = icon.component;

  return (
    <button
      type="button"
      data-icon-option={icon.name}
      onClick={() => {
        onSelect(icon.name);
        onClose();
      }}
      className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[11px] transition ${
        isSelected
          ? "bg-amber-300/20 font-semibold text-amber-300"
          : "text-stone-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <IconComponent className="h-4 w-4 shrink-0" />
      <span className="truncate">{icon.label}</span>
    </button>
  );
}
