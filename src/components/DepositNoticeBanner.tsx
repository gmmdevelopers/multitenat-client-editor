"use client";

import { useEffect, useState } from "react";
import { CreditCard, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getErrorMessage } from "@/lib/api/errors";
import { getCurrentSite, updateSite } from "@/lib/api/sites";
import type { Site } from "@/types/site";

/**
 * Aviso de "configura el cobro de tu agenda".
 *
 * Mismo diseño que `EmailVerificationBanner` (banda ambar con icono, texto y
 * boton de cerrar), por coherencia: los dos son avisos del panel y no deberian
 * parecer de productos distintos.
 *
 * DOS DIFERENCIAS deliberadas con el de email:
 *
 *   1. **Este no vuelve al recargar.** El descarte se guarda en el servidor
 *      (`settings.payments.depositNoticeDismissedAt`), asi que una vez cerrado
 *      no reaparece ni en otro dispositivo. El de email si vuelve, porque es
 *      una obligacion pendiente; este es una sugerencia.
 *
 *   2. **Solo aparece en el admin de agenda.** Vive en esa pantalla, no en el
 *      layout global, porque solo ahi es relevante.
 */
export function DepositNoticeBanner() {
  const routeParams = useParams<{ slug: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    void getCurrentSite()
      .then(setSite)
      .catch(() => {
        // Silencioso: es un aviso, no un dato de la pantalla. Si falla, no se
        // muestra y el cliente puede configurar el cobro igual.
        setSite(null);
      });
  }, []);

  const payments = site?.settings?.payments;

  /**
   * Condiciones para MOSTRARLO:
   *   - Hay sitio cargado (si no, aun no sabemos nada).
   *   - No esta descartado.
   *   - No hay politica configurada.
   *
   * No se exige Mercado Pago conectado: precisamente el aviso sirve para
   * empujar a configurar el cobro, y conectar la cuenta es parte de eso. Si se
   * exigiera, el aviso no saldria nunca en el caso mas comun (nadie conectado).
   */
  const shouldShow =
    site !== null &&
    !payments?.depositNoticeDismissedAt &&
    payments?.depositPolicy === undefined;

  if (!shouldShow) return null;

  async function handleDismiss() {
    if (!site) return;

    setIsDismissing(true);

    // Se oculta al instante y se guarda en segundo plano: esperar la respuesta
    // para cerrar un aviso se siente como si el boton no funcionara.
    setSite((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              payments: {
                ...(current.settings?.payments ?? { enabled: false }),
                depositNoticeDismissedAt: new Date().toISOString(),
              },
            },
          }
        : current,
    );

    try {
      await updateSite(site.id, {
        settings: {
          payments: { depositNoticeDismissedAt: new Date().toISOString() },
        },
      });
    } catch (err) {
      // Si no se pudo guardar, el aviso VOLVERA al recargar. Se avisa, porque
      // el cliente creeria haberlo cerrado para siempre.
      console.error(
        "No se pudo guardar el descarte del aviso:",
        getErrorMessage(err, "error desconocido"),
      );
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <div
      data-deposit-notice="true"
      className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-3"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-200">
            Configura cuánto cobras al agendar
          </p>

          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">
            Puedes pedir el pago completo, un abono (25%, 50% o 75%) o dejar que
            el paciente pague en el local. Ahora mismo tu agenda no pide ningún
            pago.
          </p>

          <Link
            href={`/site/${routeParams?.slug ?? ""}/admin/deposit`}
            className="mt-2 inline-block rounded-md border border-amber-800 bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-900/60"
          >
            Configurar el cobro
          </Link>
        </div>

        <button
          type="button"
          data-dismiss-deposit-notice="true"
          onClick={() => void handleDismiss()}
          disabled={isDismissing}
          aria-label="Cerrar aviso"
          className="rounded p-1 text-amber-500/70 transition hover:bg-amber-900/40 hover:text-amber-300 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
