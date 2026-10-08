import { api } from "./client";

/**
 * Agenda: horario de atencion del negocio.
 *
 * Los endpoints viven bajo `/schedule` y se guardan la SEMANA COMPLETA en un
 * solo PUT, no dia por dia. El motivo esta en el DTO del backend: enviar un dia
 * suelto obligaria a 7 peticiones y dejaria la agenda en estados intermedios
 * (un martes guardado y un miercoles no) si el cliente cierra la pestaña a
 * medias.
 */

/** Un dia del horario del negocio, tal como lo devuelve el API. */
export interface BusinessHoursDay {
  /** 0 = domingo ... 6 = sabado, igual que `Date.getDay()`. */
  dayOfWeek: number;
  /**
   * Si el dia tiene fila propia en la base.
   *
   * Distinto de `isClosed`: un dia puede estar configurado Y cerrado (el
   * cliente lo cerro a proposito, conservando las horas). Sin esta distincion,
   * la UI no podria decir "no configurado" de "cerrado".
   */
  isConfigured: boolean;
  isClosed: boolean;
  /** `HH:mm`. Nulo si el dia nunca se configuro. */
  opensAt: string | null;
  closesAt: string | null;
}

export interface BusinessHoursResponse {
  /** Siempre los 7 dias, en orden (0 -> 6). */
  days: BusinessHoursDay[];
}

/** Los 7 dias del horario del negocio. */
export async function getBusinessHours(): Promise<BusinessHoursResponse> {
  const { data } = await api.get<BusinessHoursResponse>("/schedule/business-hours");

  return data;
}

/** Un dia que se envia al guardar. */
export interface BusinessHoursEntry {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed?: boolean;
}

/**
 * Guarda el horario del negocio.
 *
 * Se manda la semana entera. Los dias que NO se envien quedan cerrados (lo dice
 * el propio endpoint), asi que la pantalla debe enviar siempre 7.
 */
export async function updateBusinessHours(
  days: BusinessHoursEntry[],
): Promise<BusinessHoursResponse> {
  const { data } = await api.put<BusinessHoursResponse>(
    "/schedule/business-hours",
    { days },
  );

  return data;
}

/**
 * Nombres de los dias, indexados por `dayOfWeek`.
 *
 * Se declara aqui y no se deriva de `Date` a proposito: `toLocaleDateString`
 * depende del locale del NAVEGADOR, asi que el mismo panel mostraria "Monday" a
 * un cliente con el equipo en ingles. El orden del indice es el del API
 * (0 = domingo), no el de la semana laboral.
 */
export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

/**
 * Orden en que se muestran los dias: lunes primero.
 *
 * La semana laboral empieza el lunes, aunque `dayOfWeek` empiece el domingo.
 * Mostrar el domingo arriba obliga al cliente a buscar su primer dia de trabajo.
 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/* ------------------------------------------------------------------ *
 * Bloqueos de agenda (feriados, vacaciones, cierres)
 * ------------------------------------------------------------------ */

/** Un bloqueo tal como lo devuelve el API. */
export interface TimeOff {
  id: string;
  /** Nulo = bloquea TODO el negocio. */
  professionalId: string | null;
  /** Instante de inicio (ISO 8601, en UTC). */
  startsAt: string;
  endsAt: string;
  /** Motivo visible en el calendario. Nulo si no se indico. */
  reason: string | null;
}

/**
 * Zona horaria del negocio.
 *
 * Los bloqueos se guardan como instantes, pero el cliente piensa en DIAS de
 * calendario ("el 25 esta cerrado"). La conversion entre ambos depende de la
 * zona, y Chile cambia de horario dos veces al ano (UTC-4 en invierno, UTC-3 en
 * verano). Guardar `00:00Z` dejaria el feriado empezando a las 21:00 del dia
 * ANTERIOR en hora local.
 *
 * Se usa la zona real y no un offset fijo precisamente por eso: un `-03:00`
 * hardcodeado se rompe medio ano.
 */
export const BUSINESS_TIME_ZONE = "America/Santiago";

/**
 * Offset de una zona, en minutos, para un instante dado.
 *
 * `Intl` con `timeZone` es la unica via sin dependencias que respeta el horario
 * de verano: `getTimezoneOffset()` del navegador devuelve el del USUARIO, no el
 * del negocio, y un cliente de viaje lo tendria mal.
 */
function timeZoneOffsetMinutes(timeZone: string, date: Date): number {
  // `en-US` con `longOffset` da "GMT-03:00"; se parsea el offset de ahi.
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  // "GMT-03:00" | "GMT-3" | "GMT" (UTC).
  const match = formatted?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);

  return sign * (hours * 60 + minutes);
}

/**
 * Convierte `YYYY-MM-DD` + hora local de Chile a un instante UTC (ISO).
 *
 * El truco es iterar una vez: el offset depende del instante, y el instante
 * depende del offset. La estimacion se ancla al mediodia local y se corrige con
 * el offset real del instante resultante (ver el comentario dentro).
 *
 * Verificado con las fechas de borde de 2026, incluidos los dos cambios de
 * horario de verano, y con ida y vuelta
 * `instantToLocalDate(localDateToInstant(d))` === `d`.
 */
export function localDateToInstant(
  date: string,
  time: "start" | "end",
): string {
  const [year, month, day] = date.split("-").map(Number);

  // Hora local deseada: inicio = 00:00, fin = 23:59:59.999 del MISMO dia.
  // La fecha se toma como UTC solo para CONSTRUIR el numero; el offset se
  // aplica despues.
  const target =
    time === "start"
      ? Date.UTC(year, month - 1, day, 0, 0, 0, 0)
      : Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  // PRIMERA estimacion ancorada al MEDIODIA local, no a la medianoche.
  //
  // La transicion de horario de verano en Chile es a medianoche (23:00 del
  // sabado pasa a 00:00 del domingo). Estimando con la medianoche, en el dia del
  // cambio ya estaria vigente el horario NUEVO y la correccion se aplicaba al
  // reves: el 2026-09-06 caia en el DIA ANTERIOR (medido con una prueba).
  // El mediodia queda lejos de la transicion y da un offset estable.
  const offset = timeZoneOffsetMinutes(
    BUSINESS_TIME_ZONE,
    new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)),
  );

  // `target` se construyo como si fuera UTC; para obtener el instante real hay
  // que RESTAR el offset (Chile va por detras de UTC).
  const corrected = new Date(target - offset * 60_000);

  // Segunda pasada: si el offset cambio (borde de horario de verano), el
  // instante corregido puede tener otro offset.
  const secondOffset = timeZoneOffsetMinutes(BUSINESS_TIME_ZONE, corrected);
  if (secondOffset !== offset) {
    return new Date(target - secondOffset * 60_000).toISOString();
  }

  return corrected.toISOString();
}

/**
 * Convierte un instante UTC a `YYYY-MM-DD` en hora de Chile.
 *
 * Se usa para rellenar los formularios al EDITAR: mostrar la fecha en UTC daria
 * el dia anterior para cualquier bloqueo que empiece de noche.
 */
export function instantToLocalDate(instant: string): string {
  const date = new Date(instant);

  // `en-CA` produce `YYYY-MM-DD`, que es justo el formato del `<input type="date">`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Bloqueos vigentes o futuros.
 *
 * El backend NO devuelve los pasados: filtrar por `endsAt >= ahora` es
 * deliberado, porque un historico de bloqueos vencidos solo estorba en esta
 * pantalla.
 */
export async function listTimeOff(): Promise<TimeOff[]> {
  const { data } = await api.get<TimeOff[]>("/schedule/time-off");

  return data;
}

/**
 * Crea un bloqueo a partir de DIAS de calendario.
 *
 * Recibe `YYYY-MM-DD` (lo que da el `<input type="date">`) y hace la conversion
 * a instantes con la zona del NEGOCIO: del dia completo, de 00:00 a 23:59:59.
 * Sin esto, el feriado empezaria la vispera por la tarde.
 */
export async function createTimeOff(payload: {
  /** `YYYY-MM-DD`, primer dia bloqueado (inclusive). */
  startsOn: string;
  /** `YYYY-MM-DD`, ultimo dia bloqueado (inclusive). */
  endsOn: string;
  reason?: string;
  /** Si se omite, bloquea TODO el negocio. */
  professionalId?: string;
}): Promise<TimeOff> {
  const { data } = await api.post<TimeOff>("/schedule/time-off", {
    startsAt: localDateToInstant(payload.startsOn, "start"),
    endsAt: localDateToInstant(payload.endsOn, "end"),
    reason: payload.reason,
    professionalId: payload.professionalId,
  });

  return data;
}

/** Quita un bloqueo. La agenda vuelve a estar disponible en ese rango. */
export async function removeTimeOff(id: string): Promise<void> {
  await api.delete(`/schedule/time-off/${id}`);
}

/* ------------------------------------------------------------------ *
 * Horario propio de un profesional
 * ------------------------------------------------------------------ */

/**
 * Un dia del horario de un profesional.
 *
 * La clave esta en `isCustom`:
 *
 *   - `isCustom: true`  -> el dia tiene horario PROPIO (una excepcion).
 *   - `isCustom: false` -> el dia HEREDA el horario del negocio, y las horas
 *     que llegan en esta respuesta son las heredadas.
 *
 * Es la distincion que hace la interfaz explicable: sin ella, el cliente veria
 * horas en un dia y no sabria si son suyas o del negocio.
 */
export interface ProfessionalScheduleDay {
  dayOfWeek: number;
  /** Nombre del dia, ya resuelto por el backend. */
  dayName: string;
  /** `true` si el dia tiene horario propio y no hereda. */
  isCustom: boolean;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  /** Descanso en `HH:mm`. Nulo si no tiene. */
  breakStartsAt: string | null;
  breakEndsAt: string | null;
}

export interface ProfessionalScheduleResponse {
  professionalId: string;
  professionalName: string;
  /** Siempre los 7 dias, en orden (0 -> 6). */
  days: ProfessionalScheduleDay[];
}

/** Horario de un profesional, con la herencia ya resuelta por el backend. */
export async function getProfessionalSchedule(
  professionalId: string,
): Promise<ProfessionalScheduleResponse> {
  const { data } = await api.get<ProfessionalScheduleResponse>(
    `/schedule/professionals/${professionalId}`,
  );

  return data;
}

export interface ProfessionalScheduleEntry {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  breakStartsAt?: string | null;
  breakEndsAt?: string | null;
  isClosed?: boolean;
}

/**
 * Guarda el horario propio de un profesional.
 *
 * IMPORTANTE: los dias que NO se envien se BORRAN y vuelven a heredar el del
 * negocio. Es lo que el cliente espera al quitar la excepcion de un dia, pero
 * significa que enviar la lista vacia borra TODAS sus excepciones.
 */
export async function updateProfessionalSchedule(
  professionalId: string,
  days: ProfessionalScheduleEntry[],
): Promise<ProfessionalScheduleResponse> {
  const { data } = await api.put<ProfessionalScheduleResponse>(
    `/schedule/professionals/${professionalId}`,
    { days },
  );

  return data;
}
/* ------------------------------------------------------------------ *
 * Feriados nacionales (sugerencias)
 * ------------------------------------------------------------------ */

/** Un feriado nacional, tal como lo devuelve nuestro backend. */
export interface Holiday {
  /** `YYYY-MM-DD`. */
  date: string;
  title: string;
  /**
   * `true` = irrenunciable (el comercio no puede abrir).
   *
   * Es informativo: puede ayudar a decidir, pero NO impide crear el bloqueo ni
   * se aplica solo. Un negocio puede trabajar igual.
   */
  inalienable: boolean;
}

export interface HolidaysResponse {
  holidays: Holiday[];
  /**
   * `false` si la fuente externa fallo y no hay datos.
   *
   * La peticion sigue siendo 200: la pantalla debe ESCONDER el atajo de
   * feriados, no mostrar un error. Los feriados son una comodidad, y bloquear
   * la pantalla por un tercero caido seria peor que no ofrecerlos.
   */
  available: boolean;
}

/**
 * Feriados nacionales del año en curso, para sugerir bloqueos.
 *
 * NO crea nada: el cliente elige cuales quiere y se crean con `createTimeOff`.
 */
export async function listHolidays(): Promise<HolidaysResponse> {
  const { data } = await api.get<HolidaysResponse>("/schedule/holidays");

  return data;
}