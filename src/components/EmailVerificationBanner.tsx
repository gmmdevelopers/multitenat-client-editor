"use client";

import { useState } from "react";
import { MailWarning, X } from "lucide-react";

import { useEmailVerification } from "@/hooks/useEmailVerification";

/**
 * Aviso de "confirma tu correo", en la parte superior del panel.
 *
 * Que se puede hacer sin verificar (opcion B): entrar, crear y editar el sitio,
 * y previsualizarlo. Lo que NO: publicar y contratar un plan. El texto lo dice
 * asi, en positivo, para que el cliente entienda que puede seguir trabajando.
 *
 * Se puede cerrar, pero vuelve al recargar: es un aviso persistente, no un
 * mensaje que se descarte para siempre. Si desapareciera hasta la siguiente
 * sesion, el cliente que intenta publicar sin recordarlo se encontraria un 403
 * sin contexto.
 */
export function EmailVerificationBanner() {
  const { verified, email, isResending, notice, error, resend } =
    useEmailVerification();

  const [dismissed, setDismissed] = useState(false);

  // `null` = aun comprobando, o la consulta fallo. En ningun caso se avisa.
  if (verified !== false || dismissed) return null;

  return (
    <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-200">
            Confirma tu correo para publicar tu sitio
          </p>

          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">
            Te enviamos un enlace a{" "}
            <span className="font-medium text-amber-200">{email}</span>. Puedes
            seguir editando mientras tanto; solo falta para publicar y contratar
            un plan.
          </p>

          {notice ? (
            <p className="mt-1.5 text-xs font-medium text-emerald-400">
              {notice}
            </p>
          ) : null}

          {error ? (
            <p className="mt-1.5 text-xs font-medium text-red-400">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void resend()}
            disabled={isResending}
            className="mt-2 rounded-md border border-amber-800 bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-900/60 disabled:opacity-50"
          >
            {isResending ? "Enviando..." : "Reenviar el correo"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="rounded p-1 text-amber-500/70 transition hover:bg-amber-900/40 hover:text-amber-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
