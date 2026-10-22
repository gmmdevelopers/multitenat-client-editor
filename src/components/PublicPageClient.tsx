"use client";

import { useSearchParams } from "next/navigation";

import { PageRenderer } from "@/components/PageRenderer";
import { useScrollToAnchor } from "@/lib/use-scroll-to-anchor";
import type { BlockInstance } from "@/types/editor-state";

/**
 * Mensaje tras volver del pago.
 *
 * TRES ESTADOS, no dos: un pago `pending` (efectivo, o una transferencia que
 * tarda) NO es un error, pero tampoco es una reserva confirmada. Decirle
 * "reserva creada" seria mentirle, y tratarlo como fallo le haria pagar otra
 * vez algo que ya esta en camino.
 */
function PaymentNotice({
  outcome,
  appointmentId,
}: {
  outcome: string;
  appointmentId: string | null;
}) {
  const config = {
    ok: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-900",
      title: "¡Reserva confirmada!",
      body: "Tu pago se procesó correctamente y tu hora quedó reservada. Te esperamos.",
    },
    pendiente: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-900",
      title: "Pago en proceso",
      body: "Tu pago está pendiente de confirmación. La hora queda retenida mientras se acredita; te avisaremos cuando se confirme.",
    },
    error: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-900",
      title: "No pudimos completar el pago",
      body: "La hora NO quedó reservada. Puedes intentarlo de nuevo desde la agenda.",
    },
  }[outcome];

  // Un `outcome` desconocido no muestra nada: es mejor que inventar un mensaje
  // sobre el estado de un pago.
  if (!config) return null;

  return (
    <div
      data-payment-notice={outcome}
      className={`border-b ${config.bg} px-4 py-4`}
    >
      <div className="mx-auto max-w-3xl">
        <p className={`text-sm font-bold ${config.text}`}>{config.title}</p>
        <p className={`mt-1 text-sm ${config.text} opacity-80`}>
          {config.body}
        </p>

        {/* Referencia de la cita: permite reclamar con un dato concreto si algo
            falla, en vez de "reserve ayer por la tarde". */}
        {appointmentId ? (
          <p className={`mt-2 font-mono text-[11px] ${config.text} opacity-60`}>
            Referencia: {appointmentId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * La parte de la web publica que **necesita el navegador**.
 *
 * ## Por que existe
 *
 * La pagina (`publico/[slug]/page.tsx`) es ahora un componente de **servidor**,
 * y eso es lo que permite emitir `<title>`/`<meta description>` en el HTML y
 * responder 404 de verdad. Pero dos piezas no pueden ser de servidor:
 *
 * | Pieza | Que necesita |
 * |---|---|
 * | El aviso de pago | Leer `?pago=` / `?cita=`, que pueden cambiar sin recargar |
 * | El salto a un ancla | `window.location.hash` y el scroll real |
 *
 * Se agrupan aqui, en el unico trozo de cliente, y el resto (los bloques ya
 * armados) sigue viajando como HTML desde el servidor.
 *
 * ## Lo que NO se hace aqui
 *
 * No se piden datos. Los bloques llegan por props desde el servidor: si se
 * pidieran aqui, se volveria al problema de antes, un HTML vacio al llegar.
 */
export function PublicPageClient({
  blocks,
  pagePath,
  logoUrl,
}: {
  blocks: BlockInstance[];
  pagePath: string;
  logoUrl: string | null;
}) {
  const searchParams = useSearchParams();

  /**
   * Resultado del pago, cuando el paciente vuelve de Mercado Pago.
   *
   * Mercado Pago redirige a la web con `?pago=ok|pendiente|error`. Se lee aqui
   * porque es la WEB la que muestra el mensaje al paciente: si nadie lo leyera,
   * volveria de pagar y veria la misma pagina de siempre, sin saber si su
   * reserva quedo hecha.
   */
  const paymentOutcome = searchParams.get("pago");
  const paidAppointmentId = searchParams.get("cita");

  /**
   * Salto al ancla del `#` de la URL.
   *
   * Los bloques ya estan montados (llegan del servidor en el primer HTML), asi
   * que `ready` es siempre `true`: no hay que esperar a ninguna rehidratacion de
   * datos, solo a que React pinte.
   */
  useScrollToAnchor(
    typeof window === "undefined" ? null : window.location.hash,
    blocks.length > 0,
  );

  return (
    <>
      {/*
        Aviso de pago, ARRIBA de la pagina.

        Va sobre los bloques y no dentro del agendador: el paciente acaba de
        volver de otra pestana y necesita ver el resultado sin buscarlo. Y el
        agendador pudo quedar en el paso 1, sin relacion con lo que paso.
      */}
      {paymentOutcome ? (
        <PaymentNotice
          outcome={paymentOutcome}
          appointmentId={paidAppointmentId}
        />
      ) : null}

      {/*
        `interactive`: esta es la web REAL que ve el visitante, asi que los
        formularios deben poder rellenarse y enviarse.

        `pagePath` alimenta el aviso por correo ("recibido en /contacto"). Va
        aqui y no en los props del bloque: la ruta es del sitio, no del
        formulario, y moverlo de pagina no debe obligar a reconfigurarlo.
      */}
      <PageRenderer
        blocks={blocks}
        interactive
        pagePath={pagePath}
        logoUrl={logoUrl}
      />
    </>
  );
}
