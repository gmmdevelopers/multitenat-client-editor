import { api } from "./client";

export interface ProfessionalServiceSummary {
  id: string;
  name: string;
  durationInMinutes: number;
}

export interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Servicios que puede ofrecer. Sin ninguno, no se le puede agendar nada. */
  services: ProfessionalServiceSummary[];
}

export interface CreateProfessionalRequest {
  tenantId: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  isActive?: boolean;
}

export interface UpdateProfessionalRequest {
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  isActive?: boolean;
}

export interface ProfessionalsListResponse {
  items: Professional[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Profesionales del tenant. Incluye los servicios que ofrece cada uno. */
export async function listProfessionals(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ProfessionalsListResponse> {
  const { data } = await api.get<ProfessionalsListResponse>("/professionals", {
    params: {
      page: params?.page ?? 1,
      // El panel necesita todos para asignar servicios; el default de la API es
      // mas bajo y dejaria profesionales fuera de la pantalla.
      pageSize: params?.pageSize ?? 100,
    },
  });

  return data;
}

export async function createProfessional(
  payload: CreateProfessionalRequest,
): Promise<Professional> {
  const { data } = await api.post<Professional>("/professionals", payload);
  return data;
}

export async function updateProfessional(
  id: string,
  payload: UpdateProfessionalRequest,
): Promise<Professional> {
  const { data } = await api.patch<Professional>(`/professionals/${id}`, payload);
  return data;
}

/**
 * Elimina un profesional.
 *
 * El backend lo rechaza si tiene citas: borrarlo dejaria el historial sin
 * profesional. Para retirarlo sin perderlo, se inhabilita (`isActive: false`).
 */
export async function deleteProfessional(id: string): Promise<void> {
  await api.delete(`/professionals/${id}`);
}

/** Servicios que ofrece un profesional. */
export async function getProfessionalServices(professionalId: string): Promise<{
  professionalId: string;
  professionalName: string;
  serviceIds: string[];
}> {
  const { data } = await api.get<{
    professionalId: string;
    professionalName: string;
    serviceIds: string[];
  }>(`/services/professionals/${professionalId}`);

  return data;
}

/**
 * Reemplaza los servicios de un profesional.
 *
 * Se manda la lista COMPLETA: lo que no venga, se quita. Es lo que el cliente
 * espera al desmarcar una casilla.
 */
export async function setProfessionalServices(
  professionalId: string,
  serviceIds: string[],
): Promise<{ serviceIds: string[] }> {
  const { data } = await api.put<{ serviceIds: string[] }>(
    `/services/professionals/${professionalId}`,
    { serviceIds },
  );

  return data;
}
