"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
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
    setIsSubmitting(true);

    try {
      await login(email, password, tenantSlug);
    } catch (err) {
      const message = getErrorMessage(
        err,
        "Error de autenticación. Verifica tus datos.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10">
      {/* Resplandor decorativo: da profundidad sin cargar la pantalla. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur">
          {/* Cabecera */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
              <span aria-hidden className="text-lg text-blue-400">
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

          {/* Alerta de error */}
          {error ? (
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
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-2.5 pr-16 text-sm text-white transition placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* Enlace al registro: quien llega aqui sin cuenta debe poder crearla
              sin tener que adivinar la URL. */}
          <p className="mt-6 border-t border-gray-800 pt-5 text-center text-sm text-gray-400">
            ¿Todavía no tienes cuenta?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Crear una
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          ¿Problemas para entrar? Escríbenos y te ayudamos.
        </p>
      </div>
    </div>
  );
}
