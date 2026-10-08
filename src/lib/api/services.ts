import { api } from "./client";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationInMinutes: number;
  /** Precio en CLP. `null` = servicio sin precio fijo (a convenir). */
  price: number | null;
  /** Color para el calendario. `null` = se usa el color por estado. */
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Cuantos profesionales lo ofrecen. Sin ninguno, no se puede agendar. */
  _count?: { professionals: number };
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  durationInMinutes: number;
  price?: number;
  color?: string;
  isActive?: boolean;
}

/**
 * Payload de edicion.
 *
 * `Omit` y no `Partial<CreateServiceRequest> & {...}`: la interseccion NO
 * sobrescribe el tipo del campo, lo combina (`number & (number | null)`), asi
 * que `price: null` seguia sin ser asignable aunque aqui se declare.
 */
export type UpdateServiceRequest = Partial<
  Omit<CreateServiceRequest, "price" | "color">
> & {
  price?: number | null;
  color?: string | null;
};

/** Servicios del negocio. Por defecto solo los activos. */
export async function listServices(params?: {
  includeInactive?: boolean;
}): Promise<Service[]> {
  const { data } = await api.get<Service[]>("/services", {
    params: { includeInactive: params?.includeInactive ? "true" : undefined },
  });

  return data;
}

export async function createService(
  payload: CreateServiceRequest,
): Promise<Service> {
  const { data } = await api.post<Service>("/services", payload);
  return data;
}

export async function updateService(
  id: string,
  payload: UpdateServiceRequest,
): Promise<Service> {
  const { data } = await api.patch<Service>(`/services/${id}`, payload);
  return data;
}

/**
 * Inhabilita un servicio.
 *
 * No lo borra: las citas historicas lo referencian. El backend responde con el
 * servicio ya marcado como inactivo.
 */
export async function deactivateService(id: string): Promise<Service> {
  const { data } = await api.delete<Service>(`/services/${id}`);
  return data;
}
