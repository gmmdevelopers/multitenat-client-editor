import { api } from "./client";

/**
 * Aviso del cupón activo del tenant.
 *
 * ## Por qué lo arma el backend
 *
 * Este objeto describe un contrato de cobro: cuánto se paga hoy, cuánto se
 * pagará después y cuándo cambia. Si el frontend lo dedujera del tipo de cupón,
 * habría dos implementaciones de la misma regla y una acabaría mintiendo.
 *
 * `null` significa **no hay nada que avisar** — el backend decide eso, no esta
 * pantalla.
 */
export interface CouponNotice {
  code: string | null;
  type: "discount" | "free_trial" | "free_access" | "trial";
  /**
   * `ending_soon`: queda promoción, avisar de la fecha.
   * `ended`: ya venció; el próximo cobro es distinto.
   * `permanent`: no cambia nada (solo en `free_access`).
   */
  kind: "permanent" | "ending_soon" | "ended";
  grantsPlan: string | null;
  planDisplayName: string;
  /** Precio de lista del plan. */
  planAmount: number;
  /** Lo que paga hoy cada mes. */
  currentAmount: number;
  /** Lo que pagará al terminar la promoción. `null` = no cambia. */
  nextAmount: number | null;
  endsAt: string | null;
  /** Meses restantes. `0` o negativo = ya venció. */
  monthsLeft: number | null;
  /** Frase lista para el banner. */
  message: string;
}

/** Devuelve el aviso, o `null` si no hay nada que avisar. */
export async function getCouponNotice(): Promise<CouponNotice | null> {
  const { data } = await api.get<CouponNotice | null>("/billing/coupon-notice");
  return data;
}
