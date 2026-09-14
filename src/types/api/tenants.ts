// src/types/api/tenants.ts
import type { Tenant } from "@/types";

export interface GetTenantBySlugResponse {
  tenant: Tenant;
}

export interface UpdateTenantRequest {
  name?: string;
}

export interface UpdateTenantResponse {
  tenant: Tenant;
}
