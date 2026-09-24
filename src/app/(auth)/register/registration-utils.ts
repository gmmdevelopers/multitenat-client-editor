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
};
