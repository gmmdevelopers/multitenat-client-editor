import { api } from "./client";

/**
 * Bandeja de entrada del negocio: las conversaciones con sus pacientes.
 *
 * Va bajo `/api/staff/inbox`, con **sesion de admin**. El `tenantId` sale de la
 * sesion en el backend, nunca del body: aceptarlo del cliente permitiria leer
 * las conversaciones de otro negocio.
 *
 * Es el lado OPUESTO del chat del paciente (`lib/api/patient-chat` no existe en
 * el editor): el paciente solo ve sus conversaciones y **con ventana de 24 h**;
 * el negocio ve todas las suyas **sin ventana**, porque es su registro de
 * atencion.
 */

export interface InboxConversation {
  id: string;
  patient: {
    id: string;
    fullName: string;
    email: string | null;
  };
  /** Mensajes del paciente que el staff no ha abierto. */
  unread: number;
  /** Ultimo mensaje de la conversacion, o `null` si esta vacia. */
  lastMessage: {
    body: string;
    createdAt: string;
    sender: string;
  } | null;
  totalMessages: number;
}

/** Conversaciones del negocio, la mas reciente primero. */
export async function listConversations(): Promise<InboxConversation[]> {
  const { data } = await api.get<{ conversations: InboxConversation[] }>(
    "/staff/inbox",
  );

  return data.conversations;
}

/**
 * Total de mensajes sin leer.
 *
 * Para el contador del panel: el staff necesita saber que hay algo esperando sin
 * entrar a la seccion.
 */
export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread: number }>("/staff/inbox/unread");

  return data.unread;
}

export interface InboxMessage {
  id: string;
  /** `patient` o `staff`. */
  sender: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/**
 * Mensajes de una conversacion.
 *
 * **Al llamarlo, el backend marca los mensajes del paciente como leidos.** No
 * hay un endpoint aparte: si hubiera que recordar llamarlo, el contador no
 * bajaria nunca y acabaria ignorandose.
 */
export async function getConversation(chatId: string): Promise<{
  patient: { id: string; fullName: string; email: string | null };
  messages: InboxMessage[];
}> {
  const { data } = await api.get<{
    patient: { id: string; fullName: string; email: string | null };
    messages: InboxMessage[];
  }>(`/staff/inbox/${chatId}`);

  return data;
}

/** Responde el negocio. */
export async function replyToConversation(
  chatId: string,
  body: string,
): Promise<InboxMessage> {
  const { data } = await api.post<InboxMessage>(
    `/staff/inbox/${chatId}/messages`,
    { body },
  );

  return data;
}
