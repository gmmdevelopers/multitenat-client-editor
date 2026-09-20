"use client";

import type { ComponentType } from "react";

import { ConnectedSchedulerBlock } from "./ConnectedSchedulerBlock";

/**
 * Componentes que necesitan logica de cliente (HTTP, estado, sesion).
 *
 * El design system es presentacional y no puede hablar con la API. El editor,
 * en cambio, necesita que ciertos bloques funcionen de verdad (por ejemplo la
 * agenda). Este registro mapea `metaName` -> componente conectado, y el Canvas
 * lo consulta ANTES del registry del design system.
 *
 * Si un organismo no esta aca, se renderiza el del design system tal cual.
 */
export const CONNECTED_ORGANISMS: Record<string, ComponentType<any>> = {
  AppointmentScheduler: ConnectedSchedulerBlock,
};
