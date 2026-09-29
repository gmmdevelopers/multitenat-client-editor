"use client";

import { Globe, X } from "lucide-react";
import { useState } from "react";

import { buildTenantDomain } from "@/lib/tenant-domain";

/**
 * Aviso de "tu sitio todavia no esta en linea".
 *
 * Por que existe ademas del boton de la toolbar:
 *   El boton dice QUE hacer, pero se puede pasar por alto: un cliente nuevo
 *   entra al editor, añade secciones y no tiene motivo para fijarse en la
 *   esquina superior. El aviso se lo dice en el momento en que importa.
 *
 * Es la version para el EDITOR del aviso que ya existe en el panel para el
 * correo sin verificar: mismo patron, mismo sitio, distinto mensaje.
 *
 * Se puede cerrar, pero vuelve al recargar: es un aviso persistente, y el
 * cliente que lo descarte para siempre volveria a no saber por que su web da
 * 404.
 */
export function SiteNotPublishedBanner({
  siteDomain,
  customDomain,
  needsEmailVerification,
  isPublishing,
  onPublish,
}: {
  siteDomain: string | null;
  customDomain: string | null;
  needsEmailVerification: boolean;
  isPublishing: boolean;
  onPublish: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const domain = customDomain ?? (siteDomain ? buildTenantDomain(siteDomain) : null);

  return (
    <div className="border-b border-blue-900/60 bg-blue-950/40 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-200">
            Tu sitio todavia no esta en linea
          </p>

          <p className="mt-0.5 text-xs leading-relaxed text-blue-200/70">
            {/* Se muestra la direccion que tendra: el cliente asi sabe cual es
                su web sin tener que buscarla en Configuracion. */}
            {domain ? (
              <>
                Cuando lo publiques, tus clientes podran verlo en{" "}
                <span className="font-mono text-blue-200">{domain}</span>. Mientras
                tanto nadie puede acceder.
              </>
            ) : (
              "Cuando lo publiques, tus clientes podran verlo. Mientras tanto nadie puede acceder."
            )}
          </p>

          {needsEmailVerification ? (
            <p className="mt-1.5 text-xs font-medium text-amber-300">
              Confirma tu correo para poder publicarlo. Usa el boton del aviso de
              arriba.
            </p>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={isPublishing}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Globe className="h-3.5 w-3.5" />
              {isPublishing ? "Publicando..." : "Publicar mi sitio"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="rounded p-1 text-blue-400/70 transition hover:bg-blue-900/40 hover:text-blue-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}