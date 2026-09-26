"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createSite } from "@/lib/api/sites";
import { getErrorMessage } from "@/lib/api/errors";
import {
  APP_DOMAIN,
  buildTenantDomain,
  normalizeSubdomain,
  validateSubdomain,
} from "@/lib/tenant-domain";

/**
 * Onboarding: se muestra cuando el tenant autenticado todavía no tiene site.
 * Al crear el site, el backend crea en la misma transacción la página home
 * en "/" y aquí redirigimos directo al editor de ese home.
 */
export default function CreateSitePage() {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  /**
   * Marca si el subdominio ya se inicializo con el slug del tenant.
   *
   * Hace falta un flag aparte de `domain` porque `""` es ambiguo: significa
   * tanto "todavia no se inicializo" como "el usuario lo borro". Sin esto, al
   * vaciar el campo el efecto lo rellenaba de nuevo y lo que el usuario
   * escribiera despues se concatenaba al valor repuesto.
   *
   * Es un `useRef` y no estado a proposito: cambiarlo no debe provocar un
   * render, solo decide si el efecto ya hizo su trabajo.
   */
  const didSeedDomain = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const domainError = domain ? validateSubdomain(domain) : null;

  useEffect(() => {
    if (!loading && (!user || !tenant)) {
      router.replace("/login");
    }
  }, [loading, user, tenant, router]);

  // Se propone el slug de la organizacion como subdominio: es el valor que el
  // cliente ya eligio al registrarse, asi que repetirlo es lo esperable. Sigue
  // siendo editable.
  //
  // Se ejecuta UNA sola vez por carga, y el flag lo garantiza: si dependiera de
  // `domain` (o comprobara `!domain`), se dispararia tambien cuando el usuario
  // vacia el campo, reponiendo el slug. El resultado era que el campo no se
  // podia dejar vacio y lo escrito se concatenaba al valor repuesto.
  useEffect(() => {
    if (tenant?.slug && !didSeedDomain.current) {
      didSeedDomain.current = true;
      setDomain(tenant.slug);
    }
  }, [tenant?.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    // Se valida antes de enviar: un subdominio mal formado no da error en el
    // backend, simplemente deja un sitio que el proxy nunca resuelve y el
    // cliente ve un 404 sin saber por que.
    const validationError = validateSubdomain(domain);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Se envia SOLO el subdominio: el dominio completo lo compone el proxy a
      // partir de `NEXT_PUBLIC_APP_DOMAIN`. Mandar el host completo guardaria
      // `massajes.multitenant.cl` en un campo que espera `massajes`.
      const { homePage } = await createSite({ title, domain });

      toast.success("Sitio creado. Ya puedes editar tu home.");
      router.replace(`/site/${tenant.slug}/editor?pageId=${homePage.id}`);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo crear el sitio.");
      setError(message);
      toast.error(message);
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
            <label
              htmlFor="domain"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              Subdominio
            </label>

            {/* El sufijo va FUERA del input y no es editable: se guarda solo
                el subdominio, y el dominio completo lo compone la plataforma.
                Antes el campo pedia "Dominio" y no mostraba el sufijo, asi que
                el cliente creia que tenia que escribirlo entero. */}
            <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-800 bg-gray-950 focus-within:border-blue-500">
              <input
                id="domain"
                type="text"
                required
                placeholder={tenant.slug || "mi-negocio"}
                value={domain}
                onChange={(e) =>
                  setDomain(normalizeSubdomain(e.target.value))
                }
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600"
              />
              <span className="flex select-none items-center border-l border-gray-800 bg-gray-900 px-3 text-sm text-gray-400">
                .{APP_DOMAIN}
              </span>
            </div>

            {domainError ? (
              <p className="mt-1 text-[11px] font-medium text-red-400">
                {domainError}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-500">
                Tu sitio sera{" "}
                <span className="font-mono text-gray-300">
                  {buildTenantDomain(domain || tenant.slug)}
                </span>
              </p>
            )}
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
