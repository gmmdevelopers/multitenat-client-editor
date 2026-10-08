"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  deleteAppointment,
  getAppointmentDetail,
  rescheduleAppointment,
  updateAppointmentStatus,
  STATUS_LABELS,
  type AppointmentDetail,
  type CalendarAppointment,
  type ManualStatus,
} from "@/lib/api/calendar";
import { formatTime } from "@/lib/calendar-dates";

/** Estados desde los que ya no se puede cambiar nada. */
const FINAL_STATUSES = ["cancelled", "completed", "no_show"];

/** Acciones disponibles, con su icono y si son destructivas. */
const STATUS_ACTIONS: Array<{
  status: ManualStatus;
  label: string;
  icon: typeof Check;
  destructive?: boolean;
}> = [
  { status: "confirmed", label: "Confirmar", icon: Check },
  { status: "in_progress", label: "En curso", icon: Clock },
  { status: "completed", label: "Completar", icon: Check },
  { status: "no_show", label: "No asistió", icon: XCircle },
  { status: "cancelled", label: "Cancelar", icon: XCircle, destructive: true },
];

interface AppointmentDetailModalProps {
  appointment: CalendarAppointment;
  onClose: () => void;
  /** Se llama tras cualquier cambio: la agenda debe recargar la semana. */
  onChanged: () => void;
}

/**
 * Detalle de una cita.
 *
 * Muestra los datos completos y permite las acciones del dia a dia: cambiar de
 * estado, reprogramar y —solo si hizo falta— borrar.
 *
 * Carga el detalle del servidor en vez de usar los datos del calendario porque
 * el calendario solo trae lo justo para pintar la rejilla: falta el servicio,
 * el precio y el telefono del paciente.
 */
export function AppointmentDetailModal({
  appointment,
  onClose,
  onChanged,
}: AppointmentDetailModalProps) {
  const toast = useToast();

  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Campos de reprogramacion: se inicializan con el horario actual.
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  useEffect(() => {
    // Se ignora una segunda ejecucion. En desarrollo React monta, desmonta y
    // remonta cada componente (StrictMode), asi que este efecto corre dos veces
    // y la segunda peticion producia un segundo toast de error.
    let cancelled = false;

    void getAppointmentDetail(appointment.id)
      .then((data) => {
        if (cancelled) return;

        // El detalle puede llegar vacio si el navegador responde `304 Not
        // Modified`, que axios entrega con `data` en `undefined` en vez del JSON
        // cacheado. Sin esta guarda, `data.appointment` reventaba y el error se
        // mostraba como "no se pudo cargar" aunque la peticion hubiera ido bien.
        if (!data?.appointment) {
          setDetail(null);
          return;
        }

        setDetail(data);

        const start = new Date(data.appointment.startsAt);

        // La fecha se compone en LOCAL y no con `toISOString()`, que
        // desplazaria el dia si la hora local va por detras de UTC.
        const year = start.getFullYear();
        const month = String(start.getMonth() + 1).padStart(2, "0");
        const day = String(start.getDate()).padStart(2, "0");

        setNewDate(`${year}-${month}-${day}`);
        setNewTime(
          `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getErrorMessage(err, "No se pudo cargar la cita."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointment.id, toast]);

  async function handleStatus(next: ManualStatus) {
    setIsSaving(true);
    try {
      await updateAppointmentStatus(appointment.id, next);
      toast.success(`Cita marcada como ${STATUS_LABELS[next].toLowerCase()}`);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el estado."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReschedule() {
    if (!newDate || !newTime) return;

    setIsSaving(true);
    try {
      // Se compone la fecha en hora LOCAL y se manda en ISO: el backend guarda
      // instantes, y enviar la hora local suelta la interpretaria como UTC.
      const startsAt = new Date(`${newDate}T${newTime}:00`);

      await rescheduleAppointment(appointment.id, {
        startsAt: startsAt.toISOString(),
      });

      toast.success("Cita reprogramada");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(
        getErrorMessage(err, "No se pudo reprogramar. Revisa el horario."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    try {
      await deleteAppointment(appointment.id);
      toast.success("Cita eliminada");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo eliminar la cita."));
    } finally {
      setIsSaving(false);
    }
  }

  const status = detail?.appointment.status ?? appointment.status;
  const isFinal = FINAL_STATUSES.includes(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-appointment-detail="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-stone-800 bg-stone-900 p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">
              {detail?.labels.patientName ?? appointment.patientName}
            </h2>
            <p className="mt-0.5 text-[11px] text-stone-500">
              {new Date(appointment.startsAt).toLocaleDateString("es-CL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Estado actual, para saber que se esta viendo */}
        <div className="mt-3">
          <span
            data-appointment-status={status}
            className="inline-flex rounded-full border border-stone-700 bg-stone-800 px-2.5 py-1 text-[10px] font-bold uppercase text-stone-300"
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-stone-400">
            Cargando detalle...
          </p>
        ) : (
          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col gap-2.5 rounded-xl border border-stone-800 bg-stone-950/60 p-4">
              <Row
                icon={Clock}
                label="Horario"
                value={`${formatTime(new Date(appointment.startsAt))} – ${formatTime(new Date(appointment.endsAt))}`}
                hint={
                  detail?.service
                    ? `${detail.service.durationInMinutes} min`
                    : undefined
                }
              />

              {detail?.service ? (
                <Row
                  icon={CalendarClock}
                  label="Servicio"
                  value={detail.service.name}
                />
              ) : null}

              <Row
                icon={UserRound}
                label="Profesional"
                value={detail?.labels.professionalName ?? appointment.professionalName}
              />

              <Row
                icon={MapPin}
                label="Sala"
                value={detail?.labels.boxName ?? appointment.boxName}
              />

              {detail?.price !== null && detail?.price !== undefined ? (
                <Row
                  icon={DollarSign}
                  label="Precio"
                  value={`$${detail.price.toLocaleString("es-CL")}`}
                />
              ) : null}
            </div>

            {/* Contacto: el recepcionista necesita llamar al paciente cuando
                avisa que no llega. El enlace abre la app de telefono del sistema. */}
            {appointment.patientPhone ? (
              <a
                href={`tel:${appointment.patientPhone}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-700 px-3 py-2 text-[11px] font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" />
                {appointment.patientPhone}
              </a>
            ) : null}

            {/* Reprogramar */}
            {!isFinal ? (
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <button
                  type="button"
                  data-toggle-reschedule="true"
                  onClick={() => setShowReschedule((v) => !v)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
                    Reprogramar
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {showReschedule ? "Ocultar" : "Cambiar fecha u hora"}
                  </span>
                </button>

                {showReschedule ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        data-reschedule-date="true"
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        data-reschedule-time="true"
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-stone-500">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      Se conserva la duración del servicio. El sistema avisará si
                      el nuevo horario está ocupado o fuera de atención.
                    </p>

                    <button
                      type="button"
                      data-confirm-reschedule="true"
                      onClick={() => void handleReschedule()}
                      disabled={isSaving || !newDate || !newTime}
                      className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-40"
                    >
                      {isSaving ? "Guardando..." : "Guardar nuevo horario"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Acciones de estado */}
            {!isFinal ? (
              <div className="grid grid-cols-2 gap-2">
                {STATUS_ACTIONS.filter((a) => a.status !== status).map(
                  ({ status: next, label, icon: Icon, destructive }) => (
                    <button
                      key={next}
                      type="button"
                      data-status-action={next}
                      onClick={() => void handleStatus(next)}
                      disabled={isSaving}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition disabled:opacity-40 ${
                        destructive
                          ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
                          : "border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ),
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-[11px] text-stone-500">
                Esta cita ya está cerrada. Para volver a atender a este paciente,
                crea una cita nueva.
              </p>
            )}

            {/* Borrar: solo si NO hay historial de atencion. */}
            {!isFinal ? (
              <div className="mt-1 border-t border-stone-800 pt-3">
                {showDelete ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-relaxed text-stone-400">
                      Esto <strong>borra</strong> la cita y no queda registro. Si
                      solo quieres liberar el horario, usa{" "}
                      <strong>Cancelar</strong>.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDelete(false)}
                        className="rounded-lg px-3 py-1.5 text-[11px] text-stone-400 hover:text-white"
                      >
                        Volver
                      </button>
                      <button
                        type="button"
                        data-confirm-delete-appointment="true"
                        onClick={() => void handleDelete()}
                        disabled={isSaving}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
                      >
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-request-delete-appointment="true"
                    onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 text-[11px] text-stone-500 transition hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar cita (para errores)
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 outline-none focus:border-amber-400";

function Row({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-stone-500">
          {label}
        </p>
        <p className="truncate text-xs text-stone-200">
          {value}
          {hint ? (
            <span className="ml-1.5 text-stone-500">({hint})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
