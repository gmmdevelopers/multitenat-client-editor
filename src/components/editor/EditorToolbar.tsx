"use client";

import {
  ExternalLink,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Settings,
} from "lucide-react";

import { ViewportMode, ViewportSelector } from "./ViewportSelector";
import { ZoomControls } from "./ZoomControls";
import { buildSiteUrl, buildTenantDomain } from "@/lib/tenant-domain";

/**
 * Estado de publicacion del sitio, tal como lo ve el cliente.
 *
 * Son tres situaciones distintas con ACCIONES distintas, y confundirlas era el
 * problema: el cliente nuevo publicaba la pagina, veia "Publicado" y su web
 * seguia dando 404.
 */
export type PublicationState =
  /** El sitio nunca se puso en linea: la web entera responde 404. */
  | "never-published"
  /** Esta en linea, pero hay cambios sin publicar. */
  | "has-changes"
  /** En linea y al dia. */
  | "up-to-date";

interface EditorToolbarProps {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  handleSaveDraft: () => void;
  /** Publica el SITIO completo, subiendo tambien las paginas pendientes. */
  handlePublishSite: () => void;
  handlePreview: () => void;
  handleViewportChange: (viewport: ViewportMode) => void;
  viewportMode: ViewportMode;
  zoom: number;
  blocksLength: number;
  publicationState: PublicationState;
  isPublishing: boolean;
  /** Subdominio del sitio (`mi-clinica`), para mostrar su URL. */
  siteDomain: string | null;
  customDomain: string | null;
  /** El correo sin verificar impide publicar: el boton lo dice antes de fallar. */
  needsEmailVerification: boolean;
  /**
   * Navegacion y sesion.
   *
   * Vivieron en un sidebar de 256px que solo contenia estos dos enlaces. Con el
   * sidebar fuera, la toolbar pasa a ser el unico punto de navegacion del panel,
   * y recibe el usuario para no volver a consultar el contexto de auth.
   */
  settingsHref: string;
  /** Ruta al panel de administracion (bandeja de mensajes). */
  adminHref: string;
  userFullName: string;
  userEmail: string;
  onLogout: () => void;
}

export function EditorToolbar({
  handleResetZoom,
  handleZoomIn,
  handleZoomOut,
  handlePublishSite,
  handleSaveDraft,
  handlePreview,
  viewportMode,
  handleViewportChange,
  zoom,
  blocksLength,
  publicationState,
  isPublishing,
  siteDomain,
  customDomain,
  needsEmailVerification,
  settingsHref,
  adminHref,
  userFullName,
  userEmail,
  onLogout,
}: EditorToolbarProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-stone-800 bg-stone-900 px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="shrink-0 text-xs font-bold uppercase tracking-wider text-amber-300">
          Editor de Clinica
        </h1>
        <span className="shrink-0 rounded-full bg-stone-800 px-2.5 py-0.5 text-[10px] text-stone-400">
          {blocksLength} {blocksLength === 1 ? "seccion" : "secciones"}
        </span>

        {/* Link a la web del cliente. Solo cuando esta publicada: antes de
            publicar, el dominio da 404 y un enlace que lleva a un error
            confunde mas que ayuda. */}
        {siteDomain && publicationState !== "never-published" ? (
          <SiteLink domain={customDomain ?? buildTenantDomain(siteDomain)} />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ViewportSelector mode={viewportMode} onChange={handleViewportChange} />

        <div className="h-4 w-[1px] bg-stone-800" />

        <ZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handlePreview}
          className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-4 py-1.5 text-xs font-bold text-stone-200 transition hover:border-stone-600 hover:bg-stone-800 hover:text-white"
          title="Ver el borrador en una pestana nueva"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Vista Previa
        </button>

        {/* Accion secundaria: guardar no cambia lo que ve el visitante. */}
        <button
          onClick={handleSaveDraft}
          className="rounded-xl border border-stone-700 px-4 py-1.5 text-xs font-bold text-stone-200 transition hover:border-stone-600 hover:bg-stone-800 hover:text-white"
        >
          Guardar Borrador
        </button>

        {/*
          Solo UN boton es la accion principal en cada momento.

          Antes habia dos botones ambar identicos ("Guardar Borrador" y
          "Publicar Cambios") con acciones distintas, asi que no se distinguia
          cual importaba. Ahora el ambar es exclusivamente "poner el sitio en
          linea".
        */}
        {publicationState === "never-published" ? (
          <PrimaryAction
            onClick={handlePublishSite}
            isBusy={isPublishing}
            disabled={needsEmailVerification}
            label={isPublishing ? "Publicando..." : "Publicar sitio"}
            title={
              needsEmailVerification
                ? "Confirma tu correo para publicar"
                : "Pone tu web en linea para que tus clientes puedan verla"
            }
          />
        ) : null}

        {publicationState === "has-changes" ? (
          <PrimaryAction
            onClick={handlePublishSite}
            isBusy={isPublishing}
            disabled={needsEmailVerification}
            label={isPublishing ? "Publicando..." : "Publicar cambios"}
            title={
              needsEmailVerification
                ? "Confirma tu correo para publicar"
                : "Sube los cambios pendientes a tu web"
            }
          />
        ) : null}

        {publicationState === "up-to-date" ? (
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
            <span aria-hidden>✓</span>
            Publicado
          </span>
        ) : null}

        {/* Separador antes de los controles de cuenta: a la izquierda quedan
            las acciones del SITIO, a la derecha lo que no es del editor. */}
        <div className="mx-1 h-4 w-[1px] bg-stone-800" />

        <AdminLink href={adminHref} />

        <SettingsLink href={settingsHref} />

        <UserMenu
          fullName={userFullName}
          email={userEmail}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}

/**
 * Enlace al panel de administracion.
 *
 * Se llama "Administracion" y no "Mensajes" porque la pantalla va a crecer: la
 * agenda y otras herramientas del dia a dia viviran aqui. Nombrarla por su
 * primer contenido obligaria a renombrarla (y a que el cliente reaprendiera
 * donde esta cada cosa) en cuanto se añada la segunda seccion.
 */
function AdminLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      title="Administración: mensajes, agenda y otras herramientas de tu web"
      className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-200 transition hover:border-stone-600 hover:bg-stone-800 hover:text-white"
    >
      <LayoutDashboard className="h-3.5 w-3.5" />
      Administración
    </a>
  );
}

/** Enlace a la configuracion del sitio. Sustituye al enlace del sidebar. */
function SettingsLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      title="Configuracion del sitio: dominio, plan y cobros"
      className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-200 transition hover:border-stone-600 hover:bg-stone-800 hover:text-white"
    >
      <Settings className="h-3.5 w-3.5" />
      Configuracion
    </a>
  );
}

/**
 * Cuenta del usuario.
 *
 * El nombre se trunca porque es texto del cliente y puede ser largo: sin
 * `max-w` empujaria fuera de la toolbar los botones de publicar.
 */
function UserMenu({
  fullName,
  email,
  onLogout,
}: {
  fullName: string;
  email: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="hidden max-w-[140px] text-right leading-tight lg:block"
        title={email}
      >
        <p className="truncate text-[11px] font-semibold text-white">
          {fullName}
        </p>
        <p className="truncate text-[10px] text-stone-500">{email}</p>
      </div>

      <button
        type="button"
        onClick={onLogout}
        title="Cerrar sesion"
        className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="h-3.5 w-3.5" />
        Salir
      </button>
    </div>
  );
}

function PrimaryAction({
  onClick,
  isBusy,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  isBusy: boolean;
  disabled: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isBusy || disabled}
      title={title}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        disabled
          ? "border border-stone-700 text-stone-400"
          : "bg-amber-400 text-black hover:bg-amber-300"
      }`}
    >
      {/* Con el correo sin verificar se muestra un candado en vez del globo:
          la accion esta bloqueada, y el icono lo dice antes de pulsar. */}
      {disabled ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        <Globe className="h-3.5 w-3.5" />
      )}
      {disabled ? "Confirma tu correo" : label}
    </button>
  );
}

/**
 * Enlace a la web publicada del cliente.
 *
 * Se abre en otra pestana y con `rel="noreferrer"` para no pasarle la URL del
 * panel. El texto es el dominio completo, para que el cliente sepa cual es su
 * direccion sin tener que buscarla.
 */
function SiteLink({ domain }: { domain: string }) {
  // El protocolo lo decide `buildSiteUrl`, no este componente: era logica
  // duplicada que se desincronizaba con la de Configuracion. Esa funcion ya
  // respeta un dominio propio (HTTPS) y un host local (HTTP).
  const url = buildSiteUrl(domain);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Abrir ${domain} en una pestana nueva`}
      className="flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-950 px-2.5 py-1 text-[11px] text-stone-400 transition hover:border-stone-700 hover:text-stone-200"
    >
      <Globe className="h-3 w-3" />
      {domain}
      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
    </a>
  );
}
