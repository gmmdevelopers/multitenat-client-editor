"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { api } from "./client";

/**
 * Conexion en vivo al chat.
 *
 * ## Por que un ticket y no el token
 *
 * Un WebSocket no permite mandar cabeceras desde el navegador, asi que el token
 * de sesion acabaria en la query: escrito en logs del servidor, del proxy y del
 * CDN, y valido **30 dias**. El ticket caduca en 30 segundos y solo sirve una
 * vez: lo que puede filtrarse, en el peor caso, es un codigo ya usado.
 *
 * ## Por que reconecta pidiendo un ticket NUEVO
 *
 * El ticket se quema al conectar. Al reconectar (cambio de red, servidor que se
 * reinicia), el mismo ticket ya no vale: hay que pedir otro. Por eso
 * `auth` es una **funcion** y no un objeto: socket.io la llama en cada intento.
 */

/** Base del socket: el mismo host que el API, sin el `/api` del path. */
function socketBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

  // `http://host:3000/api` -> `http://host:3000`; el path lo pone el gateway.
  return apiUrl.replace(/\/api\/?$/, "");
}

interface LiveChatOptions {
  /**
   * Pide un ticket al backend.
   *
   * Lo aporta cada consumidor porque el endpoint es distinto segun quien llama:
   * el staff usa `/staff/inbox/ticket` y el paciente `/patient/chat/ticket`.
   */
  fetchTicket: () => Promise<string>;
  /** Manejadores, por nombre de evento. */
  onEvent: (event: string, payload: unknown) => void;
  /** Se activa o desactiva la conexion (util para no conectar en pantallas ocultas). */
  enabled?: boolean;
}

/**
 * Conecta al socket del chat y entrega los eventos.
 *
 * Devuelve `connected`, que sirve para mostrar un indicador: si el socket cae,
 * el aviso en pantalla evita que el staff crea que no hay mensajes cuando en
 * realidad no esta recibiendo nada.
 */
export function useLiveChat({
  fetchTicket,
  onEvent,
  enabled = true,
}: LiveChatOptions): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  /**
   * El manejador en una `ref`.
   *
   * Si fuera dependencia del efecto, cada render reconectaria el socket: el
   * consumidor casi siempre pasa una funcion nueva, asi que la dependencia
   * cambiaria siempre.
   */
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const fetchTicketRef = useRef(fetchTicket);
  fetchTicketRef.current = fetchTicket;

  useEffect(() => {
    if (!enabled) return;

    /** El socket se reconecta solo; el cleanup lo cierra. */
    const socket: Socket = io(socketBaseUrl(), {
      path: "/api/socket.io",
      /**
       * El ticket se pide **en cada intento de conexion**.
       *
       * `auth` como funcion y no como objeto: el ticket es de un solo uso, asi
       * que uno ya canjeado no sirve para reconectar. Pidiendolo aqui, cada
       * reintento lleva uno nuevo.
       */
      auth: async (cb: (data: { ticket?: string }) => void) => {
        try {
          cb({ ticket: await fetchTicketRef.current() });
        } catch {
          // Sin ticket, el servidor cierra la conexion. Devolver `{}` deja que
          // socket.io reintente en vez de romper el ciclo de reconexion.
          cb({});
        }
      },
      // Reconexion con espera creciente: un movil sin red no debe martillear.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // El transporte de polling primero y luego websocket: es lo que hace
      // socket.io por defecto y funciona en redes que bloquean WS directo.
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    /**
     * Eventos del chat.
     *
     * Se registran uno a uno y no con `onAny`: `onAny` capturaria tambien los
     * eventos internos de socket.io, y el consumidor tendria que filtrarlos.
     */
    for (const event of ["message:new", "conversation:new", "read"]) {
      socket.on(event, (payload: unknown) =>
        onEventRef.current(event, payload),
      );
    }

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}

/** Pide el ticket del STAFF (la bandeja del panel). */
export async function fetchStaffTicket(): Promise<string> {
  const { data } = await api.post<{ ticket: string }>("/staff/inbox/ticket");

  return data.ticket;
}
