import type { AxiosError } from "axios";

/**
 * Extrae un mensaje legible de un error de la API.
 *
 * El backend responde `{ message: string | string[] }`, y axios envuelve en
 * `response.data`. Centralizarlo evita repetir el mismo `Array.isArray(...)`
 * en cada pantalla.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado.",
): string {
  const axiosError = error as AxiosError<{ message?: string | string[] }>;
  const message = axiosError?.response?.data?.message;

  if (Array.isArray(message)) {
    return message[0] ?? fallback;
  }

  return message || fallback;
}

/**
 * Codigo de error de negocio que manda la API, si lo hay.
 *
 * ## Por que no basta con `getErrorMessage`
 *
 * Algunos errores NO son un mensaje suelto: el backend manda un `code` para que
 * la pantalla decida que hacer. Por ejemplo, al entrar con un email registrado
 * cuyo pago no se confirmo:
 *
 *     { statusCode: 400, code: "PAYMENT_PENDING", message: "..." }
 *
 * Con solo el mensaje habria que comparar TEXTO, y cualquier cambio de redaccion
 * del backend romperia la pantalla en silencio (el aviso dejaria de salir y
 * nadie lo notaria hasta que un cliente se queje).
 *
 * ## Que devuelve
 *
 * - `null` si el error no trae `code` (404 de una ruta, error de red, tiempo de
 *   espera...). Se devuelve `null` y no `undefined` para que encaje con el
 *   `useState<string | null>` del que lo consume: con `undefined`, cada llamada
 *   necesitaria un `?? null` y es facil olvidarlo en una.
 * - El `code` tal cual si es string y no esta vacio.
 *
 * No se valida contra una lista de codigos conocidos: el backend puede anadir
 * uno nuevo y esta funcion no debe tener que enterarse. Quien lo decide es la
 * pantalla, comparando el codigo que espera.
 */
export function getErrorCode(error: unknown): string | null {
  const axiosError = error as AxiosError<{ code?: unknown }>;
  const code = axiosError?.response?.data?.code;

  return typeof code === "string" && code.length > 0 ? code : null;
}
