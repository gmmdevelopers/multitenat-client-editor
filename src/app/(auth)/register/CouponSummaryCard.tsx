"use client";

import type { CouponDescription } from "@/lib/api/registration";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Resumen del beneficio de un cupón, antes de pagar.
 *
 * ## Por qué existe
 *
 * El cliente escribía el código y no veía nada: recién en Webpay descubría el
 * monto, sin saber si el cupón se había aplicado, cuánto duraba ni qué pasaría
 * después. Esa falta de información es lo que genera desconfianza, y en un
 * cobro recurrente es peor: el cliente teme una letra chica.
 *
 * ## La línea que importa
 *
 * "Desde el mes N: $X" es el dato que de verdad tranquiliza. Sin él, un cliente
 * con "30% por 3 meses" no sabe si el cuarto mes le cobrarán el triple de golpe.
 *
 * ## Los montos vienen del backend
 *
 * Esta tarjeta no calcula nada: muestra lo que devolvió `validateCoupon`, que
 * usa las mismas funciones que deciden el cobro real. Un descuento calculado en
 * el cliente podría no coincidir con lo que se le cobra.
 */
export function CouponSummaryCard({
  coupon,
  planDisplayName,
}: {
  coupon: CouponDescription;
  planDisplayName: string;
}) {
  const hasDiscount = coupon.percentOff !== null && coupon.percentOff > 0;
  const hasFreeTrial = (coupon.freeTrialMonths ?? 0) > 0;
  const isFreeAccess = coupon.type === "free_access";

  return (
    <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <span aria-hidden>✓</span>
            Cupón {coupon.code} aplicado
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">{coupon.summary}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-emerald-900/60 pt-3 text-sm">
        {/* Plan y precio de lista */}
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-gray-400">{planDisplayName}</dt>
          <dd className="text-gray-300">{clp.format(coupon.planAmount)} / mes</dd>
        </div>

        {/* Lo que paga hoy */}
        {!isFreeAccess ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-gray-400">
              {hasFreeTrial ? "Durante la prueba" : "Hoy pagas"}
            </dt>
            <dd className="font-semibold text-white">
              {coupon.firstPayment === 0
                ? "Gratis"
                : `${clp.format(coupon.firstPayment)} / mes`}
            </dd>
          </div>
        ) : null}

        {/* Cuánto dura */}
        {coupon.durationMonths ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-gray-400">Duración del descuento</dt>
            <dd className="text-gray-200">
              {coupon.durationMonths} mes
              {coupon.durationMonths === 1 ? "" : "es"}
              {coupon.promoEndsAt ? (
                <span className="ml-1 text-xs text-gray-500">
                  (hasta{" "}
                  {new Date(coupon.promoEndsAt).toLocaleDateString("es-CL")})
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}

        {hasFreeTrial ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-gray-400">Meses gratis</dt>
            <dd className="text-gray-200">
              {coupon.freeTrialMonths} mes
              {coupon.freeTrialMonths === 1 ? "" : "es"}
            </dd>
          </div>
        ) : null}

        {/* Lo que paga después: LA línea que evita la sorpresa */}
        {coupon.fullPriceAfter !== null ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-amber-300/90">
              {hasFreeTrial
                ? `Desde el mes ${(coupon.freeTrialMonths ?? 0) + 1}`
                : `Desde el mes ${(coupon.durationMonths ?? 0) + 1}`}
            </dt>
            <dd className="font-semibold text-amber-200">
              {clp.format(coupon.fullPriceAfter)} / mes
            </dd>
          </div>
        ) : hasDiscount && !isFreeAccess ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-gray-400">Después</dt>
            <dd className="text-gray-200">Sin cambios (descuento permanente)</dd>
          </div>
        ) : null}

        {isFreeAccess ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-gray-400">Cobro</dt>
            <dd className="font-semibold text-white">
              Ninguno, en ningún momento
            </dd>
          </div>
        ) : null}
      </dl>

      {!isFreeAccess ? (
        <p className="mt-3 border-t border-emerald-900/60 pt-3 text-[11px] leading-relaxed text-gray-500">
          El cobro es mensual y puedes cancelar cuando quieras desde tu panel. Los
          montos no cambian sin aviso.
        </p>
      ) : null}
    </div>
  );
}
