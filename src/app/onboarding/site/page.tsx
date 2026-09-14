"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createSite } from "@/lib/api/sites";

/**
 * Onboarding: se muestra cuando el tenant autenticado todavía no tiene site.
 * Al crear el site, el backend crea en la misma transacción la página home
 * en "/" y aquí redirigimos directo al editor de ese home.
 */
export default function CreateSitePage() {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !tenant)) {
      router.replace("/login");
    }
  }, [loading, user, tenant, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { site, homePage } = await createSite({ title, domain });

      router.replace(`/site/${tenant.slug}/editor?pageId=${homePage.id}`);
    } catch (err: any) {
      const message =
        err.response?.data?.message || "No se pudo crear el sitio.";
      setError(Array.isArray(message) ? message[0] : message);
      setIsSubmitting(false);
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <span className="animate-pulse">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-lg rounded-xl border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Crea tu sitio
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Tu cuenta aún no tiene un sitio publicado. Crea el primero para
            empezar a editarlo.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Nombre del sitio
            </label>
            <input
              type="text"
              required
              placeholder="Clínica Salud & Bienestar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Dominio
            </label>
            <input
              type="text"
              required
              placeholder={`${tenant.slug}.multitenant.com`}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg border-gray-800 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 transition duration-150 ease-in-out mt-2"
          >
            {isSubmitting ? "Creando sitio..." : "Crear sitio e ir al editor"}
          </button>
        </form>
      </div>
    </div>
  );
}
