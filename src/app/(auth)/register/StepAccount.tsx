"use client";

import { useState } from "react";

import {
  Field,
  inputClass,
  inputErrorClass,
  primaryButtonClass,
} from "./fields";
import type { RegistrationDraft } from "./registration-utils";

interface StepAccountProps {
  draft: RegistrationDraft;
  onChange: (patch: Partial<RegistrationDraft>) => void;
  onNext: () => void;
}

/** Minimo de la contrasena, alineado con el `@MinLength(8)` del backend. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Paso 1: la persona que administra la cuenta.
 *
 * Se valida aqui ademas de en el backend para dar respuesta inmediata, pero la
 * validacion del servidor sigue siendo la unica que cuenta: esta se puede
 * saltar desde el navegador.
 */
export function StepAccount({ draft, onChange, onNext }: StepAccountProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors: Record<string, string> = {};

  if (!draft.fullName.trim()) {
    errors.fullName = "Necesitamos tu nombre para la cuenta.";
  }

  if (!draft.email.trim()) {
    errors.email = "El correo es obligatorio.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = "Ese correo no parece valido.";
  }

  if (draft.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Se marcan todos como tocados para que los errores aparezcan al intentar
    // avanzar, no mientras el usuario aun esta escribiendo el primer campo.
    setTouched({ fullName: true, email: true, password: true });

    if (!hasErrors) {
      onNext();
    }
  };

  const fieldError = (name: string) =>
    touched[name] ? errors[name] : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-white">Crea tu cuenta</h2>
        <p className="mt-1 text-xs text-gray-400">
          Con estos datos entraras al panel de tu negocio.
        </p>
      </div>

      <Field
        label="Nombre completo"
        htmlFor="fullName"
        error={fieldError("fullName")}
      >
        <input
          id="fullName"
          data-testid="register-fullName"
          type="text"
          autoComplete="name"
          value={draft.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          placeholder="Ana Perez"
          className={fieldError("fullName") ? inputErrorClass : inputClass}
        />
      </Field>

      <Field
        label="Correo electronico"
        htmlFor="email"
        error={fieldError("email")}
        hint="Aqui te enviaremos la confirmacion y el acceso."
      >
        <input
          id="email"
          data-testid="register-email"
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(e) => onChange({ email: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="ana@mi-negocio.cl"
          className={fieldError("email") ? inputErrorClass : inputClass}
        />
      </Field>

      <Field
        label="Contrasena"
        htmlFor="password"
        error={fieldError("password")}
        hint={`Minimo ${MIN_PASSWORD_LENGTH} caracteres.`}
      >
        <input
          id="password"
          data-testid="register-password"
          type="password"
          autoComplete="new-password"
          value={draft.password}
          onChange={(e) => onChange({ password: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder="••••••••"
          className={fieldError("password") ? inputErrorClass : inputClass}
        />
      </Field>

      <button
        type="submit"
        data-testid="register-next"
        className={primaryButtonClass}
      >
        Continuar
      </button>
    </form>
  );
}
