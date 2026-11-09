"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage, getErrorCode } from "@/lib/api/errors";

/**
 * Página de login.
 *
 * El formulario va dentro de un `<Suspense>` porque usa `useSearchParams()`.
 *
 * ## Por qué
 *
 * Next 16 prerenderiza las páginas estáticas en tiempo de build. `useSearchParams`
 * obliga a leer la URL, y durante el prerender no hay URL: sin un límite de
 * Suspense, el build falla con
 *
 *     useSearchParams() should be wrapped in a suspense boundary at page "/login"
 *
 * y el deploy se cae. Con el `<Suspense>` Next renderiza el *fallback* en el
 * build y el formulario real en el cliente, que es cuando la URL ya existe.
 *
 * El fallback no es una pantalla en blanco: mientras se resuelve, se pinta la
 * misma tarjeta con la estructura del formulario, así no hay salto visual.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

/** Esqueleto con la forma de la tarjeta, para el prerender. */
function LoginSkeleton() {
  return (
    <div className="relative w-full max-w-md shrink-0 self-start">
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl backdrop-blur">
        <div
          aria-hidden
          className="h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"
        />
        <div className="p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
              <span aria-hidden className="text-base text-blue-400">
                ◆
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Iniciar sesión
            </h1>
            <p className="mt-1.5 text-sm text-gray-400">
              Entra al panel de tu negocio
            </p>
          </div>
          <div aria-hidden className="space-y-5">
            <div className="h-[68px] rounded-lg bg-gray-800/40" />
            <div className="h-[68px] rounded-lg bg-gray-800/40" />
            <div className="h-[68px] rounded-lg bg-gray-800/40" />
            <div className="h-11 rounded-lg bg-gray-800/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  // `?email=` lo pone la pantalla de vuelta del registro (`/register/gracias`),
  // que no puede iniciar sesion sola: el registro ya no devuelve token. Asi el
  // cliente no tiene que volver a escribir el correo que acaba de pagar.
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  /**
   * Codigo del error del backend, si lo trae.
   *
   * `PAYMENT_PENDING` y `REGISTRATION_EXPIRED` no son fallos de credenciales:
   * significan que el alta existe pero su pago aun no se confirmo. Se pintan
   * distinto para que el cliente no crea que se equivoco de contrasena.
   */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si ya hay una sesion valida en memoria, no tiene sentido mostrar el
  // formulario: el proxy deja pasar /login siempre y redirigimos aqui.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setIsSubmitting(true);

    try {
      await login(email, password, tenantSlug);
    } catch (err) {
      const message = getErrorMessage(
        err,
        "Error de autenticación. Verifica tus datos.",
      );
      const code = getErrorCode(err);

      // El aviso de pago pendiente NO va por toast: necesita quedarse en
      // pantalla, porque lleva un boton para retomar el pago.
      setError(message);
      setErrorCode(code);

      if (!code) {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    /*
     * Sin `min-h-screen` ni fondo propio: el layout de `(auth)` ya ocupa el
     * viewport, pinta el gradiente y centra a sus hijos. Repetirlo aqui era lo
     * que hacia que la tarjeta se estirara en vez de medir su contenido.
     *
     * `shrink-0 self-start` fija ese segundo punto: como hijo de un flex, la
     * tarjeta puede crecer hasta el alto disponible, y `self-start` la deja
     * empezar arriba y medir solo lo suyo. El centrado vertical lo sigue
     * haciendo el `items-center` del layout.
     */
    <div className="relative w-full max-w-md shrink-0 self-start">
      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl backdrop-blur">
        {/* Filo superior de color: mismo detalle que la tarjeta de registro. */}
        <div
          aria-hidden
          className="h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"
        />

        <div className="p-8">
          {/* Cabecera */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
              <span aria-hidden className="text-base text-blue-400">
                ◆
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Iniciar sesión
            </h1>
            <p className="mt-1.5 text-sm text-gray-400">
              Entra al panel de tu negocio
            </p>
          </div>

          {/* Alerta de error
           *
           * Dos formas, porque no son lo mismo:
           * - Credenciales mal: rojo, es un fallo del cliente.
           * - Pago pendiente: ambar + boton para reanudar. NO es un fallo suyo: su
           *   cuenta existe pero el pago aun no se confirmo, y aqui puede seguir
           *   desde donde lo dejo en vez de volver a registrarse (lo que crearia
           *   otra alta y posiblemente otro cobro).
           */}
          {error && errorCode === "PAYMENT_PENDING" ? (
            <div
              role="status"
              className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
            >
              <p className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 shrink-0">
                  ◷
                </span>
                <span>{error}</span>
              </p>

              {/* El slug no se pide aqui: el alta ya tiene el suyo guardado en
                  el backend, y pedirlo obligaria al cliente a recordarlo. */}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/register/gracias/continuar?email=${encodeURIComponent(email)}`,
                  )
                }
                className="mt-3 w-full rounded-lg border border-amber-500/50 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/15"
              >
                Retomar el pago
              </button>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <span aria-hidden className="mt-0.5 shrink-0">
                ⚠
              </span>
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="tenantSlug"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Organización
              </label>
              <input
                id="tenantSlug"
                type="text"
                required
                placeholder="salud-bienestar"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-0"
              />
              <p className="mt-1.5 text-[11px] text-gray-500">
                El identificador de tu sitio: aparece en tu dirección web.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@clinica.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-0"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 pr-16 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-0"
                />
                {/* Mostrar la contrasena evita el error mas comun al entrar:
                    escribirla mal sin poder comprobarlo. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="absolute inset-y-0 right-0 px-3 text-[11px] font-medium uppercase tracking-wide text-gray-500 transition hover:text-gray-300"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Entrando..." : "Entrar al panel"}
            </button>
          </form>
          </div>

          {/* Pie de tarjeta con su propio borde, fuera del padding del formulario:
              asi el separador llega a los bordes de la tarjeta y se lee como
              parte de ella, no como margen del formulario. */}
          <div className="border-t border-gray-800/80 px-8 py-4">
            <p className="text-center text-sm text-gray-400">
              ¿Todavía no tienes cuenta?{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-400 transition hover:text-blue-300"
              >
                Crear una
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-gray-600">
          ¿Problemas para entrar? Escríbenos y te ayudamos.
        </p>
      </div>
  );
}
