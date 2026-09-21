"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Globe,
  GlobeLock,
  Link2,
  Lock,
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

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
        setSite(result);
        setTitle(result?.title ?? "");
        setDomain(result?.domain ?? "");
      })
      .catch((err) =>
        toast.error(getErrorMessage(err, "No se pudo cargar el sitio.")),
      )
      .finally(() => setIsLoading(false));
  }, [toast]);

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
      const updated = await updateSite(site.id, { title, domain });
      setSite(updated.site ?? updated);
      toast.success("Sitio actualizado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el sitio."));
    } finally {
      setIsSavingSite(false);
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

  const publicUrl = domain ? `http://${domain}` : "sin dominio configurado";
  const subdomainUrl = tenant?.slug
    ? `${tenant.slug}.multitenant.cl`
    : "multitenant.cl";
  const domainRequest = site?.settings?.domainRequest;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-bold text-white">Configuración</h1>
        <p className="mt-1 text-sm text-stone-400">
          Identidad del sitio, plan contratado y cobros de la agenda.
        </p>
      </header>

      {/* --- Publicación --- */}
      <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
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
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-cyan-400 hover:underline"
          >
            {site?.isPublished ? `Ver ${publicUrl}` : "Vista previa en el editor"}
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
      <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
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
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-[11px] text-cyan-400 hover:underline"
          >
            {publicUrl}
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

      {/* --- Dominio propio --- */}
      <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
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

      {/* --- Plan --- */}
      <section className="mb-6 rounded-2xl border-stone-800 bg-stone-900/50 p-6">
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

      {/* --- Pagos --- */}
      <section className="rounded-2xl border-stone-800 bg-stone-900/50 p-6">
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
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                Mercado Pago no conectado
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                Aún no autorizaste tu cuenta. Mientras tanto, la agenda funciona
                sin pago previo.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-connect-payments="true"
            disabled
            title="Disponible al terminar la integración OAuth"
            className="flex items-center gap-2 rounded-lg border-stone-700 px-4 py-2 text-xs font-semibold text-stone-400 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Lock className="h-3.5 w-3.5" />
            Conectar cuenta
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
          La conexión usa OAuth oficial de Mercado Pago: autorizas desde tu
          cuenta y nosotros nunca vemos tu contraseña. Las credenciales quedan
          cifradas y puedes revocarlas cuando quieras.
        </p>
      </section>
    </div>
  );
}

/** Que habilita cada plan, en una linea. */
const PLAN_CAPABILITIES: Record<Plan, string> = {
  [PLAN.basic]: "Landing con formularios de contacto.",
  [PLAN.full]:
    "Landing + panel: consultorios, profesionales, agenda y reserva online.",
  [PLAN.pro]: "Todo lo anterior + tienda online y pagos.",
};
