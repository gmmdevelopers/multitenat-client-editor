import { api } from "./client";

export interface ContactMessageField {
  label: string;
  value: string;
}

export interface ContactMessage {
  id: string;
  pagePath: string | null;
  fields: ContactMessageField[];
  /** Correo del visitante, para responderle. */
  replyTo: string | null;
  /**
   * Si el aviso por correo salio.
   *
   * `false` = el mensaje esta guardado pero nadie fue avisado (normalmente
   * porque el sitio no tiene `contactEmail` configurado).
   */
  notified: boolean;
  createdAt: string;
}

export interface ContactMessagesListResponse {
  items: ContactMessage[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Mensajes recibidos por el tenant actual. Requiere sesion. */
export async function listContactMessages(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ContactMessagesListResponse> {
  const { data } = await api.get<ContactMessagesListResponse>("/contact", {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    },
  });

  return data;
}
