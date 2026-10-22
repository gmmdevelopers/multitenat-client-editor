// src/lib/api/scheduling.ts
import { api } from "./client";

export interface PublicProfessional {
  id: string;
  fullName: string;
  licenseNumber: string | null;
  /**
   * Servicios que este profesional puede ofrecer.
   *
   * Lo usa el agendador para el paso 2: elegido un servicio, solo se muestran
   * los profesionales que lo prestan.
   */
  serviceIds: string[];
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
  /**
   * Motivo del cierre, o `null` si el dia esta abierto.
   *
   * Es lo que permite distinguir "cerrado por feriado" de "sin horas libres":
   * dos mensajes muy distintos para el paciente, que antes veia el mismo.
   */
  closedReason: string | null;
}

/** Servicio publico, para el paso 1 del agendador. */
export interface PublicService {
  id: string;
  name: string;
  durationInMinutes: number;
  /** Precio en CLP. `0` = a convenir. */
  price: number;
}

/**
 * Politica de cobro del negocio, para calcular el monto publico.
 *
 * El design system no la conoce: la pagina calcula el monto y se lo pasa ya
 * resuelto, para que el componente siga siendo agnostico al negocio.
 */
export interface PublicDepositPolicy {
  requiresPayment: boolean;
  /** Porcentaje a cobrar (0, 25, 50, 75, 100). */
  percentage: number;
  amountFor: (servicePrice: number) => number;
}

export interface BookAppointmentPayload {
  professionalId: string;
  /**
   * Servicio que se agenda.
   *
   * De aqui sale la DURACION de la cita: el backend calcula el termino con
   * ella, en vez de fiarse de un `endsAt` que el navegador podria inventar.
   */
  serviceId: string;
  /** Opcional: el backend usa el primer consultorio activo si se omite. */
  boxId?: string;
  startsAt: string;
  endsAt: string;
  patient: {
    firstName: string;
    lastName: string;
    email?: string;
    /**
     * **Obligatorio.**
     *
     * Sin telefono el negocio no puede avisar de un cambio ni de un atraso, y
     * la reserva sin contacto real es la forma tipica de reservar por error o
     * por broma. El backend lo exige: omitirlo da **400**.
     */
    phone: string;
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
  /**
   * URL de Mercado Pago, si el negocio cobra al agendar.
   *
   * Presente significa que la cita quedo RETENIDA, no confirmada: hay que
   * llevar al paciente a pagar antes de darla por hecha.
   */
  paymentUrl?: string | null;
  /** Monto a pagar en CLP. */
  paymentAmount?: number | null;
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
 * Servicios activos del sitio, para el paso 1 del agendador.
 *
 * De aqui sale la DURACION con la que el backend calcula los huecos: sin
 * mandar `serviceId` en la disponibilidad, el backend no sabe cuanto dura la
 * cita y no puede ofrecer franjas correctas.
 */
export async function listPublicServices(): Promise<PublicService[]> {
  const { data } = await api.get<{ services: PublicService[] }>(
    "/public/services",
  );
  return data.services;
}

/**
 * Politica de cobro del negocio.
 *
 * `amountFor` se calcula en el navegador a partir del porcentaje y del precio
 * del servicio, para poder mostrar el monto ANTES de confirmar. Mandarlo
 * resuelto desde el backend obligaria a conocer el servicio elegido, que aun no
 * se ha elegido.
 */
export async function getPublicDepositPolicy(): Promise<{
  requiresPayment: boolean;
  percentage: number;
  amountFor: (servicePrice: number) => number;
}> {
  const { data } = await api.get<{
    policy: string;
    percentage: number;
    requiresPayment: boolean;
  }>("/public/deposit-policy");

  return {
    requiresPayment: data.requiresPayment,
    percentage: data.percentage,
    amountFor: (servicePrice: number) =>
      servicePrice <= 0
        ? 0
        : Math.round((servicePrice * data.percentage) / 100),
  };
}

/**
 * Franjas libres de un profesional para un servicio y una ventana.
 *
 * `serviceId` es obligatorio: la duracion sale del servicio. Mandar una
 * duracion suelta permitiria al navegador inventarse cuanto dura una cita.
 *
 * Si no se pasa `boxId`, el backend usa el primer consultorio activo.
 */
export async function getPublicAvailability(params: {
  professionalId: string;
  serviceId: string;
  boxId?: string;
  windowStartsAt: string;
  windowEndsAt: string;
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
