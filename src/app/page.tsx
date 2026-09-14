"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getCurrentSite, getSiteHomePage } from "@/lib/api/sites";
import { getErrorMessage } from "@/lib/api/errors";

/**
 * Punto de entrada tras el login.
 *
 * 1. Si no hay sesion -> /login
 * 2. Si el tenant todavia no tiene site -> /onboarding/site
 * 3. Si ya tiene site -> /site/:slug/editor?pageId=<home>
 *
 * El backend garantiza que todo site nace con una pagina home en "/".
 */
export default function EntryPointPage() {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const hasRouted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || hasRouted.current) return;

    if (!user || !tenant) {
      hasRouted.current = true;
      router.replace("/login");
      return;
    }

    hasRouted.current = true;

    void (async () => {
      const site = await getCurrentSite();

      if (!site) {
        router.replace("/onboarding/site");
        return;
      }

      const entryPoint = await getSiteHomePage(site.id);
      router.replace(`/site/${tenant.slug}/editor?pageId=${entryPoint.pageId}`);
    })().catch((err) => {
      hasRouted.current = false;
      const message = getErrorMessage(
        err,
        "No se pudo cargar el sitio. Intenta nuevamente.",
      );
      setError(message);
      toast.error(message);
    });
  }, [loading, user, tenant, router, toast]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-center">
        <div className="max-w-md rounded-xl border-red-500/50 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <span className="animate-pulse">Preparando tu espacio de trabajo...</span>
    </div>
  );
}
