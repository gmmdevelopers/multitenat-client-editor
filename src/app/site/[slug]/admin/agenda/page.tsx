"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import { WeekCalendar } from "@/components/admin/WeekCalendar";
import { NewAppointmentModal } from "@/components/admin/NewAppointmentModal";
import { AppointmentDetailModal } from "@/components/admin/AppointmentDetailModal";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  getCalendar,
  type CalendarAppointment,
  type CalendarProfessional,
} from "@/lib/api/calendar";
import { startOfWeek, weekRange } from "@/lib/calendar-dates";

/**
 * Agenda del negocio: vista semanal con una columna por profesional.
 *
 * La semana se pide COMPLETA al backend en una sola llamada. Al cambiar de
 * semana se vuelve a pedir solo el rango nuevo: cargar todo el historial de una
 * vez no aporta y hace lenta la primera pantalla.
 */
export default function AgendaPage() {
  const toast = useToast();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [professionals, setProfessionals] = useState<CalendarProfessional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Hueco donde se hizo clic, para abrir el modal de nueva cita.
   *
   * Se guarda el profesional Y el instante: el modal los necesita para
   * preseleccionar la columna y calcular la hora de termino con el servicio.
   */
  const [slotDraft, setSlotDraft] = useState<{
    professional: CalendarProfessional;
    startsAt: Date;
  } | null>(null);

  /** Cita abierta en el detalle. */
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);

  const loadWeek = useCallback(
    async (start: Date) => {
      setIsLoading(true);
      try {
        const data = await getCalendar(weekRange(start));
        setAppointments(data.appointments);
        setProfessionals(data.professionals);
        setError(null);
      } catch (err) {
        const message = getErrorMessage(
          err,
          "No se pudo cargar la agenda.",
        );
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-stone-800 px-6 py-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <CalendarDays className="h-5 w-5 text-amber-300" />
          Agenda
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          Las citas de la semana, por profesional. Pasa el cursor por una cita
          para ver el detalle.
        </p>
      </header>

      {error ? (
        <div className="p-6">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        </div>
      ) : (
        <>
          {/* La rejilla ocupa el resto y scrollea por dentro: la cabecera de
              dias queda pegada arriba. */}
          <div className="min-h-0 flex-1">
            {isLoading && appointments.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="animate-pulse text-sm text-stone-400">
                  Cargando agenda...
                </span>
              </div>
            ) : (
              <WeekCalendar
                appointments={appointments}
                professionals={professionals}
                onSlotClick={setSlotDraft}
                onSelectAppointment={setSelected}
                onWeekChange={setWeekStart}
                weekStart={weekStart}
              />
            )}
          </div>

          {/* Contador de la semana, para saber de un vistazo si hay carga. */}
          <footer className="border-t border-stone-800 px-6 py-2">
            <p className="text-[11px] text-stone-500">
              {appointments.length}{" "}
              {appointments.length === 1 ? "cita" : "citas"} esta semana
              {isLoading ? " · actualizando..." : ""}
              {" · "}
              <span className="text-stone-600">
                Haz clic en un hueco para agendar
              </span>
            </p>
          </footer>
        </>
      )}

      {slotDraft ? (
        <NewAppointmentModal
          professional={slotDraft.professional}
          startsAt={slotDraft.startsAt}
          onClose={() => setSlotDraft(null)}
          onCreated={() => {
            setSlotDraft(null);
            void loadWeek(weekStart);
          }}
        />
      ) : null}

      {selected ? (
        <AppointmentDetailModal
          appointment={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void loadWeek(weekStart)}
        />
      ) : null}
    </div>
  );
}
