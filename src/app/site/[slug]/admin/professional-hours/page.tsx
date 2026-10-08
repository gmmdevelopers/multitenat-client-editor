"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Clock,
  Coffee,
  UserRound,
  Users,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { listProfessionals, type Professional } from "@/lib/api/professionals";
import {
  DAY_NAMES,
  WEEK_ORDER,
  getBusinessHours,
  getProfessionalSchedule,
  updateProfessionalSchedule,
  type BusinessHoursDay,
  type ProfessionalScheduleDay,
} from "@/lib/api/schedule";

/**
 * Horario propio de cada profesional.
 *
 * El concepto que hay que dejar claro en pantalla es la HERENCIA:
 *
 *   - Un dia SIN excepcion hereda el horario del negocio. Si el negocio cambia
 *     de hora, ese dia cambia solo.
 *   - Un dia CON excepcion tiene horas propias y ya no sigue al negocio.
 *
 * Confundir las dos cosas es el error caro: el cliente cambia el horario del
 * negocio y no entiende por que la agenda de alguien no se movio. Por eso cada
 * dia dice EXPLICITAMENTE si hereda o si es propio, y las horas heredadas se
 * muestran como referencia (no editables hasta marcar el dia como propio).
 */

/** Fila editable. Las horas son texto mientras se editan. */
interface DayDraft {
  dayOfWeek: number;
  /** `true` = excepcion propia. `false` = hereda del negocio. */
  isCustom: boolean;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
  hasBreak: boolean;
  breakStartsAt: string;
  breakEndsAt: string;
}

/** Horas que se usan al crear una excepcion en un dia que no tenia ninguna. */
const DEFAULT_OPENS_AT = "09:00";
const DEFAULT_CLOSES_AT = "18:00";
const DEFAULT_BREAK_START = "13:00";
const DEFAULT_BREAK_END = "14:00";

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convierte la respuesta del API en filas editables.
 *
 * `businessDays` se usa para rellenar los dias HEREDADOS: el backend ya manda
 * las horas heredadas en `opensAt`/`closesAt`, asi que solo hace falta el
 * respaldo cuando el negocio tampoco tiene ese dia configurado.
 */
function toDrafts(
  days: ProfessionalScheduleDay[],
  businessDays: BusinessHoursDay[],
): DayDraft[] {
  const byDay = new Map(days.map((day) => [day.dayOfWeek, day]));
  const business = new Map(businessDays.map((day) => [day.dayOfWeek, day]));

  return WEEK_ORDER.map((dayOfWeek) => {
    const day = byDay.get(dayOfWeek);
    const businessDay = business.get(dayOfWeek);

    return {
      dayOfWeek,
      isCustom: day?.isCustom ?? false,
      // `??` y `||` no se pueden mezclar sin parentesis: aqui el orden importa
      // (el `||` decide el caso de horario no configurado, el `??` el ausente).
      isClosed: day?.isClosed ?? (!businessDay || businessDay.isClosed),
      opensAt:
        day?.opensAt ?? businessDay?.opensAt ?? DEFAULT_OPENS_AT,
      closesAt:
        day?.closesAt ?? businessDay?.closesAt ?? DEFAULT_CLOSES_AT,
      hasBreak: Boolean(day?.breakStartsAt && day?.breakEndsAt),
      breakStartsAt: day?.breakStartsAt ?? DEFAULT_BREAK_START,
      breakEndsAt: day?.breakEndsAt ?? DEFAULT_BREAK_END,
    };
  });
}

/** Valida la semana antes de enviarla, para dar un mensaje concreto. */
function findProblem(drafts: DayDraft[]): string | null {
  for (const draft of drafts) {
    // Solo se validan los dias que se van a GUARDAR: los heredados no se
    // envian, y quejarse de ellos seria bloquear por algo que no se edita.
    if (!draft.isCustom) continue;

    const name = DAY_NAMES[draft.dayOfWeek];

    if (!draft.isClosed && toMinutes(draft.closesAt) <= toMinutes(draft.opensAt)) {
      return `${name}: la hora de cierre debe ser posterior a la de apertura.`;
    }

    if (draft.hasBreak) {
      if (toMinutes(draft.breakEndsAt) <= toMinutes(draft.breakStartsAt)) {
        return `${name}: el descanso debe terminar después de empezar.`;
      }

      if (
        toMinutes(draft.breakStartsAt) < toMinutes(draft.opensAt) ||
        toMinutes(draft.breakEndsAt) > toMinutes(draft.closesAt)
      ) {
        return `${name}: el descanso tiene que estar dentro del horario.`;
      }
    }
  }

  return null;
}

export default function ProfessionalSchedulePage() {
  const toast = useToast();

  const [professionals, setProfessionals] = useState<Professional[] | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [drafts, setDrafts] = useState<DayDraft[] | null>(null);
  const [saved, setSaved] = useState<DayDraft[] | null>(null);
  const [businessDays, setBusinessDays] = useState<BusinessHoursDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDays, setIsLoadingDays] = useState(false);

  // Carga inicial: profesionales + horario del negocio (para mostrar la
  // herencia como referencia).
  useEffect(() => {
    void Promise.all([listProfessionals(), getBusinessHours()])
      .then(([professionalList, hours]) => {
        const active = professionalList.items.filter((p) => p.isActive);
        setProfessionals(active);
        setBusinessDays(hours.days);
        // Se selecciona el primero: una pantalla vacia obliga a un clic extra
        // para ver lo que ya se sabe que se quiere ver.
        if (active.length > 0) setSelectedId(active[0].id);
      })
      .catch((err) =>
        setError(getErrorMessage(err, "No se pudo cargar la información.")),
      );
  }, []);

  // Al cambiar de profesional se recarga su horario.
  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;
    setIsLoadingDays(true);

    void getProfessionalSchedule(selectedId)
      .then((result) => {
        if (cancelled) return;
        const next = toDrafts(result.days, businessDays);
        setDrafts(next);
        setSaved(next);
      })
      .catch((err) =>
        toast.error(
          getErrorMessage(err, "No se pudo cargar el horario del profesional."),
        ),
      )
      .finally(() => {
        if (!cancelled) setIsLoadingDays(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, businessDays, toast]);

  const hasChanges = useMemo(() => {
    if (!drafts || !saved) return false;

    return JSON.stringify(drafts) !== JSON.stringify(saved);
  }, [drafts, saved]);

  const selected = professionals?.find((p) => p.id === selectedId) ?? null;
  const customCount = drafts?.filter((day) => day.isCustom).length ?? 0;

  function updateDay(dayOfWeek: number, patch: Partial<DayDraft>) {
    setDrafts((current) =>
      current
        ? current.map((day) =>
            day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day,
          )
        : current,
    );
  }

  /**
   * Convierte un dia heredado en excepcion propia.
   *
   * Se arranca con las horas HEREDADAS y no con las por defecto: el caso normal
   * es "trabaja como el negocio, pero este dia distinto", asi que empezar de
   * cero obligaria a reescribir lo que ya estaba bien.
   */
  function makeCustom(day: DayDraft) {
    const inherited = businessDays.find((d) => d.dayOfWeek === day.dayOfWeek);

    updateDay(day.dayOfWeek, {
      isCustom: true,
      opensAt: inherited?.opensAt ?? day.opensAt,
      closesAt: inherited?.closesAt ?? day.closesAt,
      isClosed: inherited ? inherited.isClosed : day.isClosed,
    });
  }

  async function handleSave() {
    if (!drafts || !selectedId) return;

    const problem = findProblem(drafts);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProfessionalSchedule(
        selectedId,
        // Solo se envian los dias CON excepcion: los que no van se borran y
        // vuelven a heredar, que es justo lo que significa quitar el dia.
        drafts
          .filter((day) => day.isCustom)
          .map((day) => ({
            dayOfWeek: day.dayOfWeek,
            opensAt: day.opensAt,
            closesAt: day.closesAt,
            breakStartsAt: day.hasBreak ? day.breakStartsAt : null,
            breakEndsAt: day.hasBreak ? day.breakEndsAt : null,
            isClosed: day.isClosed,
          })),
      );

      const next = toDrafts(result.days, businessDays);
      setDrafts(next);
      setSaved(next);
      toast.success("Horario guardado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el horario."));
    } finally {
      setIsSaving(false);
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

  if (professionals === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-stone-400">
          Cargando profesionales...
        </span>
      </div>
    );
  }

  // Sin profesionales no hay nada que configurar, y el aviso manda a la
  // pantalla donde se crean.
  if (professionals.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Users className="h-5 w-5 text-amber-300" />
            Horario por profesional
          </h1>
        </header>
        <div className="rounded-2xl border border-stone-800 bg-stone-950/40 p-10 text-center">
          <UserRound className="mx-auto mb-3 h-6 w-6 text-stone-600" />
          <p className="text-sm text-stone-400">
            Todavía no tienes profesionales activos.
          </p>
          <p className="mt-1 text-[11px] text-stone-500">
            Créalos en la sección Profesionales y vuelve aquí para ajustar sus
            horarios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Users className="h-5 w-5 text-amber-300" />
            Horario por profesional
          </h1>
          <p className="mt-1 max-w-xl text-sm text-stone-400">
            Por defecto todos siguen el horario del negocio. Aquí puedes darle a
            alguien un horario distinto.
          </p>
        </div>

        <button
          type="button"
          data-save-professional-hours="true"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges || !drafts}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          {isSaving ? "Guardando..." : "Guardar horario"}
        </button>
      </header>

      {/* Selector de profesional */}
      <label className="mb-5 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Profesional
        </span>
        <select
          data-professional-select="true"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full max-w-sm rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
        >
          {professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.firstName} {professional.lastName}
            </option>
          ))}
        </select>
      </label>

      {isLoadingDays || !drafts ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-stone-400">
            Cargando horario...
          </span>
        </div>
      ) : (
        <>
          {/* Resumen del estado: cuantas excepciones tiene. Es el dato que
              explica de un vistazo por que su agenda difiere de la del negocio. */}
          <div className="mb-4 rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-3">
            <p className="text-[11px] text-stone-400">
              {customCount === 0 ? (
                <>
                  <strong className="font-semibold text-white">
                    {selected?.firstName} sigue el horario del negocio
                  </strong>{" "}
                  todos los días. Si cambias el horario de atención, su agenda
                  cambia con él.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-white">
                    {customCount}{" "}
                    {customCount === 1 ? "día con horario propio" : "días con horario propio"}
                  </strong>
                  . El resto sigue el horario del negocio.
                </>
              )}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-800">
            {drafts.map((day, index) => {
              const inherited = businessDays.find(
                (d) => d.dayOfWeek === day.dayOfWeek,
              );

              return (
                <div
                  key={day.dayOfWeek}
                  data-prof-day={day.dayOfWeek}
                  data-is-custom={day.isCustom ? "true" : "false"}
                  className={`px-4 py-3 ${
                    index > 0 ? "border-t border-stone-800" : ""
                  } ${day.isCustom ? "" : "bg-stone-950/40"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`w-32 shrink-0 text-sm font-semibold ${
                        day.isCustom ? "text-white" : "text-stone-500"
                      }`}
                    >
                      {DAY_NAMES[day.dayOfWeek]}
                    </span>

                    {day.isCustom ? (
                      <>
                        {/* Día propio: editable. */}
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            data-prof-open={day.dayOfWeek}
                            checked={!day.isClosed}
                            onChange={(e) =>
                              updateDay(day.dayOfWeek, {
                                isClosed: !e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-stone-700 bg-stone-800"
                          />
                          <span className="text-xs text-stone-400">
                            {day.isClosed ? "Cerrado" : "Abierto"}
                          </span>
                        </label>

                        {!day.isClosed ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-stone-500" />
                            <input
                              type="time"
                              data-prof-opens={day.dayOfWeek}
                              value={day.opensAt}
                              onChange={(e) =>
                                updateDay(day.dayOfWeek, {
                                  opensAt: e.target.value,
                                })
                              }
                              className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-400"
                            />
                            <span className="text-xs text-stone-500">a</span>
                            <input
                              type="time"
                              data-prof-closes={day.dayOfWeek}
                              value={day.closesAt}
                              onChange={(e) =>
                                updateDay(day.dayOfWeek, {
                                  closesAt: e.target.value,
                                })
                              }
                              className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-400"
                            />

                            {/* Descanso: vive en el horario del profesional y no
                                en el del negocio, porque el almuerzo de una
                                persona no coincide con el de otra. */}
                            <label className="ml-2 flex cursor-pointer items-center gap-1.5">
                              <input
                                type="checkbox"
                                data-prof-break={day.dayOfWeek}
                                checked={day.hasBreak}
                                onChange={(e) =>
                                  updateDay(day.dayOfWeek, {
                                    hasBreak: e.target.checked,
                                  })
                                }
                                className="h-3.5 w-3.5 rounded border-stone-700 bg-stone-800"
                              />
                              <Coffee className="h-3.5 w-3.5 text-stone-500" />
                              <span className="text-[11px] text-stone-400">
                                Descanso
                              </span>
                            </label>

                            {day.hasBreak ? (
                              <span className="flex items-center gap-2">
                                <input
                                  type="time"
                                  data-prof-break-start={day.dayOfWeek}
                                  value={day.breakStartsAt}
                                  onChange={(e) =>
                                    updateDay(day.dayOfWeek, {
                                      breakStartsAt: e.target.value,
                                    })
                                  }
                                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-400"
                                />
                                <span className="text-xs text-stone-500">a</span>
                                <input
                                  type="time"
                                  data-prof-break-end={day.dayOfWeek}
                                  value={day.breakEndsAt}
                                  onChange={(e) =>
                                    updateDay(day.dayOfWeek, {
                                      breakEndsAt: e.target.value,
                                    })
                                  }
                                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-400"
                                />
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          data-prof-revert={day.dayOfWeek}
                          onClick={() =>
                            updateDay(day.dayOfWeek, { isCustom: false })
                          }
                          title="Volver a heredar el horario del negocio"
                          className="ml-auto rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:bg-stone-800 hover:text-white"
                        >
                          Heredar del negocio
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Día heredado: NO editable. Se muestra como referencia
                            y un botón para convertirlo en excepción. */}
                        <span className="text-xs text-stone-500">
                          {inherited?.isClosed || !inherited ? (
                            "Cerrado (como el negocio)"
                          ) : (
                            <>
                              Hereda del negocio:{" "}
                              <span className="font-mono text-stone-400">
                                {inherited.opensAt} a {inherited.closesAt}
                              </span>
                            </>
                          )}
                        </span>

                        <button
                          type="button"
                          data-prof-customize={day.dayOfWeek}
                          onClick={() => makeCustom(day)}
                          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:bg-stone-800 hover:text-white"
                        >
                          <ArrowDownToLine className="h-3 w-3" />
                          Horario propio
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-end">
            {hasChanges ? (
              <span className="text-[11px] font-semibold text-amber-300">
                Cambios sin guardar
              </span>
            ) : (
              <span className="text-[11px] text-stone-500">Todo guardado</span>
            )}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-stone-500">
            Un día con horario propio <strong className="text-stone-400">ya no
            sigue al negocio</strong>: si más adelante cambias el horario de
            atención, ese día se queda como está. Para que vuelva a seguirlo,
            usa <strong className="text-stone-400">Heredar del negocio</strong>.
          </p>
        </>
      )}
    </div>
  );
}