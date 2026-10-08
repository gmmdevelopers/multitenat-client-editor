import { api } from "./client";

export interface ContactFieldPayload {
  label: string;
  value: string;
}

export interface SendContactMessageRequest {
  fields: ContactFieldPayload[];
  email?: string;
  pagePath?: string;
  captchaToken?: string;
}

export interface SendContactMessageResponse {
  id: string;
  /** `false` si el sitio no tiene buzon configurado o el aviso no pudo salir. */
  notified: boolean;
}

/**
 * Envia un mensaje desde el formulario de contacto de la web publica.
 *
 * El tenant lo resuelve el backend con el subdominio o con la cabecera
 * `x-tenant-slug` (que el interceptor de `api` ya reenvia). Aqui NO se manda el
 * destinatario: si el navegador pudiera elegirlo, cualquiera enviaria mensajes
 * a cualquier cliente.
 */
export async function sendContactMessage(
  payload: SendContactMessageRequest,
): Promise<SendContactMessageResponse> {
  const { data } = await api.post<SendContactMessageResponse>(
    "/contact",
    payload,
  );
  return data;
}
