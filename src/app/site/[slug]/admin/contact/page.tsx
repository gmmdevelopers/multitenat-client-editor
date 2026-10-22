"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Inbox, Mail, MailX } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  listContactMessages,
  type ContactMessage,
} from "@/lib/api/contact-messages";

/**
 * Bandeja de entrada de los formularios de contacto.
 *
 * Los mensajes ya se guardaban en la base desde que se implemento el formulario,
 * pero NO habia forma de leerlos: el cliente solo los recibia por correo, y si
 * no configuro `contactEmail`, no los recibia de ninguna manera. Esta pantalla
 * cierra ese hueco.
 */
export default function ContactMessagesPage() {
  const params = useParams<{ slug: string }>();
  const toast = useToast();

  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listContactMessages()
      .then((result) => setMessages(result.items))
      .catch((err) => {
        const message = getErrorMessage(
          err,
          "No se pudieron cargar los mensajes.",
        );
        setError(message);
        toast.error(message);
      });
  }, [toast]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (messages === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-muted">
          Cargando mensajes...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Inbox className="h-5 w-5 text-accent-strong" />
          Mensajes de contacto
        </h1>
        <p className="mt-1 text-sm text-muted">
          Lo que tus visitantes enviaron desde los formularios de tu web.
        </p>
      </header>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <Inbox className="mx-auto h-6 w-6 text-text-subtle" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Todavía no has recibido mensajes
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">
            Cuando alguien rellene un formulario de tu web, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              settingsHref={`/site/${params.slug}/settings`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  settingsHref,
}: {
  message: ContactMessage;
  settingsHref: string;
}) {
  const date = new Date(message.createdAt);

  return (
    <article
      data-contact-message={message.id}
      className="rounded-2xl border border-line bg-background/60 p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">
            {message.pagePath ? (
              <span className="font-mono text-foreground">
                {message.pagePath}
              </span>
            ) : (
              "Formulario de contacto"
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-text-subtle">
            {date.toLocaleString("es-CL", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>

        {/* Estado del aviso: es lo primero que el cliente necesita saber, porque
            un mensaje sin avisar es uno que probablemente no vio. */}
        {message.notified ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase text-success">
            <Check className="h-3 w-3" />
            Avisado
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase text-accent-strong">
            <MailX className="h-3 w-3" />
            Sin avisar
          </span>
        )}
      </div>

      <dl className="grid gap-2.5">
        {message.fields.map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-3"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              {field.label}
            </dt>
            <dd className="whitespace-pre-wrap text-sm text-foreground">
              {field.value || (
                <span className="text-text-subtle">— sin respuesta —</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        {message.replyTo ? (
          <a
            href={`mailto:${message.replyTo}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-on-accent transition hover:bg-accent-strong"
          >
            <Mail className="h-3.5 w-3.5" />
            Responder a {message.replyTo}
          </a>
        ) : (
          <span className="text-[11px] text-text-subtle">
            El visitante no dejó su correo, así que no se puede responder
            directamente.
          </span>
        )}

        {!message.notified ? (
          <Link
            href={settingsHref}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-strong hover:underline"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Configurar correo de contacto
          </Link>
        ) : null}
      </div>
    </article>
  );
}
