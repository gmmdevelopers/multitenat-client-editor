/**
 * Trazas del flujo de registro.
 *
 * ## Por que existe
 *
 * El registro cruza varias pantallas y peticiones (`/register` → `/pago` →
 * Webpay → `/register/gracias`), y cada una puede fallar por un motivo distinto.
 * Sin una marca comun es imposible reconstruir que paso mirando la consola.
 *
 * Todo sale con el prefijo `[registro]`, igual que en el backend, asi que un
 * `grep '[registro]'` junta las trazas de los dos lados.
 *
 * ## Por que no se usa `console.log` directamente
 *
 * - El prefijo y el formato quedan en un solo sitio.
 * - Los datos sensibles (contrasena, numero de tarjeta) se redactan aqui, no en
 *   cada llamada, para que nadie los loguee por descuido.
 * - En produccion se silencia: lo que importa ahi es el log del servidor.
 */

/**
 * `true` en desarrollo.
 *
 * El registro expone datos del cliente (email, slug, ids), que no tienen por que
 * aparecer en la consola de un navegador real en produccion.
 */
const ENABLED = process.env.NODE_ENV !== "production";

/** Marca comun con el backend: permite seguir el flujo con un solo filtro. */
const PREFIX = "[registro]";

/**
 * Deja el mensaje en una linea.
 *
 * La consola del navegador agrupa y recorta objetos; concatenar todo en un
 * string hace que el orden de los pasos sea legible al hacer scroll.
 */
function format(message: string, data?: Record<string, unknown>): string {
  if (!data) return `${PREFIX} ${message}`;

  const pairs = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  return pairs ? `${PREFIX} ${message} ${pairs}` : `${PREFIX} ${message}`;
}

/** Paso normal del flujo. */
export function logStep(message: string, data?: Record<string, unknown>): void {
  if (!ENABLED) return;
  console.log(format(message, data));
}

/** Algo salio mal, pero el flujo lo maneja (reintento, cancelacion...). */
export function logWarn(message: string, data?: Record<string, unknown>): void {
  if (!ENABLED) return;
  console.warn(format(message, data));
}

/** El flujo se corta aqui. Se registra el error ademas del mensaje. */
export function logError(
  message: string,
  error: unknown,
  data?: Record<string, unknown>,
): void {
  if (!ENABLED) return;

  console.error(format(message, data), error);
}

/**
 * Resumen de un valor para el log, sin exponerlo entero.
 *
 * Se usa con tokens y sesiones: saber que existen y cual es su prefijo basta
 * para diagnosticar, y el valor completo en la consola es una fuga innecesaria.
 */
export function redact(value: string | null | undefined): string {
  if (!value) return "(vacio)";
  return `${value.slice(0, 8)}...(${value.length})`;
}
