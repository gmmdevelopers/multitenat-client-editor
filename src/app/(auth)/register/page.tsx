"use client";

import { useState } from "react";
import Link from "next/link";

import { getErrorMessage } from "@/lib/api/errors";
import {
  createPendingCheckout,
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
 * ## La cuenta NO se crea aqui
 *
 * Al enviar se hacen DOS llamadas, en este orden:
 *
 *   1. POST /tenants/register        → valida los datos y guarda un ALTA PENDIENTE
 *   2. POST /billing/checkout/pending → crea el preapproval de Mercado Pago
 *
 * Ninguna de las dos crea el tenant: eso ocurre cuando MP confirma el pago y su
 * webhook nos avisa. Asi, quien abandona el checkout no deja un tenant ni un
 * usuario reales ocupando slug y email.
 *
 * El cliente termina en la pantalla de vuelta de Mercado Pago, que consulta el
 * estado del alta hasta que la cuenta existe.
 */
export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<RegistrationDraft>(INITIAL_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Si el alta ya se envio, un reintento NO debe volver a enviarla: el captcha
  // es de un solo uso, y volver a registrar pisaria el alta que ya esta ligada
  // a un preapproval. Solo se repite el pago.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const updateDraft = (patch: Partial<RegistrationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = async (captchaToken: string) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let currentPendingId = pendingId;

      if (!currentPendingId) {
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
        currentPendingId = result.pendingRegistrationId;
        setPendingId(currentPendingId);
      }

      // La cuenta todavia NO existe: esto solo crea el preapproval de Mercado
      // Pago. Se vuelve a `/register/gracias`, que espera a que el webhook
      // confirme el cobro y cree el tenant.
      //
      // ## El id va en el PATH, no en la query. Y es importante.
      //
      // Mercado Pago no devuelve al `back_url` tal cual: le concatena sus
      // parametros (`?preapproval_id=...`). Si nuestra URL ya lleva `?alta=...`,
      // MP se encuentra con dos `?` y acaba codificando el segundo, de modo que
      // el `preapproval_id` queda DENTRO de nuestro parametro:
      //
      //   /register/gracias?alta=abc%3Fpreapproval_id%3Df82e04...
      //
      // El backend recibia `abc?preapproval_id=f82e04...` como id y respondia 404.
      // Con el id en el path no hay query que mezclar:
      //
      //   /register/gracias/abc
      //
      // La pagina ademas tolera la forma vieja (ver `normalizePendingId`), por si
      // algun checkout ya creado vuelve con `?alta=`.
      const checkout = await createPendingCheckout(
        currentPendingId,
        draft.requestedPlan,
        `${window.location.origin}/register/gracias/${encodeURIComponent(
          currentPendingId,
        )}`,
      );

      /*
       * Se navega a la URL que devuelve el BACKEND, sea cual sea el proveedor.
       *
       * ## Por que ya no se compone aqui
       *
       * Antes se armaba `pay.<dominio>/pago/<alta>?plan=...` a mano, porque el
       * checkout era nuestro (Bricks). Con Transbank Oneclick Mall **la pantalla
       * de inscripción es de Transbank**: la unica URL valida es la que devuelve
       * `start()`, y no se puede deducir del dominio.
       *
       * Con Mercado Pago, `initPoint` es su checkout hospedado. En los dos casos
       * el backend ya devuelve la URL correcta, asi que el front solo navega.
       *
       * Ventaja adicional: cambiar de proveedor no vuelve a tocar el registro.
       */
      if (!checkout.initPoint) {
        // Sin URL de pago no hay forma de que el cliente autorice. Se trata como
        // error en vez de redirigir a un string vacio.
        throw new Error(
          "El pago no devolvio una direccion a la que ir. Intenta de nuevo.",
        );
      }

      // Dominio externo (Transbank o Mercado Pago): se navega con
      // `location.href` y no con el router de Next.
      window.location.href = checkout.initPoint;
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          pendingId
            ? "No pudimos iniciar el pago. Intenta de nuevo."
            : "No pudimos guardar tus datos. Revisalos e intenta de nuevo.",
        ),
      );
      setIsSubmitting(false);
    }
  };

  return (
    /*
     * `self-start` es la clave del alto propio.
     *
     * El layout de `(auth)` es un flex COLUMN: `<main class="flex-1 flex items-center">`.
     * El eje transversal de ese main es horizontal, pero al centrarnos con
     * `items-center` la tarjeta no queda estirada... salvo que algo la haga
     * crecer. Aqui lo hacian dos cosas a la vez:
     *   - el registro anadia su PROPIO `min-h-screen`, dentro de un contenedor
     *     que ya tiene alto de viewport, asi que la tarjeta reclamaba una
     *     pantalla entera y empujaba al header y al footer;
     *   - sin `shrink-0`, un flex item puede crecer hasta el alto disponible.
     *
     * Con `self-start` + `shrink-0` la tarjeta mide lo que mide su contenido en
     * cada paso, y el `items-center` del layout la sigue centrando en vertical.
     * Tambien se quita el fondo opaco: el layout ya pinta el gradiente detras y
     * duplicar la capa apagaba el efecto.
     */
    <div className="relative w-full max-w-md shrink-0 self-start overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl backdrop-blur">
      {/* Filo superior de color: separa la tarjeta del fondo oscuro sin recargar. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"
      />

      <div className="p-8">
        <div className="mb-7 text-center">
          {/* Icono con el mismo lenguaje que el login, para que las dos
              pantallas se lean como parte del mismo producto. */}
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
            <span aria-hidden className="text-base text-blue-400">
              ◆
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Crear tu cuenta
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Tres pasos y tu negocio esta en linea.
          </p>
        </div>

        <RegisterProgress currentStep={step} />
      </div>

      {/* El formulario tiene su propio padding: asi los pasos pueden decidir
          hasta donde llega su separador sin pelear con el de la tarjeta. */}
      <div className="px-8 pb-8 space-y-6">
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
      </div>

      {/* Separador + pie fuera del padding del formulario: se lee como el
          borde de la tarjeta, no como parte del ultimo paso. */}
      <div className="border-t border-gray-800/80 px-8 py-4">
        <p className="text-center text-xs text-gray-500">
          Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-400 transition hover:text-blue-300"
          >
            Inicia sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
