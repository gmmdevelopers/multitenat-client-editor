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
  const { data } = await api.get<BusinessHoursResponse>(
    "/schedule/business-hours",
  );

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

/**
 * Zona horaria del negocio.
 *
 * Se declara aqui y no se lee del sistema porque el panel lo abre alguien desde
 * cualquier sitio: el dueño puede estar de viaje y el navegador estar en otra
 * zona. Las fechas de la agenda son las del NEGOCIO, no las de quien mira.
 *
 * El dia que haya clientes en otro pais, esto pasa a leerse del tenant.
 */
export const BUSINESS_TIME_ZONE = "America/Santiago";

/**
 * Convierte un instante ISO a la fecha LOCAL del negocio (`YYYY-MM-DD`).
 *
 * ## Por que no vale `toISOString().slice(0, 10)`
 *
 * Ese atajo usa la fecha en **UTC**. Un bloqueo que empieza a las 21:00 del 25 de
 * diciembre en Chile (UTC-3) es `2026-12-26T00:00Z`: el panel lo mostraria el dia
 * **26**, un dia tarde.
 *
 * `Intl.DateTimeFormat` con la zona del negocio da el dia que el cliente ve en su
 * calendario, sin depender de la zona del navegador.
 */
export function instantToLocalDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Convierte un dia de calendario (`YYYY-MM-DD`) al instante de su inicio o fin.
 *
 * `edge: "start"` da las 00:00:00 y `"end"` las 23:59:59.999, **en la zona del
 * negocio**. Es lo que espera el backend: el primer y el ultimo dia del bloqueo
 * entran enteros.
 *
 * Se construye a mano el desfase porque `new Date("2026-12-25")` se interpreta
 * como UTC medianoche, que en Chile es el dia anterior a las 21:00.
 */
function localDayToInstant(date: string, edge: "start" | "end"): string {
  const [year, month, day] = date.split("-").map(Number);

  /**
   * El desfase se calcula PARA ESA FECHA, no con un `-3` fijo.
   *
   * Chile cambia de horario dos veces al año (`-4` en verano austral, `-3` en
   * invierno). Un valor fijo desplazaria una hora la mitad de las fechas.
   *
   * ## Como se obtiene
   *
   * Se toma el **mediodia UTC** de ese dia y se pregunta que hora marca el
   * reloj del negocio para ese instante. El mediodia y no la medianoche: en los
   * dias del cambio de horario, la medianoche no existe o se repite, y el calculo
   * se volveria ambiguo.
   *
   * La diferencia entre las dos horas es el desfase del negocio respecto de UTC.
   */
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const businessTime = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(noonUtc);

  const [bh, bm] = businessTime.split(":").map(Number);
  const offsetMinutes = bh * 60 + bm - 12 * 60;

  const base = Date.UTC(
    year,
    month - 1,
    day,
    edge === "start" ? 0 : 23,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 999,
  );

  /**
   * `base` es la hora del negocio expresada como si fuera UTC. Para obtener el
   * instante real hay que **restar** el desfase: las 00:00 en Santiago son las
   * 03:00 UTC cuando el desfase es `-3`.
   */
  return new Date(base - offsetMinutes * 60_000).toISOString();
}

// ---------------------------------------------------------------------------
// Horario por profesional
// ---------------------------------------------------------------------------

/** Un dia del horario PROPIO de un profesional. */
export interface ProfessionalScheduleDay {
  dayOfWeek: number;
  /**
   * `true` si el dia tiene horario propio (una excepcion).
   *
   * `false` = **hereda** el del negocio, y las horas que llegan son las
   * heredadas. Sin esta distincion no se sabe si tocar el dia cambia solo a esta
   * persona o si no hace falta.
   */
  isCustom: boolean;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStartsAt: string | null;
  breakEndsAt: string | null;
}

export interface ProfessionalScheduleResponse {
  professionalId: string;
  professionalName: string;
  /** Siempre los 7 dias, en orden (0 -> 6). */
  days: ProfessionalScheduleDay[];
}

/** El horario de un profesional, con la herencia ya resuelta. */
export async function getProfessionalSchedule(
  professionalId: string,
): Promise<ProfessionalScheduleResponse> {
  const { data } = await api.get<ProfessionalScheduleResponse>(
    `/schedule/professionals/${professionalId}`,
  );

  return data;
}

/** Un dia que se envia al guardar el horario de un profesional. */
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
 * Los dias que **no** se envian se borran: ese dia vuelve a heredar el horario
 * del negocio. Es lo que se espera al quitar una fila, pero significa que una
 * lista vacia borra todas las excepciones de esa persona.
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

// ---------------------------------------------------------------------------
// Bloqueos de agenda
// ---------------------------------------------------------------------------

/** Un bloqueo: feriado, vacaciones o un cierre puntual. */
export interface TimeOff {
  id: string;
  /** Inicio del bloqueo (ISO 8601). */
  startsAt: string;
  endsAt: string;
  reason: string | null;
  /** `null` = bloquea **todo** el negocio. */
  professionalId: string | null;
}

/**
 * Los bloqueos vigentes o futuros.
 *
 * El backend no devuelve los pasados: un historico de bloqueos vencidos solo
 * estorba al organizar la agenda.
 *
 * Con `professionalId` se suman los suyos a los del negocio (un feriado afecta a
 * todos). Sin el, solo los del negocio.
 */
export async function listTimeOff(professionalId?: string): Promise<TimeOff[]> {
  const params = professionalId ? { professionalId } : undefined;

  const { data } = await api.get<TimeOff[]>("/schedule/time-off", { params });

  return data;
}

/**
 * Crea un bloqueo a partir de **dias de calendario**.
 *
 * Se reciben `YYYY-MM-DD` y no instantes porque es lo que elige el cliente ("del
 * 25 al 26"). La conversion a instantes la hace `localDayToInstant`, con la zona
 * del negocio, y el ultimo dia entra entero.
 */
export async function createTimeOff(payload: {
  /** `YYYY-MM-DD`, primer dia bloqueado (inclusive). */
  startsOn: string;
  /** `YYYY-MM-DD`, ultimo dia bloqueado (inclusive). */
  endsOn: string;
  reason?: string;
  /** Si se omite, bloquea **todo** el negocio. */
  professionalId?: string;
}): Promise<TimeOff> {
  const { data } = await api.post<TimeOff>("/schedule/time-off", {
    startsAt: localDayToInstant(payload.startsOn, "start"),
    endsAt: localDayToInstant(payload.endsOn, "end"),
    // Sin motivo se manda `null` y no cadena vacia: una cadena vacia en la base
    // parece rellena y no lo esta.
    reason: payload.reason?.trim() || null,
    ...(payload.professionalId
      ? { professionalId: payload.professionalId }
      : {}),
  });

  return data;
}

/** Quita un bloqueo: la agenda vuelve a estar disponible en ese rango. */
export async function removeTimeOff(id: string): Promise<void> {
  await api.delete(`/schedule/time-off/${id}`);
}

/** Un feriado nacional, como sugerencia para bloquear. */
export interface Holiday {
  /** `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** `true` = irrenunciable. Dato informativo: ayuda a decidir. */
  inalienable: boolean;
}

export interface HolidaysResponse {
  holidays: Holiday[];
  /**
   * `false` si la fuente externa fallo.
   *
   * La peticion sigue siendo exitosa a proposito: la pantalla debe **esconder**
   * el atajo de feriados, no mostrar un error. Los feriados son una comodidad, y
   * romper la pantalla por un tercero caido seria peor que no ofrecerlos.
   */
  available: boolean;
}

/**
 * Feriados nacionales del año en curso, para **sugerir** bloqueos.
 *
 * No crea nada: devuelve la lista para que el cliente elija. Aplicarlos solos
 * cerraria la agenda de un negocio que si trabaja ese dia.
 */
export async function listHolidays(): Promise<HolidaysResponse> {
  const { data } = await api.get<HolidaysResponse>("/schedule/holidays");

  return data;
}
