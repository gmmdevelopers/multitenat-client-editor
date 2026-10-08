import { api } from "./client";

/**
 * Conexion de la cuenta de Mercado Pago de cada tenant (marketplace).
 *
 * Distinto del cobro de PLANES, que es de la plataforma: aqui el tenant conecta
 * SU cuenta para cobrar a SUS pacientes, y el dinero va directo a ella.
 *
 * Todas las llamadas llevan sesion: el `tenantId` sale de ella, nunca del body.
 */

export interface PaymentsConnectionStatus {
  connected: boolean;
  /**
   * `true` si la cuenta vinculada es un **usuario de prueba** de Mercado Pago.
   *
   * La UI lo avisa: si el cliente cree que cobra de verdad y esta en pruebas,
   * se enteraria cuando un paciente le pagara sin que llegara el dinero.
   */
  isTest: boolean;
  connectedAt: string | null;
  /** `true` si el token ya vencio y hay que reconectar. */
  expired: boolean;
}

/** Estado de la conexion con Mercado Pago. */
export async function getPaymentsStatus(): Promise<PaymentsConnectionStatus> {
  const { data } = await api.get<PaymentsConnectionStatus>(
    "/payments/mercadopago/status",
  );

  return data;
}

/**
 * URL de autorizacion de Mercado Pago.
 *
 * Se pide y se navega a ella, en vez de redirigir desde el backend: asi el
 * panel puede mostrar un estado de carga en lugar de una navegacion que el
 * cliente no pidio.
 *
 * Trae un `state` firmado que ata la autorizacion a ESTE tenant; es lo que
 * impide que alguien vincule una cuenta ajena.
 */
export async function getPaymentsConnectUrl(): Promise<string> {
  const { data } = await api.get<{ authorizationUrl: string }>(
    "/payments/mercadopago/connect",
  );

  return data.authorizationUrl;
}

/**
 * Desconecta la cuenta.
 *
 * Borra los tokens pero **conserva la politica de cobro** configurada: si el
 * cliente vuelve a conectar, no tiene que reconfigurarla.
 */
export async function disconnectPayments(): Promise<void> {
  await api.delete("/payments/mercadopago/connection");
}
