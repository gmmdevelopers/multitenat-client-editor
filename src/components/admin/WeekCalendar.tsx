"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  CalendarAppointment,
  CalendarProfessional,
} from "@/lib/api/calendar";
import {
  addDays,
  formatDayLabel,
  formatTime,
  isSameDay,
  minutesFromMidnight,
  startOfWeek,
  weekDays,
} from "@/lib/calendar-dates";

/** Rango de horas que pinta la rejilla. */
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

/** Alto de una hora en pixeles. La rejilla se posiciona con esta base. */
const HOUR_HEIGHT = 64;

const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR + 1;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

/** Colores por estado, para leer la agenda de un vistazo. */
const STATUS_STYLES: Record<string, string> = {
  confirmed: "border-emerald-500/50 bg-emerald-500/15 text-emerald-100",
  held: "border-amber-400/50 bg-amber-400/15 text-amber-100",
  pending_payment: "border-orange-500/50 bg-orange-500/15 text-orange-100",
  in_progress: "border-blue-500/50 bg-blue-500/15 text-blue-100",
  completed: "border-stone-600 bg-stone-700/40 text-stone-300",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-200 line-through",
  no_show: "border-red-500/40 bg-red-500/10 text-red-200",
  failed_payment: "border-red-500/40 bg-red-500/10 text-red-200",
  draft: "border-stone-700 bg-stone-800/40 text-stone-400",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  held: "Retenida",
  pending_payment: "Pago pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  failed_payment: "Pago fallido",
  draft: "Borrador",
};

interface WeekCalendarProps {
  weekStart: Date;
  onWeekChange: (next: Date) => void;
  appointments: CalendarAppointment[];
  professionals: CalendarProfessional[];
  onSelectAppointment?: (appointment: CalendarAppointment) => void;
  /**
   * Clic en un hueco vacio de la rejilla.
   *
   * Recibe el profesional de la columna y el instante exacto que corresponde a
   * la posicion vertical del clic, ya redondeado a la media hora.
   */
  onSlotClick?: (params: {
    professional: CalendarProfessional;
    startsAt: Date;
  }) => void;
}

/**
 * Calendario semanal, con los profesionales como TABS.
 *
 * Se muestra UN profesional a la vez, ocupando todo el ancho. Antes se pintaban
 * todos en columnas lado a lado, y con tres o mas cada una quedaba en ~200px:
 * los siete dias no cabian y las citas se solapaban visualmente.
 *
 * Con tabs, la rejilla aprovecha la pantalla entera. El cambio es instantaneo
 * porque todas las citas de la semana ya estan cargadas: no se pide nada al
 * backend al cambiar de profesional.
 */
export function WeekCalendar({
  weekStart,
  onWeekChange,
  appointments,
  professionals,
  onSelectAppointment,
  onSlotClick,
}: WeekCalendarProps) {
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const [activeId, setActiveId] = useState<string | null>(
    professionals[0]?.id ?? null,
  );

  // Si el profesional activo desaparece (se borro, cambio la lista), se cae al
  // primero en vez de dejar la rejilla vacia sin explicacion.
  const active =
    professionals.find((p) => p.id === activeId) ?? professionals[0] ?? null;

  const hours = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i),
    [],
  );

  const today = new Date();

  const visibleAppointments = active
    ? appointments.filter((a) => a.professionalId === active.id)
    : [];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Cabecera: navegacion de semana */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-calendar-prev="true"
            onClick={() => onWeekChange(addDays(weekStart, -7))}
            aria-label="Semana anterior"
            className="rounded-lg border border-stone-700 p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            data-calendar-today="true"
            onClick={() => onWeekChange(startOfWeek(new Date()))}
            className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            Hoy
          </button>

          <button
            type="button"
            data-calendar-next="true"
            onClick={() => onWeekChange(addDays(weekStart, 7))}
            aria-label="Semana siguiente"
            className="rounded-lg border border-stone-700 p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <p className="ml-2 text-xs font-semibold text-stone-300">
            {weekStart.toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
            })}
            {" – "}
            {addDays(weekStart, 6).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <p className="text-[11px] text-stone-500">
          {visibleAppointments.length}{" "}
          {visibleAppointments.length === 1 ? "cita" : "citas"} esta semana
        </p>
      </div>

      {professionals.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-stone-300">
            No hay profesionales todavía
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-stone-500">
            La agenda se organiza por profesional. Crea el primero para empezar
            a agendar.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs: un profesional a la vez, a ancho completo. */}
          <div
            data-calendar-tabs="true"
            className="flex flex-wrap items-center gap-1 border-b border-stone-800 px-4 py-2"
          >
            {professionals.map((professional) => {
              const isActive = professional.id === active?.id;
              const count = appointments.filter(
                (a) => a.professionalId === professional.id,
              ).length;

              return (
                <button
                  key={professional.id}
                  type="button"
                  data-calendar-tab={professional.id}
                  onClick={() => setActiveId(professional.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-400 text-black"
                      : "text-stone-400 hover:bg-stone-800 hover:text-white"
                  } ${professional.isActive ? "" : "opacity-60"}`}
                >
                  <span className="truncate">{professional.name}</span>

                  {/* El conteo evita abrir cada tab para saber quien tiene carga. */}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      isActive
                        ? "bg-black/20 text-black"
                        : "bg-stone-800 text-stone-500"
                    }`}
                  >
                    {count}
                  </span>

                  {!professional.isActive ? (
                    <span
                      className={`rounded px-1 text-[9px] uppercase ${
                        isActive ? "bg-black/20" : "bg-stone-800 text-stone-500"
                      }`}
                    >
                      Inactivo
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {/* Encabezado de dias. `sticky` para no perder la referencia. */}
            <div className="sticky top-0 z-20 flex border-b border-stone-800 bg-stone-900">
              <div className="w-16 shrink-0 border-r border-stone-800" />

              {days.map((day, index) => {
                const count = visibleAppointments.filter((a) =>
                  isSameDay(new Date(a.startsAt), day),
                ).length;

                return (
                  <div
                    key={day.toISOString()}
                    data-calendar-day={index}
                    className={`min-w-0 flex-1 border-r border-stone-800 px-1 py-1.5 text-center ${
                      isSameDay(day, today) ? "bg-amber-400/[0.06]" : ""
                    }`}
                  >
                    <p
                      className={`text-[11px] font-semibold ${
                        isSameDay(day, today)
                          ? "text-amber-300"
                          : "text-stone-300"
                      }`}
                    >
                      {formatDayLabel(day).replace(".", "")}
                    </p>
                    <p
                      className={`text-[9px] ${
                        count > 0 ? "text-stone-500" : "text-stone-700"
                      }`}
                    >
                      {count > 0 ? `${count} ${count === 1 ? "cita" : "citas"}` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Rejilla: columna de horas + 7 dias a ancho completo */}
            <div className="flex">
              <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-stone-800 bg-stone-900">
                <div className="relative" style={{ height: TOTAL_HEIGHT }}>
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-2 -translate-y-1/2 text-[10px] text-stone-500"
                      style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
              </div>

              <div
                data-calendar-grid="true"
                className="relative min-w-0 flex-1"
                style={{ height: TOTAL_HEIGHT }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-stone-800/60"
                    style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}

                {days.map((day, index) => {
                  const dayAppointments = visibleAppointments.filter((a) =>
                    isSameDay(new Date(a.startsAt), day),
                  );

                  return (
                    <div
                      key={day.toISOString()}
                      data-calendar-day-column={index}
                      onClick={(event) => {
                        // Un clic sobre una CITA no llega aqui: el bloque
                        // detiene la propagacion. Lo que llega es un clic en
                        // el hueco vacio de la columna.
                        if (!onSlotClick || !active) return;

                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        const offsetY = event.clientY - rect.top;

                        // La posicion vertical se traduce a minutos y se
                        // redondea a la media hora: pedir precision al minuto
                        // haria imposible acertar con el raton.
                        const rawMinutes =
                          DAY_START_HOUR * 60 +
                          (offsetY / HOUR_HEIGHT) * 60;
                        const snapped = Math.floor(rawMinutes / 30) * 30;

                        const startsAt = new Date(day);
                        startsAt.setHours(0, snapped, 0, 0);

                        onSlotClick({ professional: active, startsAt });
                      }}
                      className={`absolute top-0 h-full border-l border-stone-800/40 ${
                        isSameDay(day, today) ? "bg-amber-400/[0.04]" : ""
                      } ${onSlotClick ? "cursor-pointer" : ""}`}
                      style={{
                        left: `${(index / 7) * 100}%`,
                        width: `${100 / 7}%`,
                      }}
                    >
                      {dayAppointments.map((appointment) => (
                        <AppointmentBlock
                          key={appointment.id}
                          appointment={appointment}
                          onClick={() => onSelectAppointment?.(appointment)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Un evento en la rejilla.
 *
 * Se posiciona con `top` y `height` calculados sobre los minutos, y no con un
 * grid, porque las citas pueden solaparse parcialmente: dos de 30 minutos que
 * empiezan a y media y a las y cuarto no encajan en celdas de una hora.
 */
function AppointmentBlock({
  appointment,
  onClick,
}: {
  appointment: CalendarAppointment;
  onClick: () => void;
}) {
  const startsAt = new Date(appointment.startsAt);
  const endsAt = new Date(appointment.endsAt);

  const startMinutes = minutesFromMidnight(startsAt);
  const endMinutes = minutesFromMidnight(endsAt);

  const top = ((startMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);

  // Fuera del rango visible: se omite en vez de dibujarlo fuera de la rejilla,
  // donde quedaria inalcanzable.
  if (top + height < 0 || top > TOTAL_HEIGHT) return null;

  const style = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.draft;

  return (
    <button
      type="button"
      data-appointment={appointment.id}
      onClick={(event) => {
        // OBLIGATORIO: el evento burbujea hasta la columna del dia, que tiene su
        // propio `onClick` para crear una cita en el hueco. Sin detenerlo, un
        // clic sobre una cita abria su detalle Y el modal de crear a la vez, y
        // al cerrar el primero quedaba el segundo sobre el mismo horario ya
        // ocupado.
        event.stopPropagation();
        onClick();
      }}
      title={`${appointment.patientName} · ${formatTime(startsAt)}–${formatTime(endsAt)} · ${appointment.boxName} · ${STATUS_LABELS[appointment.status] ?? appointment.status}`}
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-2 py-1 text-left text-[11px] leading-tight transition hover:brightness-125 ${style}`}
      style={{ top, height }}
    >
      <span className="block truncate font-semibold">
        {formatTime(startsAt)} {appointment.patientName}
      </span>
      {height > 34 ? (
        <span className="block truncate opacity-80">{appointment.boxName}</span>
      ) : null}
      {height > 52 ? (
        <span className="block truncate opacity-60">
          {STATUS_LABELS[appointment.status] ?? appointment.status}
        </span>
      ) : null}
    </button>
  );
}
