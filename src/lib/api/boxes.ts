import { api } from "./client";

export interface Box {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface BoxListResponse {
  items: Box[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Boxes (salas) del tenant. Toda cita ocupa uno. */
export async function listBoxes(params?: {
  pageSize?: number;
}): Promise<BoxListResponse> {
  const { data } = await api.get<BoxListResponse>("/boxes", {
    params: { page: 1, pageSize: params?.pageSize ?? 100 },
  });

  return data;
}

export interface CreateBoxRequest {
  tenantId: string;
  name: string;
  code?: string;
}

/**
 * Crea un box.
 *
 * Se llama desde el modal de nueva cita cuando el negocio todavia no tiene
 * ninguno: sin box no se puede agendar, y obligar a salir de la agenda para
 * crearlo romperia el flujo.
 */
export async function createBox(payload: CreateBoxRequest): Promise<Box> {
  const { data } = await api.post<Box>("/boxes", payload);
  return data;
}
