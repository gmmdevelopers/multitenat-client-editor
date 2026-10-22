"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clock, Copy } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { canEditSection } from "@/lib/role-routing";
import { ReadOnlyNotice } from "@/components/ReadOnlySection";
import { getErrorMessage } from "@/lib/api/errors";
import {
  DAY_NAMES,
  WEEK_ORDER,
  getBusinessHours,
  updateBusinessHours,
  type BusinessHoursDay,
} from "@/lib/api/schedule";

/**
 * Horario de atencion del negocio.
 *
 * Es la FUENTE DE VERDAD de la disponibilidad: el backend lo lee al calcular
 * los huecos de cita, asi que un horario mal puesto no da un error, hace que
 * desaparezcan horas de la agenda publica. De ahi que cada dia muestre su
 * estado explicito ("Cerrado" / "Abierto") y no solo las horas.
 *
 * Se edita la SEMANA COMPLETA y se guarda de una vez, porque asi lo espera el
 * endpoint: enviar un dia suelto dejaria la agenda en estados intermedios.
 */

/** Fila editable de la pantalla. Las horas son texto mientras se editan. */
interface DayDraft {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
}

/** Horario por defecto de un dia que nunca se configuro. */
const DEFAULT_OPENS_AT = "09:00";
const DEFAULT_CLOSES_AT = "18:00";

/**
 * Convierte la respuesta del API en filas editables.
 *
 * `isOpen` es la NEGACION de `isClosed`, pero no basta con eso: un dia sin
 * configurar (`isConfigured: false`) tambien sale cerrado, y se le ponen las
 * horas por defecto para que al abrirlo el cliente no vea los campos vacios.
 */
function toDrafts(days: BusinessHoursDay[]): DayDraft[] {
  const byDay = new Map(days.map((day) => [day.dayOfWeek, day]));

  return WEEK_ORDER.map((dayOfWeek) => {
    const day = byDay.get(dayOfWeek);

    return {
      dayOfWeek,
      isOpen: day ? !day.isClosed : false,
      opensAt: day?.opensAt ?? DEFAULT_OPENS_AT,
      closesAt: day?.closesAt ?? DEFAULT_CLOSES_AT,
    };
  });
}

/** `09:00` -> 540 (minutos). Para comparar horas sin lidiar con strings. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Valida la semana antes de enviarla.
 *
 * Se comprueba en el cliente para dar un mensaje concreto, pero NO sustituye a
 * la validacion del backend: los `HH:mm` tambien se validan alli.
 */
function findProblem(drafts: DayDraft[]): string | null {
  for (const draft of drafts) {
    if (!draft.isOpen) continue;

    const name = DAY_NAMES[draft.dayOfWeek];

    if (toMinutes(draft.closesAt) <= toMinutes(draft.opensAt)) {
      // Cerrar antes de abrir (o a la misma hora) crearia un dia sin huecos,
      // que es justo el fallo silencioso que hay que evitar aqui.
      return `${name}: la hora de cierre debe ser posterior a la de apertura.`;
    }
  }

  return null;
}

export default function BusinessHoursPage() {
  const toast = useToast();
  const { user } = useAuth();

  /**
   * El horario del NEGOCIO solo lo editan `owner` y `admin`.
   *
   * Recepcion lo ve para poder responder consultas, pero cambiarlo afecta a la
   * agenda entera: es una regla, no una excepcion.
   */
  const canEdit = user ? canEditSection(user.role, "hours") : false;

  const [drafts, setDrafts] = useState<DayDraft[] | null>(null);
  const [saved, setSaved] = useState<DayDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getBusinessHours()
      .then((result) => {
        const next = toDrafts(result.days);
        setDrafts(next);
        // Se guarda una copia para detectar cambios sin comparar contra el
        // servidor en cada tecla: `saved` es el "ultimo estado confirmado".
        setSaved(next);
      })
      .catch((err) =>
        setError(getErrorMessage(err, "No se pudo cargar el horario.")),
      );
  }, []);

  const hasChanges = useMemo(() => {
    if (!drafts || !saved) return false;

    return JSON.stringify(drafts) !== JSON.stringify(saved);
  }, [drafts, saved]);

  const openDays = drafts?.filter((day) => day.isOpen).length ?? 0;

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
   * Copia el horario de un dia al resto de dias abiertos.
   *
   * Es el atajo que hace usable la pantalla: casi todos los negocios abren de
   * lunes a viernes con la MISMA hora, y sin esto habria que rellenar 5 filas a
   * mano. Solo copia a los dias ya abiertos: pisar los cerrados los abriria,
   * que no es lo que se pidio.
   */
  function applyToOpenDays(source: DayDraft) {
    setDrafts((current) =>
      current
        ? current.map((day) =>
            day.isOpen
              ? {
                  ...day,
                  opensAt: source.opensAt,
                  closesAt: source.closesAt,
                }
              : day,
          )
        : current,
    );
  }

  async function handleSave() {
    if (!drafts) return;

    const problem = findProblem(drafts);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateBusinessHours(
        // Se envian SIEMPRE los 7 dias, tambien los cerrados: los que no se
        // envian quedan cerrados igual, pero mandarlos deja claro en el log que
        // la semana entera se reemplazo.
        drafts.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          opensAt: day.opensAt,
          closesAt: day.closesAt,
          isClosed: !day.isOpen,
        })),
      );

      const next = toDrafts(result.days);
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
        <div className="max-w-md rounded-xl border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (drafts === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-muted">
          Cargando horario...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <CalendarClock className="h-5 w-5 text-accent-strong" />
            Horario de atención
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Cuándo estás disponible para recibir citas. Los pacientes solo pueden
            agendar dentro de este horario.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            data-save-hours="true"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? "Guardando..." : "Guardar horario"}
          </button>
        ) : null}
      </header>

      {/*
        Aviso de solo lectura.

        El horario de atencion define la REGLA SEMANAL del negocio entero: si
        recepcion lo cambiara por error, la agenda dejaria de ofrecer horas a
        todos. Se ve (para poder responder "¿abren los sabados?") pero no se
        toca.
      */}
      {canEdit ? null : (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      {/* Aviso de semana vacia: si todos los dias estan cerrados, la agenda
          publica no ofrece NINGUNA hora. Es un estado valido (el negocio puede
          cerrar una temporada), pero casi siempre es un error, y sin aviso se
          descubriria por una queja de un paciente. */}
      {openDays === 0 ? (
        <div className="mb-5 rounded-xl border-accent/40 bg-accent/10 p-4 text-xs leading-relaxed text-accent-strong">
          <strong className="font-bold">Todos los días están cerrados.</strong>{" "}
          Tu agenda no ofrecerá ninguna hora a los pacientes y no podrán
          agendar. Ábrete al menos un día si quieres recibir citas.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-line">
        {drafts.map((day, index) => (
          <div
            key={day.dayOfWeek}
            data-day={day.dayOfWeek}
            data-day-open={day.isOpen ? "true" : "false"}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
              index > 0 ? "border-t border-line" : ""
            } ${day.isOpen ? "" : "bg-background/40"}`}
          >
            {/* Interruptor abierto/cerrado. Se usa un checkbox y no un boton
                "Estado" porque es un dato booleano con dos posiciones, y asi el
                teclado y los lectores de pantalla lo entienden solos. */}
            <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                data-day-toggle={day.dayOfWeek}
                checked={day.isOpen}
                disabled={!canEdit}
                onChange={(e) =>
                  updateDay(day.dayOfWeek, { isOpen: e.target.checked })
                }
                className="h-4 w-4 rounded border-line-strong bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span
                className={`text-sm font-semibold ${
                  day.isOpen ? "text-foreground" : "text-text-subtle"
                }`}
              >
                {DAY_NAMES[day.dayOfWeek]}
              </span>
            </label>

            {day.isOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-text-subtle" />
                  <input
                    type="time"
                    data-day-opens={day.dayOfWeek}
                    value={day.opensAt}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateDay(day.dayOfWeek, { opensAt: e.target.value })
                    }
                    className="rounded-lg border border-line-strong bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <span className="text-xs text-text-subtle">a</span>
                  <input
                    type="time"
                    data-day-closes={day.dayOfWeek}
                    value={day.closesAt}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateDay(day.dayOfWeek, { closesAt: e.target.value })
                    }
                    className="rounded-lg border border-line-strong bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="button"
                  data-apply-to-open={day.dayOfWeek}
                  onClick={() => applyToOpenDays(day)}
                  disabled={!canEdit}
                  title="Copiar este horario al resto de días abiertos"
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Copy className="h-3 w-3" />
                  Copiar al resto
                </button>
              </>
            ) : (
              <span className="text-xs text-text-subtle">Cerrado</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-[11px] text-text-subtle">
          {openDays === 7
            ? "Abierto los 7 días"
            : `Abierto ${openDays} ${openDays === 1 ? "día" : "días"} a la semana`}
        </p>

        {hasChanges ? (
          <span className="text-[11px] font-semibold text-accent-strong">
            Cambios sin guardar
          </span>
        ) : (
          <span className="text-[11px] text-text-subtle">Todo guardado</span>
        )}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-text-subtle">
        El horario de cada profesional se configura en{" "}
        <strong className="text-muted">Profesionales</strong>: sus días
        sobrescriben estos, y el resto los heredan.
      </p>
    </div>
  );
}
