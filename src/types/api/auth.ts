// src/types/api/auth.ts
import type { AdminUser, Tenant } from "@/types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AdminUser;
  tenant: Tenant;
}

export interface MeResponse {
  user: AdminUser;
  tenant: Tenant;
}

export type LogoutResponse = void;
