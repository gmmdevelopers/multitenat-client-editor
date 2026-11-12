"use client";

import { useEffect, useState } from "react";
import { BadgePercent, CalendarClock, Sparkles, X } from "lucide-react";

import { getCouponNotice, type CouponNotice } from "@/lib/api/billing";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Aviso del cupón activo, en la parte superior del panel.
 *
 * ## Por qué existe
 *
 * El cliente usó un cupón al registrarse y desde entonces no vuelve a saber
 * nada de él: no sabe cuánto le queda de descuento ni cuánto pagará cuando
 * termine. En un cobro recurrente, esa incertidumbre es lo que hace desconfiar,
 * y el panel es justo donde el cliente iría a buscarla.
 *
 * ## Qué avisa y qué no
 *
 * El backend devuelve `null` cuando no hay nada que avisar, y se respeta tal
 * cual: un descuento permanente no necesita un banner fijo (sería ruido y
 * taparía el aviso de correo sin verificar). Solo se muestra cuando hay una
 * fecha o un monto que va a cambiar.
 *
 * ## Se puede cerrar, pero vuelve
 *
 * Igual que el aviso de correo: se oculta hasta recargar. Descartarlo para
 * siempre haría que el cliente se entere del cambio de precio en la boleta del
 * banco en vez de en el panel.
 */
export function CouponNoticeBanner() {
  const [notice, setNotice] = useState<CouponNotice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getCouponNotice()
      .then((data) => {
        // `null` es una respuesta válida: significa "no hay nada que avisar".
        if (!cancelled) setNotice(data);
      })
      .catch(() => {
        /*
         * El banner es informativo: si la consulta falla, no se muestra nada.
         * Un error aquí no debe competir con los avisos que sí son bloqueantes
         * (correo sin verificar, cuenta suspendida).
         */
        if (!cancelled) setNotice(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!notice || dismissed) return null;

  const style = STYLES[notice.kind];
  const Icon = style.icon;

  return (
    <div className={`border-b px-4 py-3 ${style.container}`}>
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconColor}`} />

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${style.title}`}>
            {notice.code ? `Cupón ${notice.code}` : "Tu prueba gratuita"}
          </p>

          <p className={`mt-0.5 text-xs leading-relaxed ${style.body}`}>
            {notice.message}
          </p>

          {/* Cifras: solo cuando aportan. En `free_access` la frase ya dice todo. */}
          {notice.nextAmount !== null &&
          notice.nextAmount !== notice.currentAmount ? (
            <p className={`mt-1.5 text-xs ${style.body}`}>
              Ahora pagas{" "}
              <span className="font-semibold">
                {notice.currentAmount === 0
                  ? "nada"
                  : `${clp.format(notice.currentAmount)}/mes`}
              </span>
              {" → "}
              <span className="font-semibold">
                {clp.format(notice.nextAmount)}/mes
              </span>
              {notice.endsAt ? (
                <>
                  {" desde el "}
                  <span className="font-semibold">
                    {new Date(notice.endsAt).toLocaleDateString("es-CL")}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ocultar el aviso"
          className={`shrink-0 rounded p-1 transition ${style.close}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Colores por estado.
 *
 * - `ending_soon`: ámbar, hay algo que hacer (aprovechar o prepararse).
 * - `ended`: rojo suave, el monto ya cambió.
 * - `permanent`: verde, es información buena y estable.
 */
const STYLES = {
  ending_soon: {
    icon: CalendarClock,
    container: "border-amber-900/60 bg-amber-950/40",
    iconColor: "text-amber-400",
    title: "text-amber-200",
    body: "text-amber-200/70",
    close: "text-amber-400/60 hover:bg-amber-900/40 hover:text-amber-200",
  },
  ended: {
    icon: BadgePercent,
    container: "border-red-900/60 bg-red-950/30",
    iconColor: "text-red-400",
    title: "text-red-200",
    body: "text-red-200/70",
    close: "text-red-400/60 hover:bg-red-900/40 hover:text-red-200",
  },
  permanent: {
    icon: Sparkles,
    container: "border-emerald-900/60 bg-emerald-950/30",
    iconColor: "text-emerald-400",
    title: "text-emerald-200",
    body: "text-emerald-200/70",
    close: "text-emerald-400/60 hover:bg-emerald-900/40 hover:text-emerald-200",
  },
} as const;
