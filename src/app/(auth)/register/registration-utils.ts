"use client";

/**
 * Utilidades compartidas por los pasos del registro.
 *
 * Viven aparte del componente para que cada paso sea un archivo con su
 * formulario, y no un unico archivo de 600 lineas.
 */

/** Valida el RUT chileno con digito verificador (modulo 11). */
export function isValidRut(raw: string): boolean {
  const cleaned = raw.replace(/[.\-\s]/g, "").toUpperCase();

  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;

  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);

  let sum = 0;
  let factor = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected =
    remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  return expected === verifier;
}

/**
 * Convierte un nombre en identificador de sitio.
 *
 * Debe coincidir con `normalizeSlug` del backend: si aqui se mostrara una URL y
 * el backend guardara otra, el cliente veria una direccion que no es la suya.
 */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/** Formatea el monto en pesos, sin decimales (CLP no los usa). */
export function formatClp(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

/** Prefijo telefonico de Chile. */
export const PHONE_PREFIX = "+56";

/**
 * Aplica la mascara `9 9999 9999` mientras el usuario escribe.
 *
 * Se descartan todos los caracteres que no sean digitos y se reagrupan: asi da
 * igual que pegue `+56912345678`, `9 1234 5678` o `912345678` — todos acaban en
 * el mismo valor.
 *
 * El `+56` NO forma parte del valor guardado: se muestra como prefijo fijo al
 * lado del campo. Guardarlo obligaria a limpiarlo en el backend, y el mismo
 * numero podria llegar como `+56912345678` o `912345678` segun como lo escribiera
 * el cliente.
 *
 * El 9 inicial es el prefijo movil de Chile. Si el usuario escribe un numero
 * fijo (que empieza en 2, 3...), se respeta: solo se agrupa, no se corrige.
 */
export function formatPhoneMask(raw: string): string {
  // Se descartan el prefijo internacional y los separadores que el usuario haya
  // pegado. `+56` y `56` iniciales se quitan solo si detras viene el 9 movil,
  // para no mutilar un numero que empiece por 56 por casualidad.
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("56") && digits.length > 9) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 9);

  if (digits.length === 0) return "";

  // 1 digito -> `9`
  if (digits.length <= 1) return digits;
  // 2 a 5 -> `9 9999`
  if (digits.length <= 5) return `${digits[0]} ${digits.slice(1)}`;
  // 6 a 9 -> `9 9999 9999`
  return `${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`;
}

/**
 * Deja solo los digitos del telefono, sin el prefijo del pais.
 *
 * El backend valida el largo, asi que se manda el valor normalizado y no lo que
 * se ve en pantalla (que lleva espacios).
 */
export function toNationalDigits(formatted: string): string {
  let digits = formatted.replace(/\D/g, "");

  if (digits.startsWith("56") && digits.length > 9) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 9);
}

/** true si el telefono tiene los 9 digitos de un movil chileno. */
export function isPhoneComplete(formatted: string): boolean {
  return toNationalDigits(formatted).length === 9;
}

export interface RegistrationDraft {
  // Paso 1: cuenta
  fullName: string;
  email: string;
  password: string;

  // Paso 2: negocio
  name: string;
  legalName: string;
  businessType: string;
  taxId: string;
  phone: string;
  slug: string;

  // Paso 3: plan
  requestedPlan: string;
  /** Cupon opcional. Se envia tal cual y lo valida el backend. */
  couponCode: string;
}

export const INITIAL_DRAFT: RegistrationDraft = {
  fullName: "",
  email: "",
  password: "",
  name: "",
  legalName: "",
  businessType: "",
  taxId: "",
  phone: "",
  slug: "",
  requestedPlan: "",
  couponCode: "",
};
