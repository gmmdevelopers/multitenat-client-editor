"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  Clock,
  DollarSign,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Trash2,
  UserCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  deleteAppointment,
  getAppointmentContact,
  getAppointmentDetail,
  rescheduleAppointment,
  updateAppointmentStatus,
  STATUS_LABELS,
  type AppointmentContact,
  type AppointmentDetail,
  type CalendarAppointment,
  type ManualStatus,
} from "@/lib/api/calendar";
import { formatTime } from "@/lib/calendar-dates";
import { buildWhatsAppLink } from "@/lib/whatsapp";

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

  /**
   * El nombre del negocio, para el saludo de WhatsApp.
   *
   * Sale del contexto de sesion y no de una prop: el modal se usa desde la
   * agenda, que ya tiene el tenant cargado, y pasarlo como prop obligaria a
   * cada pantalla que lo abra a acordarse de mandarlo.
   */
  const { tenant } = useAuth();

  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  // El contacto se pide aparte: son datos personales y no viajan con el
  // calendario, que se recarga entero cada vez que se cambia de semana.
  const [contact, setContact] = useState<AppointmentContact | null>(null);
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

    // El contacto se pide en paralelo y no bloquea el detalle: si falla, el
    // modal sigue sirviendo para todo lo demas. Solo el recepcionista puede
    // verlo; para un profesional el 403 es esperado y se trata como "sin datos".
    void getAppointmentContact(appointment.id)
      .then((data) => {
        if (!cancelled) setContact(data);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
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

  /**
   * «Creada por» en una linea, o `null` si no hay dato.
   *
   * ## Por que no es solo el nombre
   *
   * La cita puede haberla creado el paciente, y entonces no hay nombre que
   * ensenar. Decir solo «Paciente» deja la duda de si la agendo el mismo por la
   * web o por la app: se dice el **canal**, que es el dato util.
   *
   * Si las citas antiguas no tienen `createdSource`, se devuelve `null` y la fila
   * no se pinta. Es mejor no mostrar nada que mostrar «desconocido» en cada cita
   * del historico.
   */
  function createdByLabel(
    current: typeof detail,
  ): string | null {
    const name = current?.appointment.createdByName?.trim();
    const source = current?.appointment.createdSource;

    if (name) return name;

    if (source === "public_web") return "El paciente · desde la web";
    if (source === "patient_app") return "El paciente · desde la app";

    // `staff` sin nombre: cita antigua, anterior a este campo.
    return null;
  }

  /**
   * Enlace de WhatsApp, con un mensaje ya escrito.
   *
   * `null` si el telefono no se puede normalizar, y entonces el boton no se
   * pinta: es preferible a ofrecer uno que abra WhatsApp con un error.
   *
   * El texto lleva el **nombre y la hora** porque es lo que se comunica en el
   * 90% de los avisos ("te esperamos a las 15:30"). Recepcion lo puede editar
   * antes de enviar; el borrador solo le ahorra escribirlo entero cada vez.
   */
  const appointmentTime = formatTime(
    new Date(detail?.appointment.startsAt ?? appointment.startsAt),
  );

  const patientFirstName = (
    detail?.labels.patientName ?? appointment.patientName
  ).split(" ")[0];
  const whatsappLink = buildWhatsAppLink(
    contact?.phone ?? null,
    `Hola ${patientFirstName}, te escribimos de ${tenant?.name ?? "el negocio"}. Te esperamos a las ${appointmentTime}.`,
  );

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

              {/*
                Quien creo la cita.

                ## Por que se muestra esto

                Cuando dos personas atienden la agenda (la duena por la manana,
                la recepcionista por la tarde), «¿quien agendo esto?» es la
                primera pregunta ante un error: una cita duplicada, un paciente
                que dice que no reservo, una hora cambiada.

                ## Los tres casos

                `staff` muestra el nombre; los otros dos dicen el canal. Un
                paciente que llama por telefono no tiene por que saber que su
                reserva "vino de la web": se le dice de donde salio, sin
                tecnicismos.
              */}
              {createdByLabel(detail) ? (
                <Row
                  icon={UserCheck}
                  label="Creada por"
                  value={createdByLabel(detail)!}
                />
              ) : null}
            </div>

            {/* Contacto: el recepcionista necesita llamar o escribir al paciente
                cuando avisa que no llega. Cada enlace abre la app del sistema.
                Si no hay sesion con permiso, el bloque no se pinta. */}
            {contact?.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-700 px-3 py-2 text-[11px] font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
              >
                <Phone className="h-3.5 w-3.5" />
                {contact.phone}
              </a>
            ) : null}

            {contact?.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-700 px-3 py-2 text-[11px] font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                {contact.email}
              </a>
            ) : null}

            {/*
              WhatsApp: el canal que recepcion usa de verdad para avisar.

              ## Por que aparece o no

              Solo si el telefono se puede convertir a un numero valido
              (`buildWhatsAppLink` devuelve `null` si no). Es preferible no
              mostrar el boton a mostrar uno que abra WhatsApp con un error.

              ## Por que va con mensaje pre-escrito

              Un enlace vacio obliga a recepcion a escribir el saludo cada vez.
              El texto incluye el nombre y la hora de la cita, que es justo el
              dato que se esta comunicando ("te esperamos a las 15:30").
            */}
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                data-whatsapp-link="true"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-green-700/60 bg-green-600/10 px-3 py-2 text-[11px] font-semibold text-green-400 transition hover:bg-green-600/20 hover:text-green-300"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Escribir por WhatsApp
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
