"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildSiteUrl, buildTenantDomain } from "@/lib/tenant-domain";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Globe,
  GlobeLock,
  Image as ImageIcon,
  Link2,
  Mail,
  Save,
} from "lucide-react";
import {
  PLAN,
  PLANS,
  PLAN_LABELS,
  type Plan,
} from "@multitenant/design-system";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  getCurrentSite,
  getPublicationSummary,
  requestCustomDomain,
  setSitePublished,
  updateSite,
  type PublicationSummary,
} from "@/lib/api/sites";
import { updateTenant } from "@/lib/api/tenants";
import { ImagePickerModal } from "@/components/editor/ImagePickerModal";
import type { TenantImage } from "@/lib/api/uploads";
import type { Site } from "@/types/site";
import type { DomainRequestStatus } from "@/types/site";

/** Texto del estado de la solicitud de dominio. */
const DOMAIN_STATUS_COPY: Record<DomainRequestStatus, string> = {
  none: "Conecta tu propio dominio para que tus clientes te encuentren por tu marca.",
  requested:
    "Recibimos tu solicitud. Te contactamos para coordinar la configuración.",
  configuring: "Estamos configurando la redirección de tu dominio.",
  active: "Tu dominio propio está activo y respondiendo.",
  rejected:
    "No pudimos completar la solicitud. Revisa los datos y vuelve a enviarla.",
};

const DOMAIN_STATUS_LABEL: Record<DomainRequestStatus, string> = {
  none: "Sin solicitar",
  requested: "Solicitado",
  configuring: "Configurando",
  active: "Activo",
  rejected: "Rechazado",
};

/**
 * Configuracion del sitio: identidad, dominio, plan y pasarela de pago.
 *
 * Los planes se agrupan por lo que habilitan, para que el cliente entienda la
 * diferencia sin leer la letra chica. El cambio de plan es inmediato.
 */
export default function SettingsPage() {
  const { tenant } = useAuth();
  const toast = useToast();

  const [site, setSite] = useState<Site | null>(null);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [plan, setPlan] = useState<Plan>(PLAN.basic);

  /**
   * Buzon donde llegan los mensajes de los formularios.
   *
   * Vive en `Site.settings` y no en cada formulario: se configura una vez y lo
   * usan todos. `hasSavedContactEmail` distingue "sin cambios" de "vacio", para
   * poder avisar al cliente cuando NO hay buzon configurado.
   */
  const [contactEmail, setContactEmail] = useState("");
  const [savedContactEmail, setSavedContactEmail] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  /**
   * Campo de imagen que esta eligiendo el cliente (`banner` o `icon`), o
   * `null` si el modal esta cerrado.
   *
   * Un solo estado para las dos imagenes y no dos booleanos: el modal es el
   * mismo y nunca puede estar abierto para las dos a la vez. Con dos banderas,
   * el caso "las dos abiertas" seria representable y habria que defenderlo.
   */
  const [pickingImageFor, setPickingImageFor] = useState<
    "banner" | "icon" | null
  >(null);
  const [isSavingImages, setIsSavingImages] = useState(false);

  /**
   * Marca si el cliente ya modifico algo durante esta sesion de pantalla.
   *
   * Sirve para que la carga inicial NO pise un cambio hecho mientras su
   * peticion estaba en vuelo: una respuesta lenta llegaba despues del guardado
   * y lo revertia en la UI (el dato en la base siempre estuvo bien).
   *
   * `useRef` y no `useState`: no debe provocar un render, solo se consulta y
   * se escribe dentro del flujo asincrono.
   */
  const hasLocalChangesRef = useRef(false);

  // Solicitud de dominio propio
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [domainRegistrar, setDomainRegistrar] = useState("");
  const [domainEmail, setDomainEmail] = useState("");
  const [domainNotes, setDomainNotes] = useState("");
  const [isRequestingDomain, setIsRequestingDomain] = useState(false);

  // Publicación del sitio
  const [summary, setSummary] = useState<PublicationSummary | null>(null);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  useEffect(() => {
    void getCurrentSite()
      .then((result) => {
        // Si el cliente ya cambio algo mientras esta peticion estaba en vuelo,
        // su cambio manda: aplicar esta respuesta lo pisaria con datos viejos.
        //
        // No es hipotetico: al subir el PRIMER banner, la miniatura aparecia y
        // desaparecia sola, porque la carga inicial resolvia DESPUES del PATCH
        // y `setSite(oldSite)` borraba lo recien guardado.
        if (hasLocalChangesRef.current) return;

        setSite(result);
        setTitle(result?.title ?? "");
        setDomain(result?.domain ?? "");
        const storedEmail = result?.settings?.contactEmail ?? "";
        setContactEmail(storedEmail);
        setSavedContactEmail(storedEmail);
      })
      .catch((err) =>
        toast.error(getErrorMessage(err, "No se pudo cargar el sitio.")),
      )
      .finally(() => setIsLoading(false));
    // Se carga UNA sola vez al montar, a proposito.
    //
    // Antes dependia de `toast`, que en este proyecto no es estable al arrancar:
    // cambiaba de identidad, el efecto se re-ejecutaba y lanzaba una SEGUNDA
    // carga. Esa peticion duplicada no aportaba nada y competia con los
    // guardados del cliente (ver `hasLocalChangesRef`).
    //
    // El lint pide `toast` en las dependencias porque se usa en el `catch`, pero
    // meterlo re-introduce el refetch. Se desactiva solo esta linea, con el
    // motivo escrito: es la excepcion, no el patron.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tenant?.plan) setPlan(tenant.plan as Plan);
  }, [tenant?.plan]);

  /** Recarga los contadores de publicacion (paginas pendientes). */
  const refreshSummary = useCallback(async (siteId: string) => {
    try {
      setSummary(await getPublicationSummary(siteId));
    } catch {
      // El resumen es informativo: si falla, no rompemos la pagina.
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    if (site?.id) void refreshSummary(site.id);
  }, [site?.id, refreshSummary]);

  async function handleSaveSite() {
    if (!site) return;
    setIsSavingSite(true);
    try {
      hasLocalChangesRef.current = true;
      const updated = await updateSite(site.id, { title, domain });
      setSite(updated.site ?? updated);
      toast.success("Sitio actualizado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el sitio."));
    } finally {
      setIsSavingSite(false);
    }
  }

  /**
   * Guarda el correo de contacto.
   *
   * Se valida el formato antes de enviar: un correo mal escrito se guardaria
   * igual y el fallo apareceria mucho despues, como un formulario que "no
   * avisa", que es muy dificil de relacionar con una letra mal puesta.
   */
  async function handleSaveContactEmail() {
    if (!site) return;

    const value = contactEmail.trim();

    // Vacio es valido a proposito: significa "no avisar por correo".
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Escribe un correo valido, por ejemplo contacto@minegocio.cl");
      return;
    }

    setIsSavingContact(true);
    try {
      hasLocalChangesRef.current = true;
      const updated = await updateSite(site.id, {
        settings: { contactEmail: value },
      });
      setSite(updated.site ?? updated);
      setSavedContactEmail(value);
      toast.success(
        value
          ? "Correo de contacto guardado"
          : "Correo de contacto eliminado",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el correo."));
    } finally {
      setIsSavingContact(false);
    }
  }

  /**
   * Asigna (o quita) el banner o el icono del sitio.
   *
   * `image` es la fila de la galeria, no una URL: el backend guarda el ID y
   * comprueba que la imagen pertenece al tenant. Mandar la URL no serviria, y
   * las imagenes "por defecto" (Unsplash) no tienen fila, por eso el modal se
   * abre en modo `galleryOnly`.
   *
   * Se guarda al instante y no con un boton aparte: elegir en el modal YA es la
   * accion, y un "Guardar" extra solo añadiria un estado de "cambios sin
   * guardar" que el cliente puede perder al navegar.
   */
  async function handleSelectImage(
    field: "banner" | "icon",
    image: TenantImage | null,
  ) {
    if (!site) return;

    setIsSavingImages(true);
    try {
      hasLocalChangesRef.current = true;
      const updated = await updateSite(site.id, {
        [field === "banner" ? "bannerImageId" : "iconImageId"]:
          image?.id ?? null,
      });

      setSite(updated.site ?? updated);
      // Se cierra al guardar: el modal ya cumplio su funcion y dejarlo abierto
      // taparia el resultado (la miniatura que acaba de cambiar).
      setPickingImageFor(null);
      toast.success(
        image
          ? field === "banner"
            ? "Banner actualizado"
            : "Icono actualizado"
          : field === "banner"
            ? "Banner quitado"
            : "Icono quitado",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar la imagen."));
    } finally {
      setIsSavingImages(false);
    }
  }

  async function handleChangePlan(next: Plan) {
    if (!tenant || next === plan) return;

    setIsSavingPlan(true);
    try {
      await updateTenant(tenant.id, { plan: next });
      setPlan(next);
      toast.success(`Plan cambiado a ${PLAN_LABELS[next]}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el plan."));
    } finally {
      setIsSavingPlan(false);
    }
  }

  /**
   * Publica o despublica el sitio.
   *
   * Despublicar pide confirmacion porque deja la web caida para los
   * visitantes; publicar no, porque es la accion esperada.
   */
  async function handleTogglePublish(confirmed = false) {
    if (!site) return;

    const next = !site.isPublished;

    if (!next && !confirmed) {
      setConfirmUnpublish(true);
      return;
    }

    setIsTogglingPublish(true);
    try {
      const result = await setSitePublished(site.id, next);

      setSite({ ...site, isPublished: result.isPublished });
      setConfirmUnpublish(false);

      if (result.isPublished) {
        toast.success(
          result.publishedPages > 0
            ? `Sitio publicado (${result.publishedPages} páginas subidas)`
            : "Sitio publicado",
        );
      } else {
        toast.info("Sitio despublicado. Tu web ya no es visible.");
      }

      if (site) void refreshSummary(site.id);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar la publicación."));
    } finally {
      setIsTogglingPublish(false);
    }
  }

  /** Envia la solicitud de dominio. La configuracion la hacemos nosotros. */
  async function handleRequestDomain() {
    if (!site || !domainName.trim()) return;

    setIsRequestingDomain(true);
    try {
      hasLocalChangesRef.current = true;
      const updated = await requestCustomDomain(site.id, {
        domain: domainName.trim(),
        registrar: domainRegistrar.trim() || undefined,
        contactEmail: domainEmail.trim() || undefined,
        notes: domainNotes.trim() || undefined,
      });

      setSite(updated);
      setShowDomainForm(false);
      toast.success(
        "Solicitud enviada. Te contactamos para coordinar la redirección.",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo enviar la solicitud."));
    } finally {
      setIsRequestingDomain(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-stone-400">
          Cargando configuración...
        </span>
      </div>
    );
  }

  const subdomainUrl = buildTenantDomain(tenant?.slug ?? "");
  /**
   * URL publica del sitio, con el dominio COMPLETO.
   *
   * `site.domain` guarda solo el slug (`clinica`), no el host: el proxy lo
   * necesita asi para resolver el tenant. Mostrarlo crudo daba "Ver http://clinica",
   * que no es una direccion real. El host se compone con `buildTenantDomain`,
   * que es la misma funcion que usa el resto del panel.
   *
   * Si el cliente tiene dominio propio, ese manda: es el que sus visitantes usan.
   */
  const siteHost = site?.customDomain ?? subdomainUrl;
  const siteUrl = buildSiteUrl(siteHost);
  const domainRequest = site?.settings?.domainRequest;

  return (
    // `h-full` + `overflow-y-auto`: el scroll vive aqui, no en el layout. Asi el
    // editor (que necesita su propio scroll en el canvas) no se ve afectado, y
    // esta pantalla, que es larga, se puede recorrer entera.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-10">
        {/* Navegacion lateral: fija mientras el contenido scrollea, para poder
            saltar a una seccion sin volver arriba a mano. */}
        <SettingsNav />

        <div className="min-w-0 flex-1">
          <header className="mb-8">
            <Link
              href={`/site/${tenant?.slug ?? ""}/editor`}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-400 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al editor
            </Link>

            <h1 className="text-xl font-bold text-white">Configuración</h1>
            <p className="mt-1 text-sm text-stone-400">
              Identidad del sitio, plan contratado y cobros de la agenda.
            </p>
          </header>

      {/* --- Publicación --- */}
      <section id="publicacion" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          {site?.isPublished ? (
            <Globe className="h-4 w-4 text-emerald-400" />
          ) : (
            <GlobeLock className="h-4 w-4 text-amber-300" />
          )}
          Publicación
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          Mientras está en borrador, tu web responde 404 y nadie la ve. Al
          publicar, también suben las páginas con cambios pendientes.
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border-stone-800 bg-stone-950/60 p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                site?.isPublished
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {site?.isPublished ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </span>
            <div>
              <p
                data-publish-state={site?.isPublished ? "live" : "draft"}
                className="text-xs font-semibold text-white"
              >
                {site?.isPublished ? "Sitio publicado" : "Sitio en borrador"}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                {site?.isPublished
                  ? "Tu web es visible para cualquiera con el enlace."
                  : "Nadie puede ver tu web todavía."}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-stone-400">
              {summary
                ? `${summary.publishedPages} de ${summary.totalPages} páginas publicadas`
                : "—"}
            </p>
            {summary && summary.pendingPages > 0 ? (
              <p
                data-pending-count={summary.pendingPages}
                className="mt-0.5 text-[11px] font-semibold text-amber-300"
              >
                {summary.pendingPages} con cambios sin publicar
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-stone-500">
                Todo al día
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex-wrap items-center justify-between gap-3">
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-cyan-400 hover:underline"
          >
            {site?.isPublished ? `Ver ${siteUrl}` : "Vista previa en el editor"}
          </a>

          <button
            type="button"
            data-toggle-publish="true"
            onClick={() => void handleTogglePublish()}
            disabled={isTogglingPublish || !site}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
              site?.isPublished
                ? "border-stone-700 text-stone-300 hover:bg-stone-800"
                : "bg-emerald-500 text-black hover:bg-emerald-400"
            }`}
          >
            {isTogglingPublish
              ? "Procesando..."
              : site?.isPublished
                ? "Despublicar sitio"
                : "Publicar sitio"}
          </button>
        </div>

        {confirmUnpublish ? (
          <div
            data-confirm-unpublish="true"
            className="mt-4 rounded-xl border-red-500/30 bg-red-500/5 p-4"
          >
            <p className="text-[11px] leading-relaxed text-red-300">
              Al despublicar, tu web deja de estar disponible para los
              visitantes. Las páginas conservan su contenido y puedes volver a
              publicar cuando quieras.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUnpublish(false)}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-stone-300 hover:bg-stone-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-confirm-unpublish-confirm="true"
                onClick={() => void handleTogglePublish(true)}
                disabled={isTogglingPublish}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Sí, despublicar
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* --- Sitio --- */}
      <section id="sitio" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <Globe className="h-4 w-4 text-amber-300" />
          Sitio
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          El nombre y el dominio con el que se publica tu web.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Nombre del sitio
            </span>
            <input
              data-settings-title="true"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Dominio
            </span>
            <input
              data-settings-domain="true"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-400"
            />
          </label>
        </div>

        <div className="mt-4 flex-wrap items-center justify-between gap-3">
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-[11px] text-cyan-400 hover:underline"
          >
            {siteUrl}
          </a>
          <button
            type="button"
            data-save-site="true"
            onClick={() => void handleSaveSite()}
            disabled={isSavingSite}
            className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingSite ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      {/* --- Banner e icono --- */}
      <section id="imagenes" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <ImageIcon className="h-4 w-4 text-amber-300" />
          Banner e icono
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          El banner es la foto grande que aparece en la app móvil. El icono
          identifica tu sitio en la pestaña del navegador y en la cabecera.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Banner: apaisado, es una foto de portada. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Banner
            </p>

            <button
              type="button"
              data-pick-banner="true"
              onClick={() => setPickingImageFor("banner")}
              disabled={isSavingImages}
              className="block aspect-[16/9] w-full overflow-hidden rounded-xl border border-stone-800 bg-stone-950 transition hover:border-amber-400/60 disabled:opacity-50"
            >
              {site?.bannerImage?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={site.bannerImage.url}
                  alt="Banner del sitio"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-600">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-[11px] font-semibold">
                    Sin banner
                  </span>
                  <span className="text-[10px]">Elegir imagen</span>
                </span>
              )}
            </button>

            <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
              Se ve en la app móvil. Si no pones ninguna, aparece la inicial de
              tu negocio.
            </p>

            {site?.bannerImage ? (
              <button
                type="button"
                data-remove-banner="true"
                onClick={() => void handleSelectImage("banner", null)}
                disabled={isSavingImages}
                className="mt-2 text-[11px] font-semibold text-stone-400 transition hover:text-red-300 disabled:opacity-50"
              >
                Quitar banner
              </button>
            ) : null}
          </div>

          {/* Icono: cuadrado, es una marca. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Icono
            </p>

            <div className="flex items-start gap-4">
              <button
                type="button"
                data-pick-icon="true"
                onClick={() => setPickingImageFor("icon")}
                disabled={isSavingImages}
                className="block h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-stone-800 bg-stone-950 transition hover:border-amber-400/60 disabled:opacity-50"
              >
                {site?.iconImage?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={site.iconImage.url}
                    alt="Icono del sitio"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-stone-600">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Sin icono</span>
                  </span>
                )}
              </button>

              <div className="min-w-0">
                <p className="text-[10px] leading-relaxed text-stone-500">
                  Cuadrado y simple: se muestra muy pequeño en la pestaña del
                  navegador.
                </p>

                {site?.iconImage ? (
                  <button
                    type="button"
                    data-remove-icon="true"
                    onClick={() => void handleSelectImage("icon", null)}
                    disabled={isSavingImages}
                    className="mt-2 text-[11px] font-semibold text-stone-400 transition hover:text-red-300 disabled:opacity-50"
                  >
                    Quitar icono
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Dominio propio --- */}
      <section id="dominio" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <Link2 className="h-4 w-4 text-amber-300" />
          Dominio
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          Por defecto usas un subdominio de la plataforma. Puedes conectar tu
          propio dominio pagando la implementación por única vez.
        </p>

        {/* Subdominio incluido */}
        <div className="mb-3 rounded-xl border-stone-800 bg-stone-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">
                Subdominio incluido
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-cyan-400">
                {subdomainUrl}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">
              Incluido
            </span>
          </div>
        </div>

        {/* Dominio propio */}
        <div className="rounded-xl border-stone-800 bg-stone-950/60 p-4">
          <div className="mb-4 flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  domainRequest?.status === "active"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-400/15 text-amber-300"
                }`}
              >
                <Link2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-white">
                  Dominio propio
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                  {DOMAIN_STATUS_COPY[domainRequest?.status ?? "none"]}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border-amber-400/40 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-300">
              $10.000 única vez
            </span>
          </div>

          {/* Pasos, para que el cliente sepa que le toca a el */}
          <ol className="mb-4 grid gap-2 text-[11px] leading-relaxed text-stone-400">
            <li className="flex gap-2">
              <span className="font-mono text-stone-500">1.</span>
              <span>
                <strong className="text-stone-300">Compra tu dominio</strong> en
                el registrador que prefieras (NIC Chile, GoDaddy…). El dominio
                es tuyo y se paga aparte.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-stone-500">2.</span>
              <span>
                <strong className="text-stone-300">
                  Paga la implementación
                </strong>{" "}
                ($10.000 único) y enviamos la solicitud.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-stone-500">3.</span>
              <span>
                <strong className="text-stone-300">
                  Nosotros configuramos
                </strong>{" "}
                la redirección. Te contactamos si hace falta algún dato del DNS.
              </span>
            </li>
          </ol>

          {domainRequest && domainRequest.status !== "none" ? (
            <div
              data-domain-status={domainRequest.status}
              className="mb-4 rounded-lg border-stone-800 bg-stone-900/60 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-white">
                  {domainRequest.requestedDomain}
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                  {DOMAIN_STATUS_LABEL[domainRequest.status]}
                </span>
              </div>
              {domainRequest.registrar ? (
                <p className="mt-1 text-[10px] text-stone-500">
                  Registrador: {domainRequest.registrar}
                </p>
              ) : null}
            </div>
          ) : null}

          {!showDomainForm &&
          domainRequest?.status !== "requested" &&
          domainRequest?.status !== "configuring" &&
          domainRequest?.status !== "active" ? (
            <button
              type="button"
              data-request-domain="true"
              onClick={() => setShowDomainForm(true)}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300"
            >
              Solicitar dominio propio
            </button>
          ) : null}

          {showDomainForm ? (
            <div className="grid gap-3 border-t border-stone-800 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Dominio que compraste
                </span>
                <input
                  data-domain-input="true"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  placeholder="mi-clinica.cl"
                  className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 font-mono text-sm text-white placeholder-stone-700 outline-none focus:border-amber-400"
                />
                <span className="mt-1.5 block text-[10px] text-stone-500">
                  Solo el dominio, sin http:// ni barras.
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Donde lo compraste
                  </span>
                  <input
                    data-domain-registrar="true"
                    value={domainRegistrar}
                    onChange={(e) => setDomainRegistrar(e.target.value)}
                    placeholder="NIC Chile"
                    className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white placeholder-stone-700 outline-none focus:border-amber-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Email de contacto
                  </span>
                  <input
                    data-domain-email="true"
                    value={domainEmail}
                    onChange={(e) => setDomainEmail(e.target.value)}
                    placeholder="contacto@mi-clinica.cl"
                    className="w-full rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white placeholder-stone-700 outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Notas (opcional)
                </span>
                <textarea
                  data-domain-notes="true"
                  rows={2}
                  value={domainNotes}
                  onChange={(e) => setDomainNotes(e.target.value)}
                  placeholder="Tengo acceso al panel del registrador, puedo crear los registros DNS."
                  className="w-full resize-y rounded-lg border-stone-800 bg-stone-950 px-3 py-2 text-sm text-white placeholder-stone-700 outline-none focus:border-amber-400"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDomainForm(false)}
                  disabled={isRequestingDomain}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-domain-submit="true"
                  disabled={!domainName.trim() || isRequestingDomain}
                  onClick={() => void handleRequestDomain()}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isRequestingDomain ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* La paleta de colores ya NO vive aqui: se movio al editor, como cuarto
          tab junto a Paginas/Secciones/Templates. El motivo es que aqui no se
          veia el resultado: el cliente cambiaba un color, volvia al editor y
          recien entonces descubria como quedaba. En el editor se aplica al
          lienzo al instante. */}

      {/* --- Plan --- */}
      <section id="plan" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 text-sm font-bold text-white">Plan</h2>
        <p className="mb-5 text-xs text-stone-400">
          Puedes cambiarlo cuando quieras. El cambio se aplica al instante.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((option) => {
            const isActive = option === plan;
            const isDowngrade = PLANS.indexOf(option) < PLANS.indexOf(plan);
            const requiresPro = option !== PLAN.basic;

            return (
              <button
                key={option}
                type="button"
                data-plan={option}
                onClick={() => void handleChangePlan(option)}
                disabled={isSavingPlan}
                className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${
                  isActive
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-stone-800 bg-stone-950/60 hover:border-stone-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${
                      isActive ? "text-amber-300" : "text-white"
                    }`}
                  >
                    {PLAN_LABELS[option]}
                  </span>
                  {isActive ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-300" />
                  ) : requiresPro ? (
                    <CreditCard className="h-3.5 w-3.5 text-stone-500" />
                  ) : null}
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                  {PLAN_CAPABILITIES[option]}
                </p>

                {isDowngrade && !isActive ? (
                  <span className="mt-2 block text-[10px] text-stone-500">
                    Perderás las capacidades superiores
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Correo de contacto --- */}
      <section id="correo" className="scroll-mt-6 mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <Mail className="h-4 w-4 text-amber-300" />
          Correo de contacto
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          A esta dirección llegan los mensajes que tus visitantes envían desde los
          formularios de tu web. Es una sola para todo el sitio.
        </p>

        {/* Aviso cuando NO hay buzon: el formulario funciona igual, pero los
            mensajes solo quedan en el panel y nadie recibe un correo. Sin este
            aviso, el cliente se entera cuando un visitante se queja de que no
            le contestan. */}
        {!savedContactEmail ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-xs font-semibold text-amber-200">
                Sin correo configurado
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/80">
                Los formularios de tu web guardan los mensajes, pero todavía no
                avisan a nadie. Escribe una dirección y guárdala para empezar a
                recibir los avisos.
              </p>
            </div>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Dirección de destino
          </span>
          <span className="flex items-center gap-2">
            <input
              type="email"
              data-contact-email="true"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contacto@minegocio.cl"
              className="w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder-stone-600 outline-none focus:border-amber-400"
            />
          </span>
          <span className="text-[11px] text-stone-500">
            Déjalo vacío si prefieres ver los mensajes solo desde tu panel.
          </span>
        </label>

        <div className="mt-4 flex items-center justify-end gap-3">
          {contactEmail !== savedContactEmail ? (
            <span className="text-[11px] text-amber-300">Sin guardar</span>
          ) : null}
          <button
            type="button"
            data-save-contact-email="true"
            onClick={() => void handleSaveContactEmail()}
            disabled={isSavingContact || contactEmail === savedContactEmail}
            className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingContact ? "Guardando..." : "Guardar correo"}
          </button>
        </div>
      </section>

      {/* --- Pagos --- */}
      <section id="pagos" className="scroll-mt-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
          <CreditCard className="h-4 w-4 text-amber-300" />
          Cobros de la agenda
        </h2>
        <p className="mb-5 text-xs text-stone-400">
          Conecta tu cuenta de Mercado Pago para cobrar al agendar. El dinero
          llega directo a tu cuenta.
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border-stone-800 bg-stone-950/60 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-stone-400">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                Conexión de pagos
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                Conectar la cuenta y elegir cuánto se cobra al agendar vive en
                el panel de agenda, junto a lo que configura el cobro.
              </p>
            </div>
          </div>

          {/* El boton se MOVIO al panel de agenda: alli estan tambien la
              politica de cobro y el horario, asi que el cliente configura los
              pagos en un solo sitio en vez de repartidos por la app. */}
          <Link
            href={`/site/${tenant?.slug ?? ""}/admin/deposit`}
            className="flex items-center gap-2 rounded-lg border-stone-700 px-4 py-2 text-xs font-semibold text-stone-200 transition hover:bg-stone-800"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Ir a pagos de la agenda
          </Link>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
          La conexión usa OAuth oficial de Mercado Pago: autorizas desde tu
          cuenta y nosotros nunca vemos tu contraseña. Las credenciales quedan
          cifradas y puedes revocarlas cuando quieras.
        </p>
      </section>
        </div>
      </div>

      {/* El modal vive FUERA del contenedor con scroll: es una capa fija sobre
          toda la pantalla, y dentro del `overflow-y-auto` quedaria recortado. */}
      {pickingImageFor ? (
        <ImagePickerModal
          // `galleryOnly`: el banner y el icono guardan el ID de una imagen de
          // la galeria. Las "por defecto" son URLs de Unsplash sin fila, y el
          // backend las rechazaria.
          galleryOnly
          currentUrl={
            (pickingImageFor === "banner"
              ? site?.bannerImage?.url
              : site?.iconImage?.url) ?? ""
          }
          onSelect={() => {
            // Sin efecto: la seleccion real llega por `onSelectImage`.
            // `onSelect` es obligatorio en el modal porque los bloques del
            // editor trabajan con URLs sueltas.
          }}
          onSelectImage={(image) =>
            void handleSelectImage(pickingImageFor, image)
          }
          onClose={() => setPickingImageFor(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Secciones de Configuracion, en el orden en que aparecen.
 *
 * El `id` es el del `<section>` al que salta cada enlace: mantener ambos juntos
 * evita que el menu y el contenido se desincronicen al reordenar.
 */
const SETTINGS_SECTIONS = [
  { id: "publicacion", label: "Publicación" },
  { id: "sitio", label: "Sitio" },
  { id: "imagenes", label: "Banner e icono" },
  { id: "dominio", label: "Dominio" },
  { id: "plan", label: "Plan" },
  { id: "correo", label: "Correo de contacto" },
  { id: "pagos", label: "Cobros" },
] as const;

/**
 * Menu lateral de Configuracion.
 *
 * Lleva a cada seccion con `scrollIntoView` en vez de con un ancla (`href="#id"`)
 * porque el scroll no vive en la ventana: esta pantalla scrollea dentro de un
 * contenedor propio (`overflow-y-auto`), y un ancla haria saltar el documento
 * equivocado. Ademas `scrollIntoView` permite el desplazamiento suave.
 */
function SettingsNav() {
  return (
    <nav
      data-settings-nav="true"
      className="sticky top-10 hidden h-fit w-52 shrink-0 lg:block"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        En esta página
      </p>
      <ul className="flex flex-col gap-0.5 border-l border-stone-800">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              data-settings-nav-item={section.id}
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="w-full border-l-2 border-transparent px-3 py-1.5 text-left text-xs text-stone-400 transition hover:border-amber-400 hover:text-white"
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Que habilita cada plan, en una linea. */
const PLAN_CAPABILITIES: Record<Plan, string> = {
  [PLAN.basic]: "Landing con formularios de contacto.",
  [PLAN.full]:
    "Landing + panel: consultorios, profesionales, agenda y reserva online.",
  [PLAN.pro]: "Todo lo anterior + tienda online y pagos.",
};
