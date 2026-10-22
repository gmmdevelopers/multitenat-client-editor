import { api } from "./client";

export interface CalendarAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  professionalId: string;
  professionalName: string;
  boxId: string;
  boxName: string;
  patientId: string;
  patientName: string;
}

export interface CalendarProfessional {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CalendarResponse {
  appointments: CalendarAppointment[];
  professionals: CalendarProfessional[];
  range: { startsAt: string; endsAt: string };
}

/**
 * Citas y profesionales de un rango, para el calendario.
 *
 * Pide el rango completo (una semana) en una sola llamada: el backend devuelve
 * ambas listas juntas para que la rejilla se pinte de una vez.
 */
export async function getCalendar(params: {
  startsAt: string;
  endsAt: string;
}): Promise<CalendarResponse> {
  const { data } = await api.get<CalendarResponse>("/appointments/calendar", {
    params,
  });

  return data;
}

export interface CreateAppointmentRequest {
  patientId: string;
  professionalId: string;
  /**
   * Opcional: sin box, el backend resuelve el primer consultorio activo. El
   * box es una asignacion operativa, no un requisito para que exista la cita.
   */
  boxId?: string;
  /** Servicio: de aqui sale la duracion de la cita. */
  serviceId?: string;
  startsAt: string;
  status?: "held" | "pending_payment" | "confirmed";
}

export interface CreatedAppointment {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

/**
 * Agenda una cita.
 *
 * NO se manda `endsAt` cuando hay servicio: el backend lo calcula con la
 * duracion del servicio. Enviarlo aqui seria ignorado, y confiarlo daria la
 * falsa impresion de que el navegador decide cuanto dura la cita.
 */
export async function createAppointment(
  payload: CreateAppointmentRequest,
): Promise<CreatedAppointment> {
  const { data } = await api.post<CreatedAppointment>("/appointments", {
    // `appointmentId` es obligatorio en el DTO del backend; se genera aqui
    // porque el cliente puede querer reintentar con el mismo id.
    appointmentId:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `appt-${Date.now()}`,
    ...payload,
  });

  return data;
}

/** Estados que el recepcionista puede poner a mano. */
export const MANUAL_STATUSES = [
  "confirmed",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
] as const;

export type ManualStatus = (typeof MANUAL_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  held: "Retenida",
  pending_payment: "Pago pendiente",
  confirmed: "Confirmada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  failed_payment: "Pago fallido",
};

export interface AppointmentDetail {
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    serviceId: string | null;
    patientId: string;
    professionalId: string;
    boxId: string | null;
    /**
     * Quien creo la cita.
     *
     * `createdByName` es el nombre **congelado** al crear: si esa persona
     * cambia de nombre o deja el negocio, la cita sigue diciendo quien la
     * agendo. `null` en ambos = la creo el paciente.
     */
    createdById?: string | null;
    createdByName?: string | null;
    /** `staff` | `public_web` | `patient_app`. */
    createdSource?: string | null;
  };
  labels: {
    patientName: string;
    professionalName: string;
    boxName: string | null;
  };
  service: { id: string; name: string; durationInMinutes: number } | null;
  price: number | null;
}

/**
 * Contacto del paciente de una cita.
 *
 * Va en una peticion aparte y no dentro del calendario: son datos personales y
 * no hacen falta para pintar la rejilla. El calendario se carga cada vez que se
 * cambia de semana, asi que incrustarlos ahi los haria viajar de mas.
 */
export interface AppointmentContact {
  email: string | null;
  phone: string | null;
}

/** Detalle de una cita, con nombres y servicio ya resueltos. */
export async function getAppointmentDetail(
  appointmentId: string,
): Promise<AppointmentDetail> {
  const { data } = await api.get<AppointmentDetail>(
    `/appointments/${appointmentId}`,
  );

  return data;
}

/** Contacto del paciente de una cita. Solo lo pide el detalle. */
export async function getAppointmentContact(
  appointmentId: string,
): Promise<AppointmentContact> {
  const { data } = await api.get<AppointmentContact>(
    `/appointments/${appointmentId}/contact`,
  );

  return data;
}

/** Cambia el estado de una cita. */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: ManualStatus,
): Promise<{ appointmentId: string; status: string }> {
  const { data } = await api.patch<{ appointmentId: string; status: string }>(
    `/appointments/${appointmentId}/status`,
    { status },
  );

  return data;
}

/**
 * Reprograma una cita.
 *
 * No se manda `endsAt`: la duracion se conserva la del servicio, y la calcula
 * el servidor. Enviarla aqui daria la falsa impresion de que el navegador
 * decide cuanto dura.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  payload: { startsAt: string; boxId?: string; professionalId?: string },
): Promise<{
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}> {
  const { data } = await api.patch<{
    appointmentId: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }>(`/appointments/${appointmentId}/reschedule`, payload);

  return data;
}

/** Borra una cita. Solo para citas creadas por error. */
export async function deleteAppointment(appointmentId: string): Promise<void> {
  await api.delete(`/appointments/${appointmentId}`);
}
