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

/**
 * Pacientes del tenant.
 *
 * ## `search` se resuelve en el SERVIDOR
 *
 * Una clinica acumula **cientos** de fichas. Traerlas todas para filtrar en el
 * navegador no escala, y ademas falla en silencio: una pantalla que solo cargo
 * la primera pagina **no encuentra** a quien esta en la tercera, el cliente
 * concluye que no existe y **crea un duplicado**.
 *
 * El backend busca en nombre, apellido, correo y telefono, sin distinguir
 * mayusculas.
 *
 * ## Dos usos distintos
 *
 * - **La seccion de pacientes**: pagina y busca.
 * - **El modal de nueva cita**: pide la lista corta para el desplegable.
 *
 * Se resuelven con el mismo endpoint por eso de recibir `page` y `search`
 * opcionales, en vez de tener dos funciones casi iguales.
 */
export async function listPatients(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PatientListResponse> {
  const { data } = await api.get<PatientListResponse>("/patients", {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 100,
      ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
    },
  });

  return data;
}

/**
 * Los campos editables de una ficha.
 *
 * No incluye `tenantId`: una ficha no cambia de negocio. Enviarlo daria la
 * impresion de que se puede mover un paciente de tenant, que no es el caso.
 */
export interface UpdatePatientRequest {
  firstName?: string;
  lastName?: string;
  /** `null` **vacia** el campo; `undefined` lo deja como estaba. */
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

/**
 * Edita una ficha.
 *
 * `PATCH` y no `PUT`: se manda solo lo que cambia. Con `PUT`, la pantalla tendria
 * que reenviar los campos que no edita con el valor que tenian al abrir, y eso
 * pisa lo que otra persona acabe de guardar.
 */
export async function updatePatient(
  id: string,
  payload: UpdatePatientRequest,
): Promise<Patient> {
  const { data } = await api.patch<Patient>(`/patients/${id}`, payload);
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
