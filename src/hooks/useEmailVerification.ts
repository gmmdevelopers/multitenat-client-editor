"use client";

import { useCallback, useEffect, useState } from "react";

import { getEmailStatus, resendVerification } from "@/lib/api/email";
import { getErrorMessage } from "@/lib/api/errors";

type EmailVerificationState = {
  /** `null` mientras se comprueba el estado. */
  verified: boolean | null;
  email: string | null;
  isResending: boolean;
  /** Mensaje para el cliente tras pedir el reenvio. */
  notice: string | null;
  error: string | null;
  resend: () => Promise<void>;
  /** Vuelve a consultar el estado (tras verificar en otra pestana). */
  refresh: () => void;
};

/**
 * Estado de verificacion del correo del usuario con sesion.
 *
 * El aviso se muestra en el panel, asi que el estado se consulta al entrar. Si
 * el cliente verifica en otra pestana o en el movil, el `refresh` lo actualiza
 * sin recargar la pagina.
 */
export function useEmailVerification(): EmailVerificationState {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    void getEmailStatus()
      .then((status) => {
        if (cancelled) return;
        setVerified(status.verified);
        setEmail(status.email);
      })
      .catch(() => {
        // Si falla la consulta no se muestra el aviso: es preferible no avisar
        // a mostrar un "confirma tu correo" a quien ya lo tiene confirmado.
        //
        // Tampoco se marca como "sin verificar" para el boton de publicar: un
        // fallo de red no debe bloquear una accion que quiza si esta permitida.
        if (cancelled) return;
        setVerified(null);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const resend = useCallback(async () => {
    if (!email) return;

    setIsResending(true);
    setNotice(null);
    setError(null);

    try {
      await resendVerification(email);
      setNotice("Te enviamos un correo nuevo. Revisa tambien el spam.");
    } catch (caught) {
      setError(getErrorMessage(caught, "No pudimos enviar el correo."));
    } finally {
      setIsResending(false);
    }
  }, [email]);

  return {
    verified,
    email,
    isResending,
    notice,
    error,
    resend,
    refresh,
  };
}
