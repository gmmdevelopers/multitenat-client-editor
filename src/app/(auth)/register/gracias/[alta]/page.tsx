"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import {
  getPendingRegistrationStatus,
  type PendingRegistrationStatus,
} from "@/lib/api/registration";
import { logError, logStep, logWarn } from "@/lib/registration-log";

/**
 * Pantalla a la que el cliente vuelve tras pagar.
 *
 * ## Por que no se entra directo al panel
 *
 * La cuenta NO existe cuando el cliente vuelve: la crea el retorno de Transbank
 * cuando la inscripcion se completa, y ese aviso puede tardar unos segundos. Sin
 * esta pantalla, el cliente aterrizaria en `/login` con un formulario que
 * todavia no sirve, sin saber si su pago funciono.
 *
 * Aqui se consulta el estado del alta hasta que `provisioned` es `true`. Aun asi
 * NO se inicia sesion automaticamente: no hay token (el registro no devuelve
 * sesion), asi que se manda al login con el email ya escrito.
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Cuanto se espera antes de rendirse y ofrecer el boton de reintentar.
 *
 * 10 sondeos = ~30 s. Esperar mas solo alarga la sensacion de "no pasa nada"
 * cuando la confirmacion no llega.
 */
const MAX_POLLS = 10;

/**
 * Saca el id del alta de lo que llegue en `alta`, aunque venga contaminado.
 *
 * ## El bug que corrige
 *
 * Una pasarela NO devuelve al `back_url` tal cual: le concatena sus propios
 * parametros. Y si nuestra URL ya trae query (`?alta=...`), el resultado es
 * ambiguo y acaba **codificando el `?`** como `%3F`, con lo que el id del
 * recurso termina DENTRO de nuestro parametro:
 *
 *   /register/gracias?alta=abc%3Ftoken_ws%3Df82e04c9...
 *
 * Decodificado eso es `abc?token_ws=f82e04c9...`, que como id no existe y el
 * backend responde 404 "El registro no existe".
 *
 * Se corta en el primer `?`: el id es un `cuid` de Prisma y nunca lo contiene.
 * Se recorre dos veces porque la codificacion puede venir doble (`%253F`).
 */
function normalizePendingId(raw: string | null): string {
  let value = raw ?? "";

  for (let i = 0; i < 2 && value.includes("%"); i += 1) {
    try {
      value = decodeURIComponent(value);
    } catch {
      // `%` suelto o secuencia invalida: se queda como esta.
      break;
    }
  }

  return value.split("?")[0].split("&")[0].trim();
}

export default function RegisterThanksPage() {
  const searchParams = useSearchParams();
  // Dos formas, y por que las dos:
  //
  // - `/register/gracias/:alta` (path): la buena. La pasarela añade SUS
  //   parametros al volver, y con el id en el path no hay `?` que mezclar. Antes
  //   iba como `?alta=`, se codificaba el segundo `?` y el id llegaba
  //   contaminado (`abc%3Ftoken_ws%3D...`).
  // - `?alta=` (query): se sigue aceptando para los checkouts creados antes del
  //   arreglo, que aun pueden volver asi.
  const params = useParams<{ alta?: string }>();
  const pendingId = normalizePendingId(
    Array.isArray(params?.alta) ? params.alta[0] : params?.alta ?? searchParams.get("alta"),
  );

  const [status, setStatus] = useState<PendingRegistrationStatus | null>(null);
  const [polls, setPolls] = useState(0);
  const [networkError, setNetworkError] = useState(false);

  const check = useCallback(async () => {
    if (!pendingId) {
      logWarn("sin id de alta: no hay nada que sondear", {
        query: window.location.search,
      });
      return;
    }

    try {
      const result = await getPendingRegistrationStatus(pendingId);

      logStep("GET /tenants/register/:id", {
        alta: pendingId,
        provisioned: result.provisioned,
        slug: result.slug,
      });

      setStatus(result);
      setNetworkError(false);
      return result;
    } catch (error) {
      // Un fallo de red no significa que el pago fallara: se reintenta, porque
      // el siguiente sondeo suele resolverse. Solo se avisa al cliente al final.
      logError("GET /tenants/register/:id FALLO", error, { alta: pendingId });
      setNetworkError(true);
      return null;
    }
  }, [pendingId]);

  useEffect(() => {
    logStep("pantalla de gracias montada", {
      alta: pendingId || "(ninguna)",
      url: window.location.href,
    });

    void check();
  }, [check, pendingId]);

  useEffect(() => {
    if (!pendingId || status?.provisioned || polls >= MAX_POLLS) return;

    const timer = setTimeout(async () => {
      // Sondeo de nuestra base: la cuenta la crea el retorno de Transbank, y
      // hasta que eso ocurre `provisioned` sigue en `false`.
      const result = await check();

      if (result?.provisioned) {
        logStep("alta provisionada: fin del sondeo", { alta: pendingId });
        return;
      }

      setPolls((current) => current + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [check, pendingId, polls, status?.provisioned]);

  const waiting = !status?.provisioned && polls < MAX_POLLS;

  if (!status?.provisioned && polls >= MAX_POLLS && !networkError) {
    logWarn("sondeo agotado sin confirmar el pago", {
      alta: pendingId,
      sondeos: polls,
    });
  }

  return (
    /*
     * `shrink-0 self-start`: la tarjeta mide lo que mide su contenido.
     *
     * Este contenedor llevaba `min-h-screen` y un `justify-center` propios,
     * dentro de un layout que YA tiene alto de viewport y centra: la tarjeta
     * reclamaba una pantalla completa y estiraba el layout en vez de ajustarse
     * al mensaje que muestra (que cabe en tres lineas).
     */
    <div className="relative w-full max-w-md shrink-0 self-start overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl backdrop-blur">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"
      />

      <div className="p-8">
        <div className="mb-6 text-center">
          {/* El icono cambia con el estado: reloj mientras espera, check al
              confirmarse. `aria-hidden` porque el texto del titulo ya lo dice. */}
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
            <span
              aria-hidden
              className={
                status?.provisioned
                  ? "text-base text-emerald-400"
                  : "text-base text-blue-400"
              }
            >
              {status?.provisioned ? "\u2713" : "\u25C7"}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {status?.provisioned
              ? "Tu cuenta esta lista"
              : "Activando tu cuenta"}
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            {status?.provisioned
              ? "El pago se confirmo. Ya puedes entrar con el email y la contrasena que elegiste."
              : "Estamos esperando la confirmacion del pago. Esto suele tardar unos segundos."}
          </p>
        </div>

        {!pendingId ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            No sabemos a que registro volver. Inicia sesion con el email que usaste
            y, si la cuenta ya existe, entras directo.
          </p>
        ) : status?.provisioned ? (
          <Link
            href={`/login?email=${encodeURIComponent(status.email)}`}
            className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 active:bg-blue-700"
          >
            Entrar al panel
          </Link>
        ) : waiting ? (
          <>
            {/* Barra indeterminada: el tiempo real lo marca la pasarela, no
                nosotros, asi que un porcentaje seria una mentira. */}
            <div
              role="progressbar"
              aria-label="Esperando la confirmacion del pago"
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800"
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
            </div>
            <p className="mt-3 text-center text-xs text-gray-500">
              Manten esta pagina abierta.
            </p>
            {networkError ? (
              <p className="mt-3 text-center text-[11px] text-gray-500">
                Sin conexion con el servidor. Reintentando…
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-300">
              El pago puede tardar un poco mas en confirmarse. Si autorizaste el
              cobro, tu cuenta se activa sola: en unos minutos podras entrar con
              tu email y contrasena.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPolls(0);
                  void check();
                }}
                className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-800"
              >
                Comprobar otra vez
              </button>
              <Link
                href={`/login?email=${encodeURIComponent(status?.email ?? "")}`}
                className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-center text-sm font-semibold text-gray-300 transition hover:bg-gray-800"
              >
                Ir a entrar
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
