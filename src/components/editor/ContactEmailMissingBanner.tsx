"use client";

import Link from "next/link";
import { Mail, X } from "lucide-react";
import { useState } from "react";

/**
 * Aviso de "tus formularios no avisan a nadie".
 *
 * Existe porque el fallo es INVISIBLE: sin `contactEmail`, el formulario se
 * envia bien, el visitante ve la confirmacion y el mensaje se guarda, pero
 * nadie recibe un correo. El cliente se enteraria cuando alguien se queje de no
 * haber recibido respuesta, que es tarde y confuso.
 *
 * Mismo patron que `SiteNotPublishedBanner`: se puede cerrar, pero vuelve al
 * recargar. Un aviso descartable de forma permanente se ignora para siempre.
 */
export function ContactEmailMissingBanner({
  settingsHref,
}: {
  /** Ruta a Configuracion, donde se configura el buzon. */
  settingsHref: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-900/60 bg-amber-950/30 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-200">
            Tus formularios no están avisando a nadie
          </p>

          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">
            Los mensajes de tus visitantes sí se guardan, pero no se envían por
            correo hasta que configures una dirección de contacto.
          </p>

          <Link
            href={settingsHref}
            data-contact-email-link="true"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1 text-xs font-bold text-black transition hover:bg-amber-300"
          >
            <Mail className="h-3.5 w-3.5" />
            Configurar correo de contacto
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-md p-1 text-amber-200/60 transition hover:bg-amber-500/10 hover:text-amber-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
