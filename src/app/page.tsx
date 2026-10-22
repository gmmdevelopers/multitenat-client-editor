"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getCurrentSite, getSiteHomePage } from "@/lib/api/sites";
import { getErrorMessage } from "@/lib/api/errors";
import { adminHomePath, canUseEditor } from "@/lib/role-routing";

/**
 * Punto de entrada tras el login.
 *
 * 1. Si no hay sesion -> /login
 * 2. Si el tenant todavia no tiene site -> /onboarding/site
 * 3. **El destino depende del ROL:**
 *    - `owner` / `admin` -> el editor de canvas
 *    - `receptionist` -> la agenda (no puede usar el canvas)
 *    - `professional` -> su pantalla de descarga de la app
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
      /**
       * El destino se decide por ROL antes de pedir nada al servidor.
       *
       * ## El bug que arregla
       *
       * Antes se mandaba **a todos** al editor (`/site/<slug>/editor`). Un
       * `receptionist` aterrizaba en el canvas —que no puede usar— y solo se
       * corregia despues, cuando el layout del sitio lo redirigia. Se veia un
       * parpadeo del editor y una redireccion de mas.
       *
       * Decidiendolo aqui, cada rol va **directo** a su pantalla:
       *
       * | Rol | Destino |
       * |---|---|
       * | `owner` / `admin` | El editor de canvas |
       * | `receptionist` | La agenda |
       * | `professional` | La agenda tambien, **y el layout del sitio le muestra el QR** |
       *
       * El `professional` se manda a la agenda igual que el `receptionist`
       * porque el redirect solo decide **por donde se entra**: quien corta el
       * paso al panel es el layout del sitio, que es el unico sitio donde la
       * regla se aplica a TODAS las rutas. Duplicar aqui el caso del profesional
       * serian dos reglas que se pueden desincronizar.
       */
      if (!canUseEditor(user.role)) {
        router.replace(adminHomePath(tenant.slug));
        return;
      }

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
