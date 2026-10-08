/**
 * Utilidades de fecha para el calendario semanal.
 *
 * Todo trabaja en HORA LOCAL del navegador, no en UTC: el cliente piensa en
 * "el lunes a las 10", y usar UTC desplazaria las citas varias horas segun la
 * zona. El backend guarda instantes (UTC) y aqui se convierten al pintar.
 */

/** Lunes de la semana a la que pertenece una fecha. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  // `getDay()` devuelve 0 para domingo. La semana del calendario empieza en
  // lunes, asi que el domingo retrocede 6 dias y no avanza 1.
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);

  return result;
}

/** Suma dias a una fecha, devolviendo una nueva (no muta la original). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Los 7 dias de la semana, empezando en lunes. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** `true` si las dos fechas son el mismo dia local. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `HH:mm` de una fecha, en hora local. */
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Minutos desde medianoche de una fecha, en hora local.
 *
 * Es la unidad con la que se posicionan los eventos: la rejilla mide en minutos
 * y asi el calculo de `top` y `height` es una regla de tres.
 */
export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Etiqueta corta del dia ("lun 6"). */
export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
  });
}

/** Rango ISO de la semana, para pedirla al backend. */
export function weekRange(weekStart: Date): {
  startsAt: string;
  endsAt: string;
} {
  const startsAt = new Date(weekStart);
  startsAt.setHours(0, 0, 0, 0);

  const endsAt = addDays(weekStart, 7);
  endsAt.setHours(0, 0, 0, 0);

  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}
