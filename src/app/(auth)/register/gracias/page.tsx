"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { persistToken } from "@/context/AuthContext";
import { logStep, logWarn, redact } from "@/lib/registration-log";

/**
 * Vuelta del pago con AUTOLOGIN.
 *
 * ## Qué hace
 *
 * El backend redirige aquí tras confirmar el pago de Transbank:
 *
 *     /register/gracias?pago=ok&token=<accessToken>
 *
 * Si llega `token`, se guarda la sesión **antes** de navegar. Así el cliente
 * entra al panel sin volver a escribir el correo y la contraseña que acaba de
 * crear.
 *
 * ## Por qué el token viene por query
 *
 * El retorno llega al dominio del API (`api.<dominio>`) y el panel vive en otro
 * (`app.<dominio>`): una cookie puesta por el backend en el retorno no la
 * leería el panel. La query es el único canal que cruza.
 *
 * ## Sin token
 *
 * Se va al login con el motivo. Pasa si el alta ya estaba provisionada (el
 * cliente recargó el retorno): no se crea una sesión nueva.
 */
function ThanksPage() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get("token");
    const pago = params.get("pago");

    logStep("vuelta del pago", {
      pago: pago ?? "(sin parametro)",
      token: redact(token),
    });

    if (token) {
      persistToken(token);
      logStep("autologin: sesion guardada, entrando al panel");
      // `replace` para que el botón "atrás" no vuelva a esta URL con el token.
      router.replace("/");
      return;
    }

    logWarn("vuelta del pago SIN token: se manda al login", {
      motivo: pago ?? "desconocido",
    });

    if (pago === "cancelado") {
      router.replace("/login?pago=cancelado");
      return;
    }

    if (pago === "error") {
      router.replace("/login?pago=error");
      return;
    }

    router.replace("/login");
  }, [params, router]);

  return (
    <p className="text-sm text-gray-400 text-center">
      Un momento, estamos preparando tu cuenta…
    </p>
  );
}

/**
 * `useSearchParams` exige un `<Suspense>` o el prerender de Next falla con
 * "should be wrapped in a suspense boundary". Mismo patrón que `/login` y
 * `/pago`.
 */
export default function RegisterThanksIndexPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-gray-400 text-center">Preparando…</p>}
    >
      <ThanksPage />
    </Suspense>
  );
}
