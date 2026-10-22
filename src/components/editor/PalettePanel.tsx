"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  /**
   * Paleta guardada en el sitio. `null` = la del vertical.
   *
   * Va como `unknown` porque la prop la pasa el editor sin tipar; se estrecha
   * abajo con `as` y se valida con `isCustomPalette` antes de usarla.
   */
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

  /**
   * La paleta, ya estrechada a su tipo real.
   *
   * A partir de aqui todas las comparaciones y los usos son sobre `current`:
   * TS no propaga el estrechamiento de una prop a las funciones declaradas mas
   * abajo, asi que dentro de `handleSave` volveria a ser `unknown`.
   */
  const current = palette as CustomPalette | null;
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  /**
   * La paleta GUARDADA, segun la ultima respuesta del servidor.
   *
   * ## Por que una copia y no la prop
   *
   * La prop cambia con cada seleccion (el editor la actualiza para pintar el
   * canvas al instante). Si se comparara contra ella, `hasChanges` daria
   * **siempre `false`**: la prop nueva contra si misma. El boton de guardar
   * nacia deshabilitado y la eleccion **nunca se persistia** — se veia en el
   * lienzo y desaparecia al recargar.
   *
   * Se sincroniza cuando la prop cambia por algo que **no** fue una seleccion
   * de este panel (recarga tras guardar), y al montar con lo que ya habia.
   */
  const [savedPalette, setSavedPalette] = useState<CustomPalette | null>(() =>
    isCustomPalette(current) ? current : null,
  );

  /**
   * La ultima paleta que ESTE panel aplico al lienzo.
   *
   * ## Por que hace falta distinguir el origen
   *
   * La prop cambia por dos motivos muy distintos:
   *
   *   1. **El cliente eligio aqui**: `onPreview` actualizo el estado del editor,
   *      y la prop bajo de vuelta. Eso **no** es un guardado.
   *   2. **Llego del servidor**: carga inicial o recarga tras guardar. Eso **si**
   *      es la verdad guardada.
   *
   * Sin esta distincion no hay forma de saberlo: un `useEffect` sobre la prop
   * marcaria como guardada cada seleccion, y volveriamos al fallo de que el
   * boton nunca detecta cambios.
   */
  const lastPreviewed = useRef<CustomPalette | null>(null);

  useEffect(() => {
    /**
     * Si el cambio lo provoco este panel, se ignora: no viene del servidor.
     *
     * La comparacion es por valor y no por identidad: el editor puede reenviar
     * un objeto nuevo con los mismos colores, y eso no es un guardado.
     */
    if (
      JSON.stringify(current ?? null) === JSON.stringify(lastPreviewed.current)
    ) {
      return;
    }

    setSavedPalette(isCustomPalette(current) ? current : null);
  }, [current]);

  const hasChanges = JSON.stringify(current) !== JSON.stringify(savedPalette);

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
    // Se anota ANTES de avisar: el editor devuelve la prop y el efecto de
    // sincronizacion la ignorara, porque este cambio no viene del servidor.
    lastPreviewed.current = next;

    onPreview(next);
  }

  async function handleSave() {
    if (!siteId) {
      toast.error("No se pudo determinar el sitio actual.");
      return;
    }

    setIsSaving(true);
    try {
      await updateSite(siteId, { settings: { palette: current } });

      /**
       * Se marca como guardada **en el momento** y no se espera al prop.
       *
       * El editor recarga tras guardar (`onSaved`), y hasta que esa respuesta no
       * llegue la prop trae el valor viejo: sin esta linea, el boton seguiria
       * diciendo "cambios sin guardar" durante un instante y se podia volver a
       * pulsar.
       */
      setSavedPalette(isCustomPalette(current) ? current : null);

      // El valor ya esta guardado: la proxima vuelta de la prop no es un cambio.
      lastPreviewed.current = current;

      toast.success(
        current ? "Paleta guardada" : "Volviste a la paleta original",
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
    /**
     * Se mide la paleta **elegida**, no la guardada.
     *
     * El aviso sirve para decidir si se guarda o no: apuntando a la guardada,
     * solo avisaria del problema *despues* de haberlo grabado, que es tarde.
     */
    const active = current;
    if (!active) return null;
    return contrastRatio(active.text, active.background);
  }, [current]);

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
              ? current === null
              : current !== null &&
                isCustomPalette(current) &&
                PALETTE_KEYS.every(
                  (key) => current[key] === option.palette![key],
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
          calculado sobre la paleta ELEGIDA (no la guardada), para poder decidir
          antes de guardar. */}
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
        {current !== null ? (
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
