import { api } from "./client";

/** Estado de verificacion del correo del usuario de la sesion. */
export interface EmailStatus {
  email: string;
  verified: boolean;
  verifiedAt: string | null;
}

/**
 * Confirma el correo con el token del enlace.
 *
 * Es publica: el cliente puede abrir el enlace en un dispositivo donde no tiene
 * sesion, y el token ES la credencial.
 */
export async function verifyEmail(
  token: string,
): Promise<{ email: string; tenantSlug: string }> {
  const { data } = await api.post<{ email: string; tenantSlug: string }>(
    "/auth/email/verify",
    { token },
  );
  return data;
}

/**
 * Pide un enlace de verificacion nuevo.
 *
 * Responde igual exista o no la cuenta: el backend no revela quien esta
 * registrado, y el mensaje que se muestra al cliente debe ser el mismo.
 */
export async function resendVerification(email: string): Promise<void> {
  await api.post("/auth/email/resend", { email });
}

/** Estado de verificacion del usuario actual. Requiere sesion. */
export async function getEmailStatus(): Promise<EmailStatus> {
  const { data } = await api.get<EmailStatus>("/auth/email/status");
  return data;
}
