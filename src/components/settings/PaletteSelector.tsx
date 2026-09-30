"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Palette, RotateCcw, Save } from "lucide-react";
import {
  PALETTE_KEYS,
  PALETTE_PRESETS,
  SITE_PALETTE,
  SITE_TYPE,
  contrastRatio,
  isCustomPalette,
  resolvePaletteTokens,
  type CustomPalette,
} from "@multitenant/design-system";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { getCurrentSite, updateSite } from "@/lib/api/sites";

/** Como se llama cada color en la UI, en palabras del cliente. */
const COLOR_LABELS: Record<
  keyof CustomPalette,
  { label: string; help: string }
> = {
  accent: {
    label: "Color de marca",
    help: "Botones, enlaces y detalles. Es el color que identifica tu negocio.",
  },
  surface: {
    label: "Bloques oscuros",
    help: "Cabecera, pie de página y paneles oscuros.",
  },
  background: {
    label: "Fondo de la página",
    help: "El color general sobre el que se lee todo.",
  },
  card: {
    label: "Tarjetas",
    help: "El fondo de las tarjetas y paneles sobre el fondo de la página.",
  },
  text: {
    label: "Texto principal",
    help: "Títulos y párrafos. Debe leerse sobre el fondo y las tarjetas.",
  },
  muted: {
    label: "Texto secundario",
    help: "Descripciones y textos de apoyo.",
  },
};

/**
 * Paleta por defecto del vertical, para poder ofrecerla como opcion.
 *
 * Se lee de `SITE_PALETTE` en vez de duplicarla: si el design system cambia un
 * color, el selector lo refleja sin tocar nada aqui.
 */
function defaultPaletteFor(siteType: string | undefined): CustomPalette {
  const base =
    siteType && siteType in SITE_PALETTE
      ? SITE_PALETTE[siteType as keyof typeof SITE_PALETTE]
      : SITE_PALETTE.medical;

  return {
    accent: base.accent,
    surface: base.surface,
    background: base.background,
    card: "#FFFFFF",
    text: base.text,
    muted: base.text,
  };
}

interface PaletteSelectorProps {
  /** Se avisa al contenedor para que refresque lo que tenga cacheado. */
  onSaved?: () => void;
}

/**
 * Selector de paleta del sitio.
 *
 * El cliente elige los colores y el sistema calcula sola la legibilidad de los
 * textos (`onSurface`, `onAccent`...). No se le pide elegir "texto sobre la
 * cabecera": eso es una consecuencia del color que eligio, no una decision.
 */
export function PaletteSelector({ onSaved }: PaletteSelectorProps) {
  const toast = useToast();

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteType, setSiteType] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /** `null` = usa la paleta del vertical (es el estado de fabrica). */
  const [palette, setPalette] = useState<CustomPalette | null>(null);
  /** Lo que hay guardado, para saber si hay cambios sin guardar. */
  const [savedPalette, setSavedPalette] = useState<CustomPalette | null>(null);

  useEffect(() => {
    void getCurrentSite()
      .then((site) => {
        if (!site) return;

        setSiteId(site.id);

        const stored = site.settings?.palette;
        // Se valida al leer y no se confia en el tipo: el valor viene de un
        // JSON en la base y puede ser cualquier cosa de una version anterior.
        const valid = isCustomPalette(stored) ? stored : null;

        setPalette(valid);
        setSavedPalette(valid);
        setSiteType(site.settings?.siteType ?? undefined);
      })
      .catch((err) =>
        toast.error(getErrorMessage(err, "No se pudo cargar la paleta.")),
      )
      .finally(() => setIsLoading(false));
  }, [toast]);

  /** La paleta que se esta viendo: la elegida o la del vertical. */
  const effective = palette ?? defaultPaletteFor(siteType);

  const tokens = useMemo(
    () => resolvePaletteTokens(palette, siteType),
    [palette, siteType],
  );

  const hasChanges = JSON.stringify(palette) !== JSON.stringify(savedPalette);

  function updateColor(key: keyof CustomPalette, value: string) {
    setPalette({ ...effective, [key]: value });
  }

  async function handleSave() {
    if (!siteId) return;

    setIsSaving(true);
    try {
      await updateSite(siteId, { settings: { palette } });
      setSavedPalette(palette);
      toast.success(
        palette ? "Paleta guardada" : "Volviste a la paleta original",
      );
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar la paleta."));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <span className="animate-pulse text-xs text-stone-500">
          Cargando paleta...
        </span>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
        <Palette className="h-4 w-4 text-amber-300" />
        Paleta de colores
      </h2>
      <p className="mb-5 text-xs text-stone-400">
        Personaliza los colores de tu web. Los textos se ajustan solos para que
        siempre se lean.
      </p>

      {/* --- Presets --- */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Empieza con una
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          data-palette-default="true"
          onClick={() => setPalette(null)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
            palette === null
              ? "border-amber-400 bg-amber-400/10 text-amber-300"
              : "border-stone-800 text-stone-300 hover:border-stone-700"
          }`}
        >
          {palette === null ? <Check className="h-3 w-3" /> : null}
          Predeterminada
        </button>

        {PALETTE_PRESETS.map((preset) => {
          const isActive =
            palette !== null &&
            PALETTE_KEYS.every((key) => palette[key] === preset.palette[key]);

          return (
            <button
              key={preset.id}
              type="button"
              data-palette-preset={preset.id}
              onClick={() => setPalette(preset.palette)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                isActive
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-stone-800 text-stone-300 hover:border-stone-700"
              }`}
            >
              <span className="flex overflow-hidden rounded">
                <span
                  className="h-3.5 w-3.5"
                  style={{ backgroundColor: preset.palette.accent }}
                />
                <span
                  className="h-3.5 w-3.5"
                  style={{ backgroundColor: preset.palette.surface }}
                />
                <span
                  className="h-3.5 w-3.5"
                  style={{ backgroundColor: preset.palette.background }}
                />
              </span>
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* --- Colores --- */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PALETTE_KEYS.map((key) => (
          <label key={key} className="block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {COLOR_LABELS[key].label}
              <span className="font-mono text-[10px] normal-case text-stone-600">
                {effective[key]}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                data-palette-color={key}
                value={effective[key]}
                onChange={(e) => updateColor(key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border-stone-800 bg-stone-950"
              />
              <span className="text-[10px] leading-tight text-stone-500">
                {COLOR_LABELS[key].help}
              </span>
            </span>
          </label>
        ))}
      </div>

      {/* --- Vista previa ---
          Se muestra el contraste REAL calculado, no una promesa: si el cliente
          elige un texto ilegible, aqui lo ve antes de guardar y publicar. */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Así se verá
        </p>

        <div
          className="overflow-hidden rounded-xl border"
          style={{
            borderColor: tokens.border,
            backgroundColor: tokens.background,
            color: tokens.onBackground,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: tokens.surface, color: tokens.onSurface }}
          >
            <span className="text-xs font-bold">Mi negocio</span>
            <span
              className="text-[11px]"
              style={{ color: tokens.onSurfaceMuted }}
            >
              Inicio · Servicios · Contacto
            </span>
          </div>

          <div className="px-4 py-4">
            <p
              className="text-sm font-bold"
              style={{ color: tokens.onBackground }}
            >
              Título de la sección
            </p>
            <p className="mt-1 text-[11px]" style={{ color: tokens.muted }}>
              Texto secundario, descripciones y apoyos.
            </p>

            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: tokens.card, color: tokens.onCard }}
            >
              <p className="text-[11px] font-semibold">Tarjeta de servicio</p>
              <p className="mt-1 text-[11px]" style={{ color: tokens.muted }}>
                Contenido dentro de una tarjeta.
              </p>
            </div>

            <span
              className="mt-3 inline-block rounded-lg px-3 py-1.5 text-[11px] font-bold"
              style={{ backgroundColor: tokens.accent, color: tokens.onAccent }}
            >
              Agendar hora
            </span>
          </div>
        </div>

        {/* El contraste se informa en los dos pares que mas se rompen. */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-stone-500">
          <span>
            Texto sobre fondo:{" "}
            <strong
              data-contrast-background
              className={
                contrastRatio(tokens.text, tokens.background) >= 4.5
                  ? "text-emerald-400"
                  : "text-amber-300"
              }
            >
              {contrastRatio(tokens.text, tokens.background).toFixed(1)}:1
            </strong>
          </span>
          <span>
            Texto sobre marca:{" "}
            <strong
              data-contrast-accent
              className={
                contrastRatio(tokens.accent, tokens.onAccent) >= 4.5
                  ? "text-emerald-400"
                  : "text-amber-300"
              }
            >
              {contrastRatio(tokens.accent, tokens.onAccent).toFixed(1)}:1
            </strong>
          </span>
          <span className="text-stone-600">Mínimo recomendado: 4.5:1</span>
        </div>
      </div>

      {/* --- Acciones --- */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {palette !== null ? (
          <button
            type="button"
            onClick={() => setPalette(null)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer
          </button>
        ) : null}

        <button
          type="button"
          data-save-palette="true"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Guardando..." : "Guardar paleta"}
        </button>
      </div>

      {!hasChanges ? (
        <p className="mt-2 text-right text-[10px] text-stone-600">
          Al guardar, los colores se aplican al editor y a tu web publicada.
        </p>
      ) : null}
    </section>
  );
}
