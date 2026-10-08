import { api } from "./client";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface PatientListResponse {
  items: Patient[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Pacientes del tenant. Se usa para elegir a quien se le agenda la cita. */
export async function listPatients(params?: {
  pageSize?: number;
}): Promise<PatientListResponse> {
  const { data } = await api.get<PatientListResponse>("/patients", {
    params: { page: 1, pageSize: params?.pageSize ?? 100 },
  });

  return data;
}

export interface CreatePatientRequest {
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

/**
 * Crea un paciente.
 *
 * Se llama desde el modal de nueva cita cuando el visitante no existe todavia:
 * obligar a salir a la seccion de pacientes para volver despues romperia el
 * flujo de agendar.
 */
export async function createPatient(
  payload: CreatePatientRequest,
): Promise<Patient> {
  const { data } = await api.post<Patient>("/patients", payload);
  return data;
}
