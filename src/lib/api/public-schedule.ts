import { api } from "./client";

/**
 * Horario de atencion del negocio, para la WEB PUBLICA.
 *
 * Distinto de `lib/api/schedule.ts`, que es el del PANEL: aquel exige sesion y
 * devuelve `isConfigured` (util para editar), este es publico y solo devuelve
 * lo que el visitante necesita ver: cuando abre cada dia.
 *
 * El backend ya recorta la disponibilidad con este horario; aqui solo se
 * MUESTRA, para que el paciente no pruebe fechas a ciegas.
 */

export interface PublicOpeningDay {
  /** 0 = domingo ... 6 = sabado. */
  dayOfWeek: number;
  isClosed: boolean;
  /** `HH:mm`, o `null` si el dia no esta configurado. */
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * Horario de atencion, en los 7 dias.
 *
 * Se devuelve como lista plana y el componente la ordena (lunes primero): el
 * orden de presentacion es una decision de interfaz, no del API.
 */
export async function getPublicBusinessHours(): Promise<PublicOpeningDay[]> {
  const { data } = await api.get<{ days: PublicOpeningDay[] }>(
    "/public/business-hours",
  );

  return data.days;
}
