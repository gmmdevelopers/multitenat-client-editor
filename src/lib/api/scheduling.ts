// src/lib/api/scheduling.ts
import { api } from "./client";

export interface PublicProfessional {
  id: string;
  fullName: string;
  licenseNumber: string | null;
}

export interface PublicBox {
  id: string;
  name: string;
  code: string | null;
}

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityResponse {
  tenantId: string;
  professionalId: string;
  boxId: string;
  slots: AvailableSlot[];
}

export interface BookAppointmentPayload {
  professionalId: string;
  /** Opcional: el backend usa el primer consultorio activo si se omite. */
  boxId?: string;
  startsAt: string;
  endsAt: string;
  patient: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
}

export interface BookedAppointment {
  appointmentId: string;
  patientId: string;
  professionalId: string;
  boxId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

/** Profesionales activos del sitio. Endpoint publico, sin sesion. */
export async function listPublicProfessionals(): Promise<PublicProfessional[]> {
  const { data } = await api.get<{ professionals: PublicProfessional[] }>(
    "/public/professionals",
  );
  return data.professionals;
}

export async function listPublicBoxes(): Promise<PublicBox[]> {
  const { data } = await api.get<{ boxes: PublicBox[] }>("/public/boxes");
  return data.boxes;
}

/**
 * Franjas libres de un profesional dentro de una ventana de tiempo.
 * Si no se pasa `boxId`, el backend usa el primer consultorio activo.
 */
export async function getPublicAvailability(params: {
  professionalId: string;
  boxId?: string;
  windowStartsAt: string;
  windowEndsAt: string;
  appointmentDurationInMinutes: number;
  stepInMinutes?: number;
}): Promise<AvailabilityResponse> {
  const { data } = await api.get<AvailabilityResponse>("/public/availability", {
    params,
  });
  return data;
}

/** Agenda una cita y registra al paciente (sin crear cuenta). */
export async function bookPublicAppointment(
  payload: BookAppointmentPayload,
): Promise<BookedAppointment> {
  const { data } = await api.post<BookedAppointment>(
    "/public/appointments",
    payload,
  );
  return data;
}
