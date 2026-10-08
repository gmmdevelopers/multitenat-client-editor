"use client";

import { Suspense, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Lock,
  Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  disconnectPayments,
  getPaymentsConnectUrl,
  getPaymentsStatus,
  type PaymentsConnectionStatus,
} from "@/lib/api/payments";
import {
  getCurrentSite,
  updateSite,
  type DepositPolicy,
} from "@/lib/api/sites";
import type { Site } from "@/types/site";

/**
 * Cuanto se le pide al paciente al agendar.
 *
 * Las opciones se declaran como lista y no como botones sueltos para que el
 * texto y el valor no se puedan desincronizar: añadir una politica es una
 * linea.
 */
const OPTIONS: Array<{
  value: DepositPolicy;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "Sin pago al agendar",
    description: "El paciente reserva y paga en el local.",
  },
  {
    value: "25",
    label: "Abono del 25%",
    description: "Paga una parte ahora y el resto al llegar.",
  },
  {
    value: "50",
    label: "Abono del 50%",
    description: "Mitad ahora, mitad en el local.",
  },
  {
    value: "75",
    label: "Abono del 75%",
    description: "La mayor parte ahora, el resto al llegar.",
  },
  {
    value: "100",
    label: "Pago completo obligatorio",
    description:
      "Debe pagar el total para confirmar. Sin pagar, la hora no queda reservada.",
  },
];

/**
 * Politica de cobro de la agenda.
 *
 * Requiere Mercado Pago conectado para CUALQUIER opcion que pida dinero: sin
 * cuenta no hay a donde pagar, y el paciente llegaria a un paso sin salida. El
 * backend tambien lo valida, porque `settings` se puede escribir por API.
 */
export default function DepositPolicyPage() {
  // `useSearchParams` exige un limite de Suspense para poder prerenderizar:
  // sin el, el build de Next falla al intentar renderizar esta pagina de forma
  // estatica. Mismo patron que la web publica.
  return (
    <Suspense fallback={<DepositLoading />}>
      <DepositPolicyContent />
    </Suspense>
  );
}

function DepositLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="animate-pulse text-sm text-stone-400">
        Cargando configuración...
      </span>
    </div>
  );
}

function DepositPolicyContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [policy, setPolicy] = useState<DepositPolicy | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<DepositPolicy | null>(null);
  const [connection, setConnection] =
    useState<PaymentsConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    void Promise.all([getCurrentSite(), getPaymentsStatus()])
      .then(([result, status]) => {
        setSite(result);
        setConnection(status);
        // Sin configurar se muestra `none`: es el comportamiento real (la
        // agenda no pide nada), y mostrar un estado vacio confundiria.
        const stored = result?.settings?.payments?.depositPolicy ?? "none";
        setPolicy(stored);
        setSavedPolicy(stored);
      })
      .catch((err) =>
        setError(getErrorMessage(err, "No se pudo cargar la configuración.")),
      );
  }, []);

  /**
   * Mensaje al VOLVER del callback de Mercado Pago.
   *
   * El backend redirige aqui con `?payments=connected|cancelled|error`, y se
   * consume una sola vez: se quita de la URL con `replace` para que un refresco
   * de la pagina no repita el aviso.
   */
  useEffect(() => {
    const outcome = searchParams.get("payments");
    if (!outcome) return;

    const reason = searchParams.get("reason");

    if (outcome === "connected") {
      toast.success("Mercado Pago conectado");
      // Se recarga el estado: el cambio lo hizo el backend, no esta pantalla.
      void getPaymentsStatus().then(setConnection);
    } else if (outcome === "cancelled") {
      // Rechazar la autorizacion es legitimo, no un fallo: se informa sin alarma.
      toast.info("No autorizaste la conexión");
    } else if (outcome === "error") {
      toast.error(reason || "No pudimos conectar tu cuenta de Mercado Pago.");
    }

    router.replace(
      `/site/${tenant?.slug ?? ""}/admin/deposit`,
      { scroll: false },
    );
  }, [searchParams, router, tenant?.slug, toast]);

  const isConnected = connection?.connected ?? false;
  const hasChanges = policy !== null && policy !== savedPolicy;

  /** Pide la URL a la API y navega a Mercado Pago. */
  async function handleConnect() {
    setIsConnecting(true);
    try {
      const url = await getPaymentsConnectUrl();
      // Navegacion del navegador, no una peticion: es una pagina externa.
      window.location.href = url;
    } catch (err) {
      toast.error(getErrorMessage(err, "No pudimos iniciar la conexión."));
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await disconnectPayments();

      /**
       * Se recarga TODO, no solo la conexion.
       *
       * Al desconectar, el backend RESETEA la politica de cobro a `none` (sin
       * cuenta no se puede cumplir). Si solo se refrescara `connection`, la
       * pantalla seguiria mostrando el 100% seleccionado y el cliente creeria
       * que sigue cobrando.
       */
      const [status, updatedSite] = await Promise.all([
        getPaymentsStatus(),
        getCurrentSite(),
      ]);

      setConnection(status);
      setSite(updatedSite);

      const stored =
        updatedSite?.settings?.payments?.depositPolicy ?? "none";
      setPolicy(stored);
      setSavedPolicy(stored);

      toast.success("Mercado Pago desconectado. El cobro al agendar quedó desactivado.");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo desconectar la cuenta."));
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleSave() {
    if (!site || !policy) return;

    setIsSaving(true);
    try {
      const updated = await updateSite(site.id, { depositPolicy: policy });
      setSite(updated.site ?? updated);
      setSavedPolicy(policy);
      toast.success("Cobro actualizado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el cobro."));
    } finally {
      setIsSaving(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-red-500/40 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (site === null || policy === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-stone-400">
          Cargando configuración...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Wallet className="h-5 w-5 text-amber-300" />
          Cobro al agendar
        </h1>
        <p className="mt-1 max-w-xl text-sm text-stone-400">
          Cuánto paga el paciente cuando reserva desde tu web. Sin configurar,
          la agenda no pide ningún pago.
        </p>
      </header>

      {/* --- Conexion de Mercado Pago --- */}
      <section
        data-payments-connection={isConnected ? "connected" : "disconnected"}
        className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/50 p-6"
      >
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <CreditCard className="h-4 w-4 text-amber-300" />
          Cuenta de Mercado Pago
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          El dinero de las citas llega directo a tu cuenta. Usamos el acceso
          oficial de Mercado Pago: autorizas desde tu cuenta y nunca vemos tu
          contraseña.
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-stone-800 bg-stone-950/60 p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isConnected
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-stone-800 text-stone-400"
              }`}
            >
              {isConnected ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </span>

            <div>
              <p className="text-xs font-semibold text-white">
                {isConnected ? "Mercado Pago conectado" : "Mercado Pago no conectado"}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {isConnected
                  ? "Tus pacientes pagan a tu cuenta."
                  : "Sin conectar, solo puedes agendar sin pago previo."}
              </p>
            </div>
          </div>

          {isConnected ? (
            <button
              type="button"
              data-disconnect-payments="true"
              onClick={() => void handleDisconnect()}
              disabled={isDisconnecting}
              className="rounded-lg border border-stone-700 px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-50"
            >
              {isDisconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          ) : (
            <button
              type="button"
              data-connect-payments="true"
              onClick={() => void handleConnect()}
              disabled={isConnecting}
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isConnecting ? "Abriendo..." : "Conectar cuenta"}
            </button>
          )}
        </div>

        {/*
          Aviso para CAMBIAR DE CUENTA.

          Mercado Pago reconoce al cliente por su cookie de sesion en
          `mercadopago.cl`, asi que si vuelve a conectar sin cerrar sesion ahi,
          MP autoriza DIRECTO la misma cuenta: el cliente quiere cambiar de
          cuenta y no entiende por que no puede.

          No se puede forzar el cierre de sesion en un dominio ajeno, asi que
          la unica solucion es decirlo. Solo aparece cuando YA hubo una
          conexion: si nunca conecto, hablarle de cambiar de cuenta confunde.
        */}
        {connection?.connectedAt ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-stone-800 bg-stone-950/60 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
            <p className="text-[11px] leading-relaxed text-stone-400">
              <strong className="font-semibold text-stone-300">
                ¿Quieres cambiar de cuenta?
              </strong>{" "}
              Cierra sesión en Mercado Pago antes de volver a conectar. Si no,
              se conectará otra vez la misma cuenta, porque Mercado Pago
              recuerda con cuál iniciaste sesión.
            </p>
          </div>
        ) : null}

        {/* Aviso de cuenta de PRUEBA: sin esto, el cliente creeria que cobra de
            verdad y se enteraria cuando un paciente le pagara sin que llegara
            el dinero. */}
        {isConnected && connection?.isTest ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-[11px] leading-relaxed text-amber-200">
              <strong className="font-bold">Cuenta de pruebas.</strong> Los pagos
              que recibas aquí son de prueba y no llega dinero real. Conecta tu
              cuenta de producción antes de publicar.
            </p>
          </div>
        ) : null}

        {/* Token vencido: se avisa porque el cobro dejaria de funcionar y el
            sintoma (un error suelto al cobrar) no lo relacionaria con esto. */}
        {isConnected && connection?.expired ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-[11px] leading-relaxed text-red-300">
              La conexión expiró. Vuelve a conectar tu cuenta para seguir
              cobrando: intentamos renovarla sola, pero si falla, los pagos
              dejan de funcionar.
            </p>
          </div>
        ) : null}
      </section>

      {/* Sin cuenta conectada no se puede pedir dinero: se avisa y se
          deshabilitan las opciones que cobran. */}
      {!isConnected ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-xs font-semibold text-amber-200">
                Conecta Mercado Pago para cobrar
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/80">
                Para pedirle un pago al paciente necesitas tu cuenta conectada.
                Sin ella, solo puedes agendar sin pago.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-stone-800">
        {OPTIONS.map((option, index) => {
          const isActive = policy === option.value;
          // Solo se bloquea lo que PIDE dinero: "sin pago" siempre es valido.
          const isBlocked = !isConnected && option.value !== "none";

          return (
            <button
              key={option.value}
              type="button"
              data-deposit-option={option.value}
              disabled={isBlocked || isSaving}
              onClick={() => setPolicy(option.value)}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                index > 0 ? "border-t border-stone-800" : ""
              } ${
                isActive ? "bg-amber-400/10" : "hover:bg-stone-900/60"
              } ${isBlocked ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isActive
                    ? "border-amber-400 bg-amber-400"
                    : "border-stone-600"
                }`}
              >
                {isActive ? (
                  <Check className="h-2.5 w-2.5 text-black" />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    isActive ? "text-amber-200" : "text-white"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-400">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {hasChanges ? (
          <span className="text-[11px] font-semibold text-amber-300">
            Sin guardar
          </span>
        ) : (
          <span className="text-[11px] text-stone-500">Todo guardado</span>
        )}

        <button
          type="button"
          data-save-deposit="true"
          onClick={() => void handleSave()}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CreditCard className="h-3.5 w-3.5" />
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {policy === "100" ? (
        <p className="mt-6 rounded-xl border border-stone-800 bg-stone-950/40 p-4 text-[11px] leading-relaxed text-stone-400">
          Con el pago completo obligatorio, una hora solo queda reservada
          cuando el pago se completa. Si el paciente abandona el pago, la hora
          vuelve a quedar libre.
        </p>
      ) : null}
    </div>
  );
}