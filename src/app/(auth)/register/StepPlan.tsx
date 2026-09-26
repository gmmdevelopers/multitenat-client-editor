"use client";

import { useEffect, useState } from "react";

import { getPlans, type PlanOption } from "@/lib/api/registration";
import {
  Field,
  formatClp,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./fields";
import type { RegistrationDraft } from "./registration-utils";
import { TurnstileWidget } from "./TurnstileWidget";

interface StepPlanProps {
  draft: RegistrationDraft;
  onChange: (patch: Partial<RegistrationDraft>) => void;
  onSubmit: (captchaToken: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Paso 3: el plan y el envio final.
 *
 * El plan elegido es una INTENCION: el backend crea el tenant en `basic` y el
 * plan solo se activa cuando Mercado Pago confirma el pago. Por eso el boton
 * dice "pagar" y no "crear cuenta": el texto debe reflejar que aun no esta
 * contratado.
 *
 * El captcha va en el ULTIMO paso a proposito: su token caduca en unos minutos,
 * asi que resolverlo al principio haria que llegara vencido al envio.
 */
export function StepPlan({
  draft,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  submitError,
}: StepPlanProps) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPlans()
      .then((options) => {
        if (cancelled) return;
        setPlans(options);
        // Se preselecciona el mas economico para que el paso tenga una opcion
        // valida desde el inicio; el usuario puede cambiarla.
        const cheapest = [...options].sort(
          (a, b) => a.amountInPesos - b.amountInPesos,
        )[0];
        if (cheapest && !draft.requestedPlan) {
          onChange({ requestedPlan: cheapest.key });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlansError(
            "No pudimos cargar los planes. Recarga la pagina e intenta de nuevo.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // `draft.requestedPlan` se lee pero no se declara como dependencia: añadirlo
    // volveria a pedir los planes en cada seleccion del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!captchaToken) {
      setCaptchaError("Espera a que se complete la verificacion de seguridad.");
      return;
    }

    setCaptchaError(null);
    onSubmit(captchaToken);
  };

  /**
   * Normaliza el cupon mientras se escribe.
   *
   * El backend compara en mayusculas (`code.trim().toUpperCase()`), asi que
   * mostrarlo asi evita que el cliente vea un `referido-ana` que "no existe"
   * cuando en realidad si existe: la diferencia es solo como lo escribio.
   */
  const handleCouponChange = (value: string) => {
    onChange({ couponCode: value.toUpperCase().replace(/\s/g, "") });
  };

  const hasCoupon = draft.couponCode.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-white">Elige tu plan</h2>
        <p className="mt-1 text-xs text-gray-400">
          Pagas ahora y el plan se activa al confirmarse el pago.
        </p>
      </div>

      {plansError ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-400">
          {plansError}
        </div>
      ) : null}

      <div className="space-y-2">
        {plans.map((plan) => {
          const isSelected = draft.requestedPlan === plan.key;

          return (
            <label
              key={plan.key}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-800 bg-gray-950 hover:border-gray-700"
              }`}
            >
              <input
                type="radio"
                name="plan"
                value={plan.key}
                checked={isSelected}
                onChange={() => onChange({ requestedPlan: plan.key })}
                className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-white">
                    {plan.displayName}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-white">
                    {formatClp(plan.amountInPesos)}
                    <span className="text-[10px] font-normal text-gray-500">
                      {" "}
                      /mes
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
                  {plan.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] text-gray-400">
        <p>
          Empezaras en el plan{" "}
          <span className="font-semibold text-gray-300">Basic</span> y se
          activara{" "}
          <span className="font-semibold text-gray-300">
            {plans.find((p) => p.key === draft.requestedPlan)?.displayName ??
              "el que elijas"}
          </span>{" "}
          cuando se confirme el pago.
        </p>
      </div>

      <Field
        label="Codigo de cupon (opcional)"
        htmlFor="couponCode"
        hint={
          hasCoupon
            ? "Al usar un cupon no se aplica la prueba gratuita de 7 dias."
            : "Si tienes un codigo, escribelo antes de continuar."
        }
      >
        <input
          id="couponCode"
          name="couponCode"
          type="text"
          value={draft.couponCode}
          onChange={(event) => handleCouponChange(event.target.value)}
          disabled={isSubmitting}
          placeholder="REFERIDO-ANA"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={inputClass}
        />
      </Field>

      <div>
        <span className={labelClass}>Verificacion de seguridad</span>
        <TurnstileWidget
          onToken={setCaptchaToken}
          onExpire={() =>
            setCaptchaError("La verificacion expiro. Resuelvela de nuevo.")
          }
          onError={() =>
            setCaptchaError("No se pudo completar la verificacion.")
          }
        />
        {captchaError ? (
          <p className="mt-1 text-[11px] font-medium text-red-400">
            {captchaError}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-400">
          {submitError}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className={secondaryButtonClass}
        >
          Atras
        </button>
        <button
          type="submit"
          data-testid="register-submit"
          disabled={isSubmitting || !captchaToken || plans.length === 0}
          className={primaryButtonClass}
        >
          {isSubmitting ? "Creando tu cuenta..." : "Crear cuenta y pagar"}
        </button>
      </div>
    </form>
  );
}
