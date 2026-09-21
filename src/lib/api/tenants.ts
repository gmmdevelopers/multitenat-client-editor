// src/lib/api/tenants.ts
import { api } from "./client";
import type { TenantContextInfo } from "@/types/tenant";
import type { Plan } from "@multitenant/design-system";

export interface UpdateTenantPayload {
  name?: string;
  slug?: string;
  plan?: Plan;
}

/**
 * Actualiza el tenant actual (nombre, slug o plan).
 *
 * El plan lo puede cambiar el propio cliente: subir a `pro` habilita el
 * ecommerce, y bajar a `basic` lo bloquea en el editor.
 */
export async function updateTenant(
  tenantId: string,
  payload: UpdateTenantPayload,
): Promise<TenantContextInfo> {
  const { data } = await api.patch<TenantContextInfo>(
    `/tenants/${tenantId}`,
    payload,
  );
  return data;
}
