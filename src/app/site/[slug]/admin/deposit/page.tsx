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
import { canEditSection } from "@/lib/role-routing";
import { ReadOnlyNotice } from "@/components/ReadOnlySection";
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
      <span className="animate-pulse text-sm text-muted">
        Cargando configuración...
      </span>
    </div>
  );
}

function DepositPolicyContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant, user } = useAuth();

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

  /**
   * El cobro al agendar lo configura el negocio, no recepcion.
   *
   * Es dinero: cuanto paga el paciente al reservar. Recepcion ve la pantalla
   * para poder responder consultas, pero no la cambia.
   */
  const canEdit = user ? canEditSection(user.role, "deposit") : false;

  /**
   * La politica que se muestra, SIEMPRE coherente con la conexion.
   *
   * ## Por que no se usa `policy` directo
   *
   * `policy` sale de `settings.payments.depositPolicy` del site, y ese dato
   * puede quedar **inconsistente**: se vio en produccion un site con
   * `connected: false` y `depositPolicy: "100"` a la vez (una desconexion que no
   * llego a resetear la politica).
   *
   * Con el dato crudo, la pantalla mostraba **"Pago completo obligatorio"
   * seleccionado** junto a "Mercado Pago no conectado": dos cosas que no pueden
   * ser ciertas al mismo tiempo. El cobro real no ocurria (el backend exige la
   * cuenta), pero la UI **mentia** sobre el estado, que es lo que confunde.
   *
   * Sin cuenta conectada no se puede cobrar nada, asi que la unica politica
   * valida es `none`. Se DERIVA en vez de mostrar el valor guardado.
   *
   * ## Por que derivarlo y no limpiarlo en el estado
   *
   * `policy` es lo que se EDITA y se guarda. Si se pisara a `none` al cargar, el
   * cliente perderia su configuracion en cuanto reconectara, y ademas el boton
   * "Guardar" no tendria con que comparar. Derivando, el valor guardado se
   * conserva intacto y solo cambia **lo que se ve**.
   */
  const effectivePolicy = isConnected ? policy : "none";

  const hasChanges =
    effectivePolicy !== null && effectivePolicy !== savedPolicy;

  /**
   * Solo el `owner` conecta o desconecta la cuenta de cobro.
   *
   * Conectar decide **a donde va el dinero** de los pacientes: es configuracion
   * del negocio, no operacion. El `admin` **ve el estado** (esta pantalla carga
   * el status sin problema), pero los botones de accion no se le ofrecen —
   * mostrarselos solo para que reciba un 403 al pulsarlos seria peor.
   *
   * La regla se aplica TAMBIEN en el backend (`@Roles("owner")` en `connect` y
   * `disconnect`): esto es solo la mitad visible. Esconder el boton sin cortar
   * el endpoint no protegeria nada.
   */
  const canManageConnection = user?.role === "owner";

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
    if (!site || !effectivePolicy) return;

    setIsSaving(true);
    try {
      // Se guarda la EFECTIVA, no la cruda: sin cuenta, cualquier politica que
      // no sea `none` no se puede cumplir. Mandar la cruda reintroduciria el
      // estado imposible que la pantalla acaba de evitar mostrar.
      const updated = await updateSite(site.id, {
        depositPolicy: effectivePolicy,
      });
      setSite(updated.site ?? updated);
      setSavedPolicy(effectivePolicy);
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
        <div className="max-w-md rounded-xl border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (site === null || policy === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-muted">
          Cargando configuración...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Wallet className="h-5 w-5 text-accent-strong" />
          Cobro al agendar
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Cuánto paga el paciente cuando reserva desde tu web. Sin configurar,
          la agenda no pide ningún pago.
        </p>
      </header>

      {/* --- Chat con pacientes --- */}
      {/*
        El interruptor del chat YA NO VIVE AQUI.

        Se movio a la seccion **Chats**: alli es donde el cliente lo busca, y
        tenerlo dentro de "Cobro al agendar" obligaba a adivinar que el chat se
        habilita en la pantalla de pagos.

        Ademas, en su sitio nuevo puede explicar los DOS estados vacios que
        aqui no se distinguian: "el chat esta desactivado" y "no hay mensajes".
      */}

      {/* --- Conexion de Mercado Pago --- */}
      <section
        data-payments-connection={isConnected ? "connected" : "disconnected"}
        className="mb-6 rounded-2xl border border-line bg-surface/50 p-6"
      >
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <CreditCard className="h-4 w-4 text-accent-strong" />
          Cuenta de Mercado Pago
        </h2>
        <p className="mb-5 text-xs text-muted">
          El dinero de las citas llega directo a tu cuenta. Usamos el acceso
          oficial de Mercado Pago: autorizas desde tu cuenta y nunca vemos tu
          contraseña.
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isConnected
                  ? "bg-success/15 text-success"
                  : "bg-surface-raised text-muted"
              }`}
            >
              {isConnected ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </span>

            <div>
              <p className="text-xs font-semibold text-foreground">
                {isConnected ? "Mercado Pago conectado" : "Mercado Pago no conectado"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {isConnected
                  ? "Tus pacientes pagan a tu cuenta."
                  : "Sin conectar, solo puedes agendar sin pago previo."}
              </p>
            </div>
          </div>

          {canManageConnection ? (
            isConnected ? (
              <button
                type="button"
                data-disconnect-payments="true"
                onClick={() => void handleDisconnect()}
                disabled={isDisconnecting}
                className="rounded-lg border border-line-strong px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-raised disabled:opacity-50"
              >
                {isDisconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            ) : (
              <button
                type="button"
                data-connect-payments="true"
                onClick={() => void handleConnect()}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:opacity-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isConnecting ? "Abriendo..." : "Conectar cuenta"}
              </button>
            )
          ) : (
            /*
             * Aviso en vez de boton.
             *
             * No basta con esconderlo: el `admin` veria la pantalla sin ninguna
             * explicacion y creeria que le falta un permiso que en realidad es
             * una decision del negocio. Se le dice quien puede hacerlo.
             */
            <p className="max-w-[220px] text-right text-[11px] text-muted">
              Solo el propietario puede conectar o desconectar la cuenta.
            </p>
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
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-background/60 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <p className="text-[11px] leading-relaxed text-muted">
              <strong className="font-semibold text-foreground">
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
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
            <p className="text-[11px] leading-relaxed text-accent-strong">
              <strong className="font-bold">Cuenta de pruebas.</strong> Los pagos
              que recibas aquí son de prueba y no llega dinero real. Conecta tu
              cuenta de producción antes de publicar.
            </p>
          </div>
        ) : null}

        {/* Token vencido: se avisa porque el cobro dejaria de funcionar y el
            sintoma (un error suelto al cobrar) no lo relacionaria con esto. */}
        {isConnected && connection?.expired ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-[11px] leading-relaxed text-danger">
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
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
            <div>
              <p className="text-xs font-semibold text-accent-strong">
                Conecta Mercado Pago para cobrar
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-accent-strong/80">
                Para pedirle un pago al paciente necesitas tu cuenta conectada.
                Sin ella, solo puedes agendar sin pago.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Aviso de solo lectura: ve la configuracion de cobro, no la cambia. */}
      {canEdit ? null : (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line">
        {OPTIONS.map((option, index) => {
          const isActive = effectivePolicy === option.value;
          // Solo se bloquea lo que PIDE dinero: "sin pago" siempre es valido.
          const isBlocked = !isConnected && option.value !== "none";

          return (
            <button
              key={option.value}
              type="button"
              data-deposit-option={option.value}
              disabled={isBlocked || isSaving || !canEdit}
              onClick={() => setPolicy(option.value)}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                index > 0 ? "border-t border-line" : ""
              } ${
                isActive ? "bg-accent/10" : "hover:bg-surface/60"
              } ${isBlocked ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isActive
                    ? "border-accent bg-accent"
                    : "border-line-strong"
                }`}
              >
                {isActive ? (
                  <Check className="h-2.5 w-2.5 text-on-accent" />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold ${
                    isActive ? "text-accent-strong" : "text-foreground"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {canEdit ? (
        <div className="mt-5 flex items-center justify-end gap-3">
          {hasChanges ? (
            <span className="text-[11px] font-semibold text-accent-strong">
              Sin guardar
            </span>
          ) : (
            <span className="text-[11px] text-text-subtle">Todo guardado</span>
          )}

          <button
            type="button"
            data-save-deposit="true"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      ) : null}

      {policy === "100" ? (
        <p className="mt-6 rounded-xl border border-line bg-background/40 p-4 text-[11px] leading-relaxed text-muted">
          Con el pago completo obligatorio, una hora solo queda reservada
          cuando el pago se completa. Si el paciente abandona el pago, la hora
          vuelve a quedar libre.
        </p>
      ) : null}
    </div>
  );
}