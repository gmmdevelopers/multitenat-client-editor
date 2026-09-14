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
