import type { AdminRole } from "./enums";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantContextInfo {
  id: string;
  name: string;
  slug: string;
  /** Plan comercial del tenant: basic | full | pro. */
  plan?: "basic" | "full" | "pro";
}

export interface AdminUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** El backend incluye el tenant en la respuesta, pero no tenantId. */
  tenant?: TenantContextInfo;
}

export interface AdminSession {
  id: string;
  tenantId: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
