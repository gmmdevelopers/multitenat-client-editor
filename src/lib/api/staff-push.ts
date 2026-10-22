import { api } from "./client";

/**
 * Notificaciones del panel en ESTE navegador (web push).
 *
 * Solo tres llamadas: consultar si se puede, suscribir y quitar. El resto del
 * trabajo lo hace el navegador (`PushManager`) y el service worker.
 */

export interface StaffPushConfig {
  /** El servidor tiene las claves VAPID. Sin esto no hay nada que activar. */
  enabled: boolean;
  /** Clave publica con la que el navegador se suscribe a `PushManager`. */
  publicKey: string | null;
  /** Cuantos navegadores tiene suscritos este usuario. */
  subscriptions: number;
}

export async function getStaffPushConfig(): Promise<StaffPushConfig> {
  const { data } = await api.get<StaffPushConfig>("/staff/push/config");

  return data;
}

/**
 * Guarda la suscripcion del navegador.
 *
 * Se desarma el objeto en sus tres campos en vez de mandarlo tal cual:
 * `PushSubscriptionJSON` trae un `expirationTime` que el backend no acepta, y
 * mandar campos de mas hace que el `forbidNonWhitelisted` lo rechace con un
 * error 400 dificil de leer.
 */
export async function subscribeStaffPush(
  subscription: PushSubscription,
): Promise<{ subscriptions: number }> {
  const json = subscription.toJSON();

  const { data } = await api.post<{ subscriptions: number }>(
    "/staff/push/subscribe",
    {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  );

  return data;
}

export async function unsubscribeStaffPush(
  endpoint: string,
): Promise<{ subscriptions: number }> {
  const { data } = await api.delete<{ subscriptions: number }>(
    "/staff/push/subscribe",
    { data: { endpoint } },
  );

  return data;
}
