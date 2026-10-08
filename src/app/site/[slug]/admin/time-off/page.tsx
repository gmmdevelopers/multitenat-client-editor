"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarOff, Plus, Sparkles, Trash2, Users } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { listProfessionals, type Professional } from "@/lib/api/professionals";
import {
  BUSINESS_TIME_ZONE,
  createTimeOff,
  instantToLocalDate,
  listHolidays,
  listTimeOff,
  removeTimeOff,
  type Holiday,
  type TimeOff,
} from "@/lib/api/schedule";

/**
 * Bloqueos de agenda: feriados, vacaciones y cierres puntuales.
 *
 * A diferencia del horario (que es una regla SEMANAL), esto son dias concretos.
 * Se guardan como instantes, pero el cliente piensa en dias de calendario, asi
 * que la conversion la hace el cliente API con la zona del negocio.
 *
 * El backend solo devuelve los VIGENTES O FUTUROS: no hay historico, porque una
 * lista de bloqueos ya pasados solo estorba al organizar la agenda.
 */

/** Rango formateado para mostrar: "25 dic" o "25 dic — 2 ene". */
function formatRange(startsAt: string, endsAt: string): string {
  const start = instantToLocalDate(startsAt);
  const end = instantToLocalDate(endsAt);

  const short = (isoDate: string) =>
    new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "short",
      // La fecha ya viene en hora de Chile; se formatea como UTC para que
      // `Intl` no la vuelva a desplazar segun la zona del NAVEGADOR.
      timeZone: "UTC",
    }).format(new Date(`${isoDate}T00:00:00Z`));

  if (start === end) return short(start);

  return `${short(start)} a ${short(end)}`;
}

/**
 * Fecha larga de un feriado: "25 de diciembre".
 *
 * Se compone a mano desde `YYYY-MM-DD` en vez de con `Date`: interpretar la
 * cadena como UTC y formatearla en la zona del navegador mostraria el dia
 * ANTERIOR a un cliente con el equipo en otro huso.
 */
function formatHolidayDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);

  return `${day} de ${
    [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ][month - 1]
  }`;
}

/** `true` si el bloqueo ya empezo (esta en curso ahora mismo). */
function isOngoing(block: TimeOff): boolean {
  return new Date(block.startsAt).getTime() <= Date.now();
}

/** Cuantos dias cubre el bloqueo, contando el primero y el ultimo. */
function daysBetween(block: TimeOff): number {
  const start = new Date(`${instantToLocalDate(block.startsAt)}T00:00:00Z`);
  const end = new Date(`${instantToLocalDate(block.endsAt)}T00:00:00Z`);

  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

interface NewBlockDraft {
  startsOn: string;
  endsOn: string;
  reason: string;
  /** Cadena vacia = todo el negocio. */
  professionalId: string;
}

function emptyDraft(): NewBlockDraft {
  return { startsOn: "", endsOn: "", reason: "", professionalId: "" };
}

export default function TimeOffPage() {
  const toast = useToast();

  const [blocks, setBlocks] = useState<TimeOff[] | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<NewBlockDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Feriados sugeridos y si la fuente externa respondio.
   *
   * `available: false` -> la pantalla ESCONDE el atajo. No es un error que
   * haya que mostrar: los feriados son una comodidad, y avisar de que un
   * servicio de terceros no responde solo confundiria al cliente.
   */
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysAvailable, setHolidaysAvailable] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  /** Fechas marcadas en el panel de sugerencias. */
  const [pickedHolidays, setPickedHolidays] = useState<Set<string>>(new Set());
  const [isAddingHolidays, setIsAddingHolidays] = useState(false);

  useEffect(() => {
    void Promise.all([listTimeOff(), listProfessionals()])
      .then(([blockList, professionalList]) => {
        setBlocks(blockList);
        // Solo los activos: bloquear la agenda de alguien inhabilitado no tiene
        // efecto observable y ensucia la lista.
        setProfessionals(professionalList.items.filter((p) => p.isActive));
      })
      .catch((err) =>
        setError(getErrorMessage(err, "No se pudieron cargar los bloqueos.")),
      );

    // Los feriados se piden aparte y sin bloquear la pantalla: si tardan o
    // fallan, la lista de bloqueos debe pintarse igual.
    void listHolidays()
      .then((result) => {
        setHolidays(result.holidays);
        setHolidaysAvailable(result.available);
      })
      .catch(() => {
        // Silencioso a proposito: es un atajo, no un dato de la pantalla.
        setHolidaysAvailable(false);
      });
  }, []);

  /** Nombre del profesional de un bloqueo, o `null` si es de todo el negocio. */
  const professionalName = useMemo(() => {
    const byId = new Map(
      professionals.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]),
    );

    return (id: string | null) => (id ? (byId.get(id) ?? "Profesional") : null);
  }, [professionals]);

  /**
   * El formulario exige ambas fechas y que el fin no sea anterior al inicio.
   *
   * Se valida aqui y no solo en el backend para poder deshabilitar el boton:
   * mandar la peticion para recibir un 400 deja al cliente sin saber que le
   * falta.
   */
  const canSubmit =
    draft.startsOn.length > 0 &&
    draft.endsOn.length > 0 &&
    draft.endsOn >= draft.startsOn;

  async function handleCreate() {
    if (!canSubmit) return;

    setIsSaving(true);
    try {
      await createTimeOff({
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        reason: draft.reason.trim() || undefined,
        professionalId: draft.professionalId || undefined,
      });

      // Se recarga y no se inserta en memoria: el backend normaliza los
      // instantes (00:00 y 23:59:59 en hora de Chile), asi que el objeto que
      // devuelve es la fuente de verdad, no lo que se envio.
      setBlocks(await listTimeOff());
      setDraft(emptyDraft());
      setShowForm(false);
      toast.success("Bloqueo creado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo crear el bloqueo."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(block: TimeOff) {
    setDeletingId(block.id);
    try {
      await removeTimeOff(block.id);
      setBlocks((current) =>
        current ? current.filter((item) => item.id !== block.id) : current,
      );
      toast.success("Bloqueo eliminado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo eliminar el bloqueo."));
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * Fechas de feriado que AUN no estan bloqueadas.
   *
   * Se descartan las ya bloqueadas para que la lista no ofrezca algo que ya
   * esta hecho: volver a crearlo duplicaria el bloqueo.
   */
  const pendingHolidays = useMemo(() => {
    const blockedDays = new Set(
      (blocks ?? []).map((block) => instantToLocalDate(block.startsAt)),
    );

    return holidays.filter((holiday) => !blockedDays.has(holiday.date));
  }, [holidays, blocks]);

  function toggleHoliday(date: string) {
    setPickedHolidays((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  /**
   * Crea un bloqueo por cada feriado marcado.
   *
   * Se crean UNO A UNO y no en una peticion con lista: el endpoint de bloqueos
   * acepta un rango, no varios. Son unos pocos al ano, asi que el coste es
   * despreciable, y si uno falla el resto queda creado (se informa de cuantos
   * pasaron).
   */
  async function handleAddHolidays() {
    if (pickedHolidays.size === 0) return;

    setIsAddingHolidays(true);
    let created = 0;
    let failed = 0;

    try {
      for (const holiday of pendingHolidays) {
        if (!pickedHolidays.has(holiday.date)) continue;

        try {
          await createTimeOff({
            startsOn: holiday.date,
            endsOn: holiday.date,
            reason: holiday.title,
          });
          created += 1;
        } catch {
          failed += 1;
        }
      }

      setBlocks(await listTimeOff());
      setPickedHolidays(new Set());
      setShowHolidays(false);

      if (failed === 0) {
        toast.success(
          created === 1 ? "Feriado añadido" : `${created} feriados añadidos`,
        );
      } else {
        // Se dice cuantos pasaron: callarlo haria creer que se aplicaron todos.
        toast.error(
          `${created} añadidos, ${failed} fallaron. Revisa la lista e inténtalo de nuevo.`,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudieron añadir los feriados."));
    } finally {
      setIsAddingHolidays(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-red-500/40 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (blocks === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-stone-400">
          Cargando bloqueos...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <CalendarOff className="h-5 w-5 text-amber-300" />
            Feriados y vacaciones
          </h1>
          <p className="mt-1 max-w-xl text-sm text-stone-400">
            Días en que no atiendes: feriados, vacaciones o un cierre puntual.
            En esas fechas tu agenda no ofrece ninguna hora.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* El atajo de feriados solo se ofrece si la fuente respondio. Si no,
              el boton ni aparece: no hay nada que sugerir. */}
          {holidaysAvailable && pendingHolidays.length > 0 ? (
            <button
              type="button"
              data-toggle-holidays="true"
              onClick={() => setShowHolidays((current) => !current)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-700 px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Añadir feriados
            </button>
          ) : null}

          <button
            type="button"
            data-new-timeoff="true"
            onClick={() => setShowForm((current) => !current)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir bloqueo
          </button>
        </div>
      </header>

      {/* Sugerencias de feriados nacionales. NO se aplican solas: el cliente
          marca las que quiera. Un negocio puede trabajar un feriado (una
          barberia el 1 de mayo), y cerrarsela sin pedirlo seria un error que
          descubriria por una queja. */}
      {showHolidays ? (
        <div
          data-holidays-panel="true"
          className="mb-6 rounded-2xl border border-stone-800 bg-stone-950/60 p-5"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white">
                Feriados nacionales
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                Marca los que quieras bloquear. Los irrenunciables no se pueden
                trabajar, pero igual decides tú si los añades.
              </p>
            </div>

            <button
              type="button"
              data-pick-all-holidays="true"
              onClick={() =>
                setPickedHolidays(
                  pickedHolidays.size === pendingHolidays.length
                    ? new Set()
                    : new Set(pendingHolidays.map((h) => h.date)),
                )
              }
              className="text-[11px] font-semibold text-stone-400 transition hover:text-white"
            >
              {pickedHolidays.size === pendingHolidays.length
                ? "Quitar selección"
                : "Seleccionar todos"}
            </button>
          </div>

          <ul className="max-h-72 overflow-y-auto rounded-xl border border-stone-800">
            {pendingHolidays.map((holiday, index) => (
              <li
                key={holiday.date}
                className={index > 0 ? "border-t border-stone-800" : ""}
              >
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-stone-900/60">
                  <input
                    type="checkbox"
                    data-holiday-date={holiday.date}
                    checked={pickedHolidays.has(holiday.date)}
                    onChange={() => toggleHoliday(holiday.date)}
                    className="h-4 w-4 shrink-0 rounded border-stone-700 bg-stone-800"
                  />

                  <span className="w-32 shrink-0 text-xs text-stone-400">
                    {formatHolidayDate(holiday.date)}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-xs text-white">
                    {holiday.title}
                  </span>

                  {holiday.inalienable ? (
                    <span
                      title="Irrenunciable: el comercio no puede abrir"
                      className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300"
                    >
                      Irrenunciable
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="mr-auto text-[11px] text-stone-500">
              {pickedHolidays.size === 0
                ? "Ninguno seleccionado"
                : `${pickedHolidays.size} seleccionados`}
            </span>

            <button
              type="button"
              onClick={() => {
                setShowHolidays(false);
                setPickedHolidays(new Set());
              }}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800"
            >
              Cancelar
            </button>

            <button
              type="button"
              data-confirm-holidays="true"
              disabled={pickedHolidays.size === 0 || isAddingHolidays}
              onClick={() => void handleAddHolidays()}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isAddingHolidays
                ? "Añadiendo..."
                : `Bloquear ${pickedHolidays.size || ""}`.trim()}
            </button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div
          data-timeoff-form="true"
          className="mb-6 rounded-2xl border border-stone-800 bg-stone-950/60 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Desde
              </span>
              <input
                type="date"
                data-timeoff-start="true"
                value={draft.startsOn}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    startsOn: e.target.value,
                    // El fin sigue al inicio mientras el cliente no lo cambie:
                    // el caso comun es un solo dia.
                    endsOn:
                      d.endsOn && d.endsOn >= e.target.value
                        ? d.endsOn
                        : e.target.value,
                  }))
                }
                className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Hasta
              </span>
              <input
                type="date"
                data-timeoff-end="true"
                value={draft.endsOn}
                min={draft.startsOn || undefined}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, endsOn: e.target.value }))
                }
                className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Motivo (opcional)
              </span>
              <input
                data-timeoff-reason="true"
                value={draft.reason}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, reason: e.target.value }))
                }
                placeholder="Feriado nacional"
                className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white placeholder-stone-600 outline-none focus:border-amber-400"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                A quién afecta
              </span>
              <select
                data-timeoff-professional="true"
                value={draft.professionalId}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, professionalId: e.target.value }))
                }
                className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
              >
                <option value="">Todo el negocio</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 text-[11px] text-stone-500">
            Se bloquean los días completos, de 00:00 a 23:59 (hora de{" "}
            {BUSINESS_TIME_ZONE === "America/Santiago"
              ? "Chile"
              : BUSINESS_TIME_ZONE}
            ).
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setDraft(emptyDraft());
              }}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-create-timeoff="true"
              disabled={!canSubmit || isSaving}
              onClick={() => void handleCreate()}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Guardando..." : "Bloquear fechas"}
            </button>
          </div>
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <div className="rounded-2xl border border-stone-800 bg-stone-950/40 p-10 text-center">
          <Ban className="mx-auto mb-3 h-6 w-6 text-stone-600" />
          <p className="text-sm text-stone-400">No tienes bloqueos próximos.</p>
          <p className="mt-1 text-[11px] text-stone-500">
            Tu agenda sigue el horario de atención en todas las fechas.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-stone-800">
          {blocks.map((block, index) => {
            const who = professionalName(block.professionalId);
            const isPast = !isOngoing(block);

            return (
              <li
                key={block.id}
                data-timeoff-id={block.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                  index > 0 ? "border-t border-stone-800" : ""
                } ${isPast ? "bg-stone-950/40" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                    {formatRange(block.startsAt, block.endsAt)}
                    {isOngoing(block) ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                        En curso
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                    {block.reason ? <span>{block.reason}</span> : null}
                    <span className="text-stone-600">
                      {daysBetween(block)}{" "}
                      {daysBetween(block) === 1 ? "día" : "días"}
                    </span>
                  </p>

                  {/* Alcance: se distingue el negocio entero de un profesional
                      porque el efecto es muy distinto, y confundirlos hace que
                      el cliente bloquee toda su agenda sin querer. */}
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                    {who ? (
                      <>
                        <Users className="h-3 w-3 text-stone-500" />
                        <span className="text-stone-400">Solo {who}</span>
                      </>
                    ) : (
                      <>
                        <Ban className="h-3 w-3 text-amber-300" />
                        <span className="font-semibold text-amber-300">
                          Todo el negocio
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  data-remove-timeoff={block.id}
                  onClick={() => void handleDelete(block)}
                  disabled={deletingId === block.id}
                  title="Quitar el bloqueo"
                  className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-800 hover:text-red-300 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
