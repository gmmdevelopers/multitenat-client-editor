"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getErrorMessage } from "@/lib/api/errors";
import { persistToken } from "@/context/AuthContext";
import {
  createCheckout,
  registerTenant,
  type RegisterTenantPayload,
} from "@/lib/api/registration";
import { RegisterProgress } from "./RegisterProgress";
import { StepAccount } from "./StepAccount";
import { StepBusiness } from "./StepBusiness";
import { StepPlan } from "./StepPlan";
import {
  INITIAL_DRAFT,
  toNationalDigits,
  PHONE_PREFIX,
  type RegistrationDraft,
} from "./registration-utils";

/**
 * Registro en tres pasos: cuenta, negocio y plan.
 *
 * El orden sigue la logica del cliente (primero quien eres, luego tu negocio,
 * luego cuanto pagas) y deja el captcha en el ultimo paso: su token caduca en
 * unos minutos, asi que resolverlo al principio haria que llegara vencido.
 *
 * Al enviar se hacen DOS llamadas, en este orden obligatorio:
 *
 *   1. POST /tenants/register   → crea el tenant y devuelve la sesion
 *   2. POST /billing/checkout   → crea la suscripcion en Mercado Pago
 *
 * El checkout exige sesion, asi que no se puede invertir. Y si el paso 2 falla,
 * la cuenta YA existe: no hay que borrarla (el tenant nace en `basic` y sirve),
 * pero el usuario tiene que poder reintentar el pago sin volver a registrarse.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<RegistrationDraft>(INITIAL_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Si el registro ya se completo, un reintento NO debe volver a crearlo: solo
  // repetir el checkout.
  const [registered, setRegistered] = useState(false);

  const updateDraft = (patch: Partial<RegistrationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async (captchaToken: string) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let requiresPayment = true;

      if (!registered) {
        const payload: RegisterTenantPayload = {
          name: draft.name.trim(),
          legalName: draft.legalName.trim() || undefined,
          slug: draft.slug,
          taxId: draft.taxId,
          // El campo guarda el numero nacional con la mascara (`9 9999 9999`),
          // pero se envia con el prefijo del pais para que quede consistente con
          // los tenants existentes (`+56964048872`) y sirva para llamar o enviar
          // WhatsApp sin tener que adivinar el pais.
          phone: PHONE_PREFIX + toNationalDigits(draft.phone),
          businessType: draft.businessType,
          requestedPlan: draft.requestedPlan,
          admin: {
            fullName: draft.fullName.trim(),
            email: draft.email.trim(),
            password: draft.password,
          },
          captchaToken,
          // Solo se envia si el cliente escribio algo: un campo vacio enviado
          // como `""` no es lo mismo que omitirlo, y el backend lo trataria como
          // un cupon presente que no existe.
          couponCode: draft.couponCode.trim() || undefined,
        };

        const result = await registerTenant(payload);

        // `persistToken` escribe el token en localStorage Y en la COOKIE. Las dos
        // hacen falta, y por motivos distintos:
        //   - localStorage: lo lee el interceptor para las peticiones al API.
        //   - cookie: la lee el PROXY (`src/proxy.ts`), que es quien decide si
        //     deja pasar a las rutas del panel.
        //
        // Escribir solo en localStorage hacia que el proxy no viera sesion y
        // mandara a /login justo despues de registrarse, asi que el cliente
        // nunca llegaba al onboarding.
        persistToken(result.accessToken);

        // La sesion se guarda con la MISMA forma que la del login, porque
        // `AuthContext` la lee igual en los dos casos: espera encontrar
        // `user.tenant` para saber a que organizacion pertenece la sesion.
        //
        // El registro devuelve `tenant` como campo HERMANO de `user`, asi que
        // hay que anidarlo a mano. Guardarlo plano dejaba `tenant` en `null`,
        // y `/onboarding/site` no podia resolver el tenant.
        localStorage.setItem(
          "user",
          JSON.stringify({ ...result.user, tenant: result.tenant }),
        );

        // El proxy usa esta cookie para reescribir las rutas del panel al slug
        // de la organizacion activa. Sin ella, `/onboarding/site` no resuelve
        // a que tenant pertenece la peticion.
        document.cookie = `x-org-slug=${encodeURIComponent(
          result.tenant.slug,
        )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;

        setRegistered(true);

        requiresPayment = result.tenant.requiresPayment;

        // El cupon `free_access` ya otorgo el plan sin suscripcion. Se lleva al
        // panel directamente: crear un checkout aqui suscribiria al cliente a
        // algo que ya tiene gratis.
        if (!requiresPayment) {
          router.replace("/onboarding/site");
          return;
        }
      }

      const checkout = await createCheckout(
        draft.requestedPlan,
        draft.email.trim(),
      );

      if (!checkout.initPoint) {
        // Sin URL de checkout no hay forma de pagar. Se trata como error en vez
        // de redirigir a un string vacio.
        throw new Error(
          "Mercado Pago no devolvio la direccion de pago. Intenta de nuevo.",
        );
      }

      // El checkout de Mercado Pago es un dominio externo, asi que se navega
      // con `location.href` y no con el router de Next.
      window.location.href = checkout.initPoint;
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          registered
            ? "No pudimos iniciar el pago. Intenta de nuevo."
            : "No pudimos crear tu cuenta. Revisa los datos e intenta de nuevo.",
        ),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Crear tu cuenta
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Tres pasos y tu negocio esta en linea.
        </p>
      </div>

      <RegisterProgress currentStep={step} />

      {step === 1 ? (
        <StepAccount
          draft={draft}
          onChange={updateDraft}
          onNext={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <StepBusiness
          draft={draft}
          onChange={updateDraft}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 ? (
        <StepPlan
          draft={draft}
          onChange={updateDraft}
          onSubmit={handleSubmit}
          onBack={() => setStep(2)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : null}

      <p className="mt-6 text-center text-xs text-gray-500">
        Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-400 hover:text-blue-300"
        >
          Inicia sesion
        </Link>
      </p>
    </div>
  );
}
