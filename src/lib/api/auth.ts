// src/lib/api/auth.ts
import { api } from "./client";
import type { LoginResponse } from "@/types/api/auth";

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function logoutRequest(): Promise<void> {
  await api.post("/auth/logout");
}

/** GET /auth/me — { user: { ..., tenant }, ... } */
export async function getMe(): Promise<LoginResponse["user"]> {
  const { data } = await api.get<{ user: LoginResponse["user"] }>("/auth/me");
  return data.user;
}
