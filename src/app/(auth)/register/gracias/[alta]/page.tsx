"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { getErrorMessage } from "@/lib/api/errors";
import {
  getPendingRegistration,
  syncPendingRegistration,
  type PendingRegistrationStatus,
} from "@/lib/api/registration";

/**
 * Pantalla a la que Mercado Pago devuelve al cliente tras pagar.
 *
 * ## Por que no se entra directo al panel
 *
 * La cuenta NO existe cuando el cliente vuelve: la crea el webhook de Mercado
 * Pago cuando confirma el cobro, y ese aviso puede tardar unos segundos. Sin
 * esta pantalla, el cliente aterrizaria en `/login` con un formulario que
 * todavia no sirve, sin saber si su pago funciono.
 *
 * Aqui se consulta el estado del alta hasta que `provisioned` es `true`. Aun asi
 * NO se inicia sesion automaticamente: no hay token (el registro no devuelve
 * sesion), asi que se manda al login con el email ya escrito.
 */
const POLL_INTERVAL_MS = 3000;

/**
 * Cuanto se espera antes de rendirse y ofrecer la comprobacion contra MP.
 *
 * 10 sondeos = ~30 s. Antes eran 20 (~60 s) mirando un `false` que en local
 * NUNCA cambia solo: el webhook de Mercado Pago no llega a un host privado, asi
 * que esperar mas tiempo solo alarga la sensacion de "no pasa nada".
 */
const MAX_POLLS = 10;

/**
 * Saca el id del alta de lo que llegue en `alta`, aunque venga contaminado.
 *
 * ## El bug que corrige
 *
 * Mercado Pago NO devuelve al `back_url` tal cual: le concatena sus propios
 * parametros. Y si nuestra URL ya trae query (`?alta=...`), el resultado es
 * ambiguo y MP acaba **codificando el `?`** como `%3F`, con lo que el
 * `preapproval_id` termina DENTRO de nuestro parametro:
 *
 *   /register/gracias?alta=abc%3Fpreapproval_id%3Df82e04c9...
 *
 * Decodificado eso es `abc?preapproval_id=f82e04c9...`, que como id no existe y
 * el backend responde 404 "El registro no existe".
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
  // - `/register/gracias/:alta` (path): la buena. Mercado Pago añade SUS
  //   parametros al volver (`?preapproval_id=...`), y con el id en el path no
  //   hay `?` que mezclar. Antes iba como `?alta=`, MP codificaba el segundo `?`
  //   y el id llegaba contaminado (`abc%3Fpreapproval_id%3D...`).
  // - `?alta=` (query): se sigue aceptando para los checkouts creados antes del
  //   arreglo, que aun pueden volver asi.
  const params = useParams<{ alta?: string }>();
  const pendingId = normalizePendingId(
    Array.isArray(params?.alta) ? params.alta[0] : params?.alta ?? searchParams.get("alta"),
  );

  const [status, setStatus] = useState<PendingRegistrationStatus | null>(null);
  const [polls, setPolls] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  /**
   * Resultado de pedir la sincronizacion con Mercado Pago.
   *
   * Es la via de escape cuando el webhook no llega (siempre en local, y a veces
   * en produccion si MP falla al notificar): se pregunta a MP por el estado real
   * del cobro y, si esta autorizado, la cuenta se crea en ese momento.
   */
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!pendingId) return;

    try {
      const result = await getPendingRegistration(pendingId);
      setStatus(result);
      setNetworkError(false);
      return result;
    } catch {
      // Un fallo de red no significa que el pago fallara: se reintenta, porque
      // el siguiente sondeo suele resolverse. Solo se avisa al cliente al final.
      setNetworkError(true);
      return null;
    }
  }, [pendingId]);

  useEffect(() => {
    void check();
  }, [check]);

  /**
   * Le pide al backend que compruebe contra Mercado Pago.
   *
   * Es la salida cuando el webhook no llega. En local SIEMPRE hace falta (MP no
   * puede notificar a un host privado), asi que sin esto la pantalla se quedaba
   * en "activando" para siempre aunque el pago estuviera hecho.
   *
   * `silent` sirve para llamarla durante el sondeo: no toca los mensajes de la
   * UI (el sondeo ya se comunica por el estado de espera) y solo devuelve si el
   * alta quedo provisionada.
   */
  const handleSync = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!pendingId) return false;

      if (!silent) {
        setSyncing(true);
        setSyncMessage(null);
      }

      try {
        const result = await syncPendingRegistration(pendingId);
        setStatus(result);

        if (!silent) {
          setSyncMessage(
            result.provisioned
              ? "Pago confirmado. Tu cuenta ya esta creada."
              : "Mercado Pago todavia no ha confirmado el pago. Termina el checkout y vuelve a intentar.",
          );
        }

        return result.provisioned;
      } catch (error) {
        if (!silent) {
          setSyncMessage(
            getErrorMessage(
              error,
              "No pudimos comprobar el pago. Intenta de nuevo.",
            ),
          );
        }

        return false;
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [pendingId],
  );

  useEffect(() => {
    if (!pendingId || status?.provisioned || polls >= MAX_POLLS) return;

    const timer = setTimeout(async () => {
      // Se alterna entre el sondeo barato (nuestra base) y la comprobacion
      // contra Mercado Pago.
      //
      // ## Por que hace falta preguntarle a MP
      //
      // Nuestro estado SOLO cambia si el webhook llega o si alguien pide el
      // sync. En local el webhook no llega NUNCA (MP no alcanza un host
      // privado), asi que sondear la base daba `provisioned: false` para
      // siempre y la pantalla nunca avanzaba: el cliente pagaba, no veia nada y
      // tenia que pulsar un boton que no sabia que existia.
      //
      // Consultar a MP en cada vuelta no es caro (es un GET a su API) y elimina
      // esa espera muerta: la cuenta aparece sola en cuanto el pago se confirma.
      //
      // `polls` cuenta lo ya hecho: en la PRIMERA vuelta vale 0 (ya se hizo un
      // `check` al montar), asi que la comprobacion contra MP empieza en la
      // segunda. Con `polls % 2 === 1` el primer POST caia recien en la quinta
      // vuelta (~15 s de espera sin preguntarle a MP nada).
      const useProvider = polls % 2 === 0;
      const result = useProvider
        ? await handleSync(true).then((done) => ({ provisioned: done }))
        : await check();

      if (result?.provisioned) return;

      setPolls((current) => current + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [check, handleSync, pendingId, polls, status?.provisioned]);

  const waiting = !status?.provisioned && polls < MAX_POLLS;

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
              : "Estamos esperando la confirmacion de Mercado Pago. Esto suele tardar unos segundos."}
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
            {/* Barra indeterminada: el tiempo real lo marca MP, no nosotros, asi
                que un porcentaje seria una mentira. */}
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

            {/* Comprobacion contra Mercado Pago: la salida cuando la notificacion
                de MP no llega (siempre en local). */}
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing ? "Comprobando con Mercado Pago..." : "Ya pague: comprobar"}
            </button>

            {syncMessage ? (
              <p className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs text-gray-300">
                {syncMessage}
              </p>
            ) : null}

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
