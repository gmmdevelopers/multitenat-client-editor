"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  activateStaffPush,
  deactivateStaffPush,
  loadStaffPushState,
  type StaffPushState,
} from "@/lib/staff-push";

/**
 * Activar o desactivar las notificaciones del panel en ESTE navegador.
 *
 * ## Por que "en este navegador" y no un solo interruptor
 *
 * La suscripcion es del navegador, no del usuario: quien usa el panel en el
 * computador y en el telefono necesita activarlo en los dos. Un interruptor de
 * cuenta mentiria en uno de los dos.
 *
 * ## Cuatro estados, no dos
 *
 * | Estado | Que se muestra |
 * |---|---|
 * | Sin soporte | El motivo, y no hay boton |
 * | Permiso denegado | Como volver a activarlo |
 * | Activo | Boton de desactivar |
 * | Inactivo | Boton de activar |
 *
 * El de "permiso denegado" es el que importa: el navegador **no vuelve a
 * preguntar** una vez denegado, y sin explicar como se revierte el cliente
 * pulsa "Activar" y no pasa nada nunca mas.
 */
export function StaffPushSettings() {
  const toast = useToast();

  const [state, setState] = useState<StaffPushState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await loadStaffPushState());
    } catch (error) {
      // Sin configuracion el bloque no puede ofrecer nada: se deja en `null` y
      // se muestra el aviso de abajo, en vez de romper Ajustes entera.
      setState(null);
      toast.error(
        getErrorMessage(error, "No pudimos leer las notificaciones."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
    // Solo al montar: el estado cambia por acciones del usuario, que ya llaman a
    // `refresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleActivate() {
    if (!state?.config.publicKey) return;

    setIsWorking(true);
    try {
      const result = await activateStaffPush(state.config.publicKey);

      if (result.status === "active") {
        toast.success("Notificaciones activadas en este navegador");
      } else if (result.status === "denied") {
        toast.error(
          "El navegador bloqueó las notificaciones. Actívalas desde el candado de la barra de direcciones.",
        );
      } else {
        toast.error(result.reason);
      }

      // Se relee siempre: si el permiso quedo denegado, la UI tiene que saberlo
      // para dejar de ofrecer el boton.
      await refresh();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "No pudimos activar las notificaciones."),
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeactivate() {
    setIsWorking(true);
    try {
      await deactivateStaffPush();
      toast.info("Notificaciones desactivadas en este navegador");
      await refresh();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "No pudimos desactivar las notificaciones."),
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Revisando este navegador...
      </div>
    );
  }

  // El servidor no tiene claves VAPID: la funcion no existe en este entorno.
  if (!state) {
    return (
      <Notice tone="muted" title="No disponibles">
        Las notificaciones no están configuradas en este servidor. Puedes seguir
        usando el panel con normalidad.
      </Notice>
    );
  }

  /**
   * Sin soporte o permiso denegado: **no se ofrece el boton**.
   *
   * Un boton que se pulsa y no hace nada es peor que no tenerlo: el cliente
   * pierde la confianza en toda la pantalla de ajustes.
   */
  if (state.unsupported || state.permission === "denied") {
    return (
      <Notice tone="warning" title="No se pueden activar aquí">
        {state.unsupported ??
          "Este navegador tiene las notificaciones bloqueadas para este sitio. Ábrelo desde el candado de la barra de direcciones y permítelas, o usa otro navegador."}
      </Notice>
    );
  }

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              state.isSubscribed
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-stone-800 text-stone-400"
            }`}
          >
            {state.isSubscribed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </span>

          <div>
            <p
              data-staff-push-state={state.isSubscribed ? "active" : "inactive"}
              className="text-xs font-semibold text-white"
            >
              {state.isSubscribed
                ? "Activas en este navegador"
                : "Desactivadas en este navegador"}
            </p>
            <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-stone-400">
              {state.isSubscribed
                ? "Te avisamos de citas nuevas y cancelaciones aunque el panel esté cerrado."
                : "Actívalas para enterarte de cada cita sin tener el panel abierto."}
            </p>
            {state.isSubscribed && state.config.subscriptions > 1 ? (
              <p className="mt-1 text-[10px] text-stone-500">
                También en otros {state.config.subscriptions - 1}{" "}
                {state.config.subscriptions - 1 === 1
                  ? "navegador"
                  : "navegadores"}
                .
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          data-staff-push-toggle={state.isSubscribed ? "off" : "on"}
          onClick={() =>
            void (state.isSubscribed ? handleDeactivate() : handleActivate())
          }
          disabled={isWorking}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
            state.isSubscribed
              ? "border border-stone-700 text-stone-200 hover:bg-stone-800"
              : "bg-amber-400 text-black hover:bg-amber-300"
          }`}
        >
          {isWorking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          {state.isSubscribed ? "Desactivar" : "Activar notificaciones"}
        </button>
      </div>
    </div>
  );
}

/** El aviso de cuando no se puede ofrecer el boton. */
function Notice({
  tone,
  title,
  children,
}: {
  tone: "muted" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-stone-800 bg-stone-950/60 text-stone-300";

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${styles}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">
          {children}
        </p>
      </div>
    </div>
  );
}
