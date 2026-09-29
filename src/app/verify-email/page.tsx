"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { getErrorMessage } from "@/lib/api/errors";
import { verifyEmail } from "@/lib/api/email";

/**
 * Pantalla donde aterriza el enlace del correo.
 *
 * El token llega en la query (`?token=...`). La verificacion se hace UNA vez al
 * montar, y el resultado se guarda en estado: no puede depender de un click,
 * porque el cliente ya pulso el enlace del correo para llegar aqui.
 *
 * `useSearchParams` exige un limite de Suspense para poder prerenderizar.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyingState />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

type Result =
  | { kind: "loading" }
  | { kind: "ok"; email: string; tenantSlug: string }
  | { kind: "error"; message: string };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [result, setResult] = useState<Result>({ kind: "loading" });

  /**
   * Guarda contra el doble envio.
   *
   * En StrictMode React monta, desmonta y remonta: sin esta marca, el token se
   * consumiria en el primer intento y el segundo daria "ya expiro", mostrando un
   * error al cliente que en realidad si verifico su cuenta.
   *
   * Es un `useRef` y no estado porque debe sobrevivir al remontaje sin provocar
   * un render extra.
   */
  const alreadySent = useRef(false);

  useEffect(() => {
    if (alreadySent.current) return;

    if (!token) {
      setResult({
        kind: "error",
        message:
          "El enlace no incluye el codigo de verificacion. Copia la direccion completa del correo.",
      });
      return;
    }

    alreadySent.current = true;

    void verifyEmail(token)
      .then((data) => setResult({ kind: "ok", ...data }))
      .catch((error: unknown) =>
        setResult({
          kind: "error",
          message: getErrorMessage(
            error,
            "No pudimos confirmar tu correo. El enlace puede haber expirado.",
          ),
        }),
      );
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center shadow-2xl backdrop-blur">
          {result.kind === "loading" ? <VerifyingState /> : null}

          {result.kind === "ok" ? (
            <SuccessState email={result.email} tenantSlug={result.tenantSlug} />
          ) : null}

          {result.kind === "error" ? (
            <ErrorState message={result.message} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VerifyingState() {
  return (
    <>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-white">
        Confirmando tu correo...
      </h1>
      <p className="mt-1.5 text-sm text-gray-400">Es solo un momento.</p>
    </>
  );
}

function SuccessState({
  email,
  tenantSlug,
}: {
  email: string;
  tenantSlug: string;
}) {
  return (
    <>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-900 bg-emerald-950/40">
        <span aria-hidden className="text-lg text-emerald-400">
          ✓
        </span>
      </div>

      <h1 className="text-xl font-bold tracking-tight text-white">
        Correo confirmado
      </h1>

      <p className="mt-2 text-sm text-gray-400">
        <span className="font-medium text-gray-300">{email}</span> quedo
        verificado.
      </p>

      <p className="mt-4 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs leading-relaxed text-gray-400">
        Ya puedes publicar tu sitio y contratar un plan.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {/* Si el cliente abrio el enlace en otro dispositivo, este boton le
            lleva al editor de su organizacion. */}
        <Link
          href="/"
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Ir a mi panel
        </Link>

        <p className="text-[11px] text-gray-600">
          Tu organizacion:{" "}
          <span className="font-mono text-gray-500">{tenantSlug}</span>
        </p>
      </div>
    </>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-900 bg-amber-950/30">
        <span aria-hidden className="text-lg text-amber-400">
          ⚠
        </span>
      </div>

      <h1 className="text-xl font-bold tracking-tight text-white">
        No pudimos confirmarlo
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-gray-400">{message}</p>

      <p className="mt-4 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs leading-relaxed text-gray-400">
        Entra a tu panel y pide un enlace nuevo desde el aviso de la parte
        superior.
      </p>

      <Link
        href="/login"
        className="mt-6 block w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Ir a iniciar sesion
      </Link>
    </>
  );
}
