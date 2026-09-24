"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Script de Turnstile de Cloudflare.
 *
 * Se carga a mano en vez de con una libreria: la API es un unico script global
 * y `window.turnstile.render`, asi que añadir una dependencia solo para eso es
 * mas superficie de la que hace falta.
 */
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (
      container: HTMLElement,
      options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
        theme?: "light" | "dark" | "auto";
      },
    ) => string;
    reset: (widgetId?: string) => void;
  };
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

let scriptPromise: Promise<void> | null = null;

/** Carga el script una sola vez, aunque el componente se monte varias veces. */
function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (
      (window as TurnstileWindow).turnstile &&
      document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    ) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("No se pudo cargar la verificacion de seguridad."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Widget de Cloudflare Turnstile.
 *
 * Resuelve el desafio y entrega un token de UN SOLO USO. El backend lo canjea
 * contra Cloudflare; si se enviara el mismo token dos veces, el segundo intento
 * falla porque ya fue consumido.
 *
 * Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` el widget no puede montarse: se avisa en
 * pantalla en vez de dejar el formulario sin poder enviarse y sin explicacion.
 */
export function TurnstileWidget({
  onToken,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Los callbacks se estabilizan para que el efecto de montaje no se vuelva a
  // ejecutar en cada render: si cambiara de identidad, se crearia un widget
  // nuevo cada vez y el token llegaria duplicado.
  const handleToken = useCallback((token: string) => onToken(token), [onToken]);
  const handleExpire = useCallback(() => onExpire?.(), [onExpire]);
  const handleError = useCallback(() => onError?.(), [onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const turnstile = (window as TurnstileWindow).turnstile;

        // Si el script se descarga pero su API no queda disponible (Cloudflare
        // puede rechazar la ejecucion: hostname no autorizado, modo muy
        // estricto, navegador automatizado...), hay que AVISAR. Sin esto el
        // widget queda vacio y el boton deshabilitado sin ninguna explicacion,
        // que es el peor estado posible para quien intenta registrarse.
        if (!turnstile) {
          handleError();
          return;
        }

        // Se evita montar dos veces el mismo contenedor: el segundo render
        // crearia un widget duplicado y el token llegaria dos veces.
        if (widgetIdRef.current) return;

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: handleToken,
          "expired-callback": () => {
            // El token caduca (~5 min). Se limpia para que el formulario no se
            // envie con uno vencido.
            handleToken("");
            handleExpire();
          },
          "error-callback": () => {
            handleToken("");
            handleError();
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          onToken("");
          onError?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, handleToken, handleExpire, handleError]);

  if (!siteKey) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
        Falta configurar{" "}
        <span className="font-mono">NEXT_PUBLIC_TURNSTILE_SITE_KEY</span>: no se
        puede verificar que seas una persona, asi que no es posible completar el
        registro.
      </div>
    );
  }

  return <div ref={containerRef} data-testid="turnstile-widget" />;
}
