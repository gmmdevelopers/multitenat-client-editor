"use client";

import type { ReactNode } from "react";

/**
 * Estilos compartidos por los tres pasos del registro.
 *
 * Estan aqui y no repetidos en cada paso para que un cambio de color o de
 * tamaño no obligue a tocar tres archivos y arriesgar que queden distintos.
 */
export const inputClass =
  "w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50";

export const inputErrorClass =
  "w-full rounded-lg border border-red-500/70 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 transition focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50";

export const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400";

export const hintClass = "mt-1 text-[11px] text-gray-500";

export const primaryButtonClass =
  "w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50";

/** Formatea el monto en pesos chilenos, sin decimales (CLP no los usa). */
export function formatClp(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

export const secondaryButtonClass =
  "rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-800 disabled:opacity-40";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

/**
 * Campo de formulario con etiqueta, ayuda y error.
 *
 * El error se asocia con `aria-describedby` para que un lector de pantalla lo
 * anuncie junto al campo, no como texto suelto.
 */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      <div
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(" ") || undefined
        }
      >
        {children}
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-[11px] font-medium text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
