"use client";

import { useMemo, useState } from "react";
import { Check, Palette, RotateCcw, Search } from "lucide-react";
import {
  PALETTE_KEYS,
  PALETTE_PRESETS,
  contrastRatio,
  isCustomPalette,
  type CustomPalette,
} from "@multitenant/design-system";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { updateSite } from "@/lib/api/sites";

/**
 * Paleta de colores del sitio, dentro del editor.
 *
 * Antes vivia en Configuracion y obligaba a salir del editor, cambiar los
 * colores y volver para ver el resultado. Aqui los cambios se aplican al lienzo
 * AL INSTANTE (`onPreview`), y guardarlos es una decision aparte.
 *
 * Cada paleta se muestra como la tira de colores que se vera en la web, no como
 * seis cuadros de color sin contexto: el cliente elige mirando, no leyendo
 * nombres de colores.
 */

/** Strip de color de una paleta, ordenado como se ve en la web de arriba abajo. */
const STRIP_ORDER: Array<keyof CustomPalette> = [
  "accent",
  "surface",
  "background",
  "card",
  "text",
  "muted",
];

interface PalettePanelProps {
  siteId: string | null;
  /** Paleta guardada en el sitio. `null` = la del vertical. */
  palette: unknown;
  siteType?: string;
  /**
   * Aplica la paleta al lienzo sin guardarla.
   *
   * Es lo que da la vista en tiempo real: el canvas ya pinta con lo que reciba
   * aqui, asi que no hace falta duplicar la logica de colores en este panel.
   */
  onPreview: (palette: CustomPalette | null) => void;
  /** Tras guardar, el contenedor recarga para dejar de marcar cambios. */
  onSaved: () => void;
}

export function PalettePanel({
  siteId,
  palette,
  siteType,
  onPreview,
  onSaved,
}: PalettePanelProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Lo que hay GUARDADO en el sitio, para saber si hay cambios pendientes.
  const savedPalette = useMemo(
    () => (isCustomPalette(palette) ? palette : null),
    [palette],
  );

  const hasChanges = JSON.stringify(palette) !== JSON.stringify(savedPalette);

  /**
   * Presets disponibles.
   *
   * El del vertical se antepone a los demas: para un cliente nuevo es la opcion
   * correcta, y hasta ahora solo se podia elegir volviendo a Configuracion.
   */
  const options = useMemo(() => {
    const base = PALETTE_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      palette: preset.palette as CustomPalette | null,
    }));

    return [
      { id: "vertical", label: "Paleta original", palette: null },
      ...base,
    ];
  }, []);

  const filtered = options.filter((option) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return option.label.toLowerCase().includes(q);
  });

  /** Selecciona y previsualiza. `null` = volver a la del vertical. */
  function handleSelect(next: CustomPalette | null) {
    onPreview(next);
  }

  async function handleSave() {
    if (!siteId) {
      toast.error("No se pudo determinar el sitio actual.");
      return;
    }

    setIsSaving(true);
    try {
      await updateSite(siteId, { settings: { palette } });
      toast.success(
        palette ? "Paleta guardada" : "Volviste a la paleta original",
      );
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar la paleta."));
    } finally {
      setIsSaving(false);
    }
  }

  /** Contraste minimo del par texto/fondo, para avisar de una paleta ilegible. */
  const worstContrast = useMemo(() => {
    const current = savedPalette;
    if (!current) return null;
    return contrastRatio(current.text, current.background);
  }, [savedPalette]);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        <Palette className="h-3.5 w-3.5" />
        Paleta
      </p>

      {/* Buscador: el listado de presets crece, y encontrar "Coral" a mano entre
          veinte tiras de color es mas lento que escribirlo. */}
      <label className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1.5 focus-within:border-amber-400">
        <Search className="h-3.5 w-3.5 shrink-0 text-stone-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar paleta..."
          className="w-full bg-transparent text-[11px] text-stone-200 placeholder-stone-600 outline-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        {filtered.map((option) => {
          const isActive =
            option.palette === null
              ? palette === null
              : palette !== null &&
                isCustomPalette(palette) &&
                PALETTE_KEYS.every(
                  (key) => palette[key] === option.palette![key],
                );

          return (
            <PaletteOption
              key={option.id}
              id={option.id}
              label={option.label}
              palette={option.palette}
              isActive={isActive}
              onSelect={() => handleSelect(option.palette)}
            />
          );
        })}

        {filtered.length === 0 ? (
          <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
            Ninguna paleta coincide con la busqueda.
          </p>
        ) : null}
      </div>

      {/* Contraste: se informa del par que mas se rompe, con el valor real
          calculado sobre la paleta guardada, no una promesa de legibilidad. */}
      {worstContrast !== null ? (
        <p className="text-[10px] text-stone-500">
          Contraste texto/fondo:{" "}
          <strong
            data-contrast-background
            className={
              worstContrast >= 4.5 ? "text-emerald-400" : "text-amber-300"
            }
          >
            {worstContrast.toFixed(1)}:1
          </strong>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {palette !== null ? (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            Restablecer
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          data-save-palette="true"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Guardando..." : "Guardar paleta"}
        </button>
      </div>

      {hasChanges ? (
        <p className="text-[10px] leading-relaxed text-amber-300/80">
          Vista previa sin guardar. El lienzo la muestra, pero tu web publicada
          no cambia hasta que guardes.
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-stone-600">
          Los colores se aplican al editor y a tu web publicada.
        </p>
      )}
    </div>
  );
}

/**
 * Una paleta del listado.
 *
 * El borde de la tira reproduce el contraste real de la paleta: sin el, dos
 * paletas con el mismo acento pero distinto fondo se verian casi iguales en un
 * listado de tiras de color.
 */
function PaletteOption({
  id,
  label,
  palette,
  isActive,
  onSelect,
}: {
  id: string;
  label: string;
  palette: CustomPalette | null;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-palette-preset={id}
      onClick={onSelect}
      className={`group w-full overflow-hidden rounded-lg border bg-stone-950 text-left transition ${
        isActive
          ? "border-amber-400 ring-1 ring-amber-400/40"
          : "border-stone-800 hover:border-stone-600"
      }`}
    >
      {palette ? (
        <span className="flex h-8 w-full">
          {STRIP_ORDER.map((key) => (
            <span
              key={key}
              className="flex-1"
              style={{ backgroundColor: palette[key] }}
            />
          ))}
        </span>
      ) : (
        // Estado de fabrica: no hay paleta concreta que mostrar, asi que se
        // ilustra con un degradado en vez de dejar el hueco vacio.
        <span className="flex h-8 w-full items-center justify-center bg-gradient-to-r from-stone-700 via-stone-500 to-stone-300 text-[9px] font-bold uppercase tracking-wider text-stone-900">
          Del vertical
        </span>
      )}

      <span className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="truncate text-[11px] font-medium text-stone-200">
          {label}
        </span>
        {isActive ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        ) : null}
      </span>
    </button>
  );
}
