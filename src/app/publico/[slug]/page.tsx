"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageRenderer } from "@/components/PageRenderer";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import { getPublicPageByPath } from "@/lib/api/pages";
import { getErrorMessage } from "@/lib/api/errors";
import type { BlockInstance } from "@/types/editor-state";

/**
 * Web publica del tenant.
 *
 * El proxy reescribe la raiz `/` de un subdominio a `/site/<slug>/home`, y esa
 * es la ruta que se sirve aqui: el visitante anonimo ve la pagina PUBLICADA del
 * cliente, no el panel.
 *
 * Los bloques vienen de la API publica y se renderizan sin los adornos del
 * editor, pero CON los organismos conectados (la agenda sigue funcionando).
 */
export default function PublicHomePage() {
  // `useSearchParams` exige un limite de Suspense para poder prerenderizar.
  return (
    <Suspense fallback={<PublicLoading />}>
      <PublicPageContent />
    </Suspense>
  );
}

/**
 * Aplica el icono del sitio como favicon de la pestana.
 *
 * Se hace por DOM y no con `metadata` de Next porque esta pagina es un
 * componente CLIENTE: el icono llega en la respuesta de la API junto a los
 * bloques, y los metadatos de Next se resuelven en el servidor, antes de que
 * exista ese dato.
 *
 * Reutiliza el `<link rel="icon">` que Next ya emitio, en vez de añadir otro:
 * con dos, el navegador puede quedarse con el viejo. Si el sitio no tiene
 * icono, se restaura el del template para no dejar el de otro tenant tras una
 * navegacion entre subdominios.
 */
function applyFavicon(iconUrl: string | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  link.href = iconUrl ?? "/favicon.ico";
}

/**
 * Arma el titulo de la pestana: el nombre del sitio, con la pagina detras.
 *
 *   home        -> "Clinica Dental"
 *   /agenda     -> "Agenda · Clinica Dental"
 *
 * Si el sitio no tiene nombre (no deberia: es obligatorio al crear), se cae al
 * `seoTitle` de la pagina, para no dejar la pestana con la URL pelada.
 */
function buildDocumentTitle(
  siteName: string | null | undefined,
  path: string,
): string {
  const brand = siteName?.trim();

  if (!brand) return "Sitio";

  const isHome = path === "/" || path === "";
  if (isHome) return brand;

  // `agenda` -> `Agenda`; `/servicios/implantes` -> `Implantes`.
  const segment = path.replace(/\/+$/, "").split("/").pop() ?? "";
  const pageLabel = segment
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();

  return pageLabel ? `${pageLabel} \u00b7 ${brand}` : brand;
}

function PublicLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <span className="animate-pulse text-sm text-stone-500">Cargando...</span>
    </div>
  );
}

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

function PublicPageContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path") ?? "/";

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

  const [blocks, setBlocks] = useState<BlockInstance[] | null>(null);
  const [palette, setPalette] = useState<unknown>(null);
  /**
   * Logo del sitio, para inyectarlo en las cabeceras.
   *
   * Es el mismo icono que el favicon: el cliente lo sube UNA vez y sirve para
   * los dos. Va en su propio estado (no solo en `document.title`/favicon) porque
   * tiene que llegar a los bloques por props.
   */
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPublicPageByPath(path)
      .then((page) => {
        if (cancelled) return;
        setBlocks(page.publishedBlocks ?? []);
        // La paleta viene en la MISMA respuesta que los bloques: si se pidiera
        // aparte, la web se pintaria primero con los colores por defecto.
        setPalette(page.palette ?? null);
        // El titulo es el NOMBRE DEL SITIO, no el `seoTitle` de la pagina: el
        // visitante debe reconocer el negocio en la pestana, y `seoTitle` esta
        // pensado para buscadores (suele ser una frase larga).
        //
        // La pagina se añade DETRAS, y solo en las internas: en la home el
        // nombre solo ya es el titulo correcto, y en `/agenda` ayuda a saber
        // donde estas cuando hay varias pestanas abiertas.
        document.title = buildDocumentTitle(page.siteName, path);
        setLogoUrl(page.iconUrl ?? null);
        applyFavicon(page.iconUrl ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setBlocks([]);
        setError(
          getErrorMessage(err, `No hay una página publicada en "${path}".`),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (blocks === null) return <PublicLoading />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <h1 className="text-4xl font-bold text-stone-800">404</h1>
        <p className="max-w-md text-sm text-stone-500">{error}</p>
      </div>
    );
  }

  return (
    <SiteThemeProvider palette={palette}>
      {/*
        Aviso de pago, ARRIBA de la pagina.

        Va sobre los bloques y no dentro del agendador: el paciente acaba de
        volver de otra pestana y necesita ver el resultado sin buscarlo. Y el
        agendador pudo quedar en el paso 1, sin relacion con lo que paso.
      */}
      {paymentOutcome ? (
        <PaymentNotice outcome={paymentOutcome} appointmentId={paidAppointmentId} />
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
        pagePath={path}
        logoUrl={logoUrl}
      />
    </SiteThemeProvider>
  );
}
