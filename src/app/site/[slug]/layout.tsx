"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { ProfessionalAppNotice } from "@/components/ProfessionalAppNotice";
import { adminHomePath, mustUseMobileApp } from "@/lib/role-routing";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  /**
   * El `professional` no usa el panel web: trabaja desde la app movil.
   *
   * Se comprueba ANTES que nada y se corta el render: asi no se monta ni un
   * instante la pantalla del panel (que arrancaria peticiones a endpoints que le
   * van a dar 403, y mostraria datos de agenda que no le corresponden).
   */
  const isProfessional = user ? mustUseMobileApp(user.role) : false;

  useEffect(() => {
    if (loading) return;

    if (!user || !tenant) {
      router.replace("/login");
      return;
    }

    const activeSlug = params?.slug as string;

    // El profesional no navega a nada: se le muestra el aviso con el QR.
    if (isProfessional) return;

    /**
     * Slug distinto al de la sesion: se vuelve al espacio del propio tenant.
     *
     * El destino depende del ROL, no siempre el editor: un `receptionist` no
     * puede abrir el canvas, asi que mandarlo ahi lo dejaria en una pantalla que
     * no le corresponde (o en un 403 si el backend corta).
     */
    if (activeSlug && tenant.slug !== activeSlug) {
      router.replace(adminHomePath(tenant.slug));
      return;
    }

    /**
     * El `receptionist` solo trabaja en el panel de administracion.
     *
     * Si cae en cualquier otra ruta (el editor, configuracion, o la raiz del
     * sitio), se le lleva a la agenda. Es lo unico que necesita: atender citas y
     * responder chats.
     *
     * El bloqueo REAL lo hace el backend (`@Roles` en cada endpoint). Esto evita
     * que vea pantallas que solo le darian errores.
     */
    if (user.role === "receptionist") {
      const adminBase = `/site/${tenant.slug}/admin`;

      // Solo se le permite el panel de administracion. Cualquier otra cosa
      // (incluida la raiz del sitio y el editor) vuelve a la agenda.
      if (!pathname.startsWith(adminBase)) {
        router.replace(adminHomePath(tenant.slug));
      }
    }
  }, [user, tenant, loading, router, params, pathname, isProfessional]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <span className="animate-pulse">Cargando espacio de trabajo...</span>
      </div>
    );
  }

  if (!user || !tenant) return null;

  /**
   * Pantalla propia del profesional: aviso + QR para bajar la app.
   *
   * Va aqui, en el layout del sitio, y no ruta por ruta: asi **cualquier** URL
   * del panel que intente abrir le muestra lo mismo. Aplicarlo en cada pagina
   * seria olvidarse de una, y esa seria la puerta abierta.
   */
  if (isProfessional) {
    return <ProfessionalAppNotice />;
  }

  return (
    // Sin sidebar: la navegacion (configuracion, usuario, salir) vive ahora en
    // la toolbar del editor. El panel lateral ocupaba 256px permanentes para
    // solo dos enlaces, que es espacio que le falta al lienzo.
    //
    // `h-screen` se mantiene aqui porque este contenedor SI define la altura de
    // la ventana; el editor usa `h-full` para no sumar altura otra vez.
    <div className="flex h-screen flex-col overflow-hidden bg-gray-900 text-white">
      {/* Aviso de correo sin confirmar. Va arriba del todo para que aparezca en
          todas las pantallas del panel sin que cada una deba incluirlo. */}
      <EmailVerificationBanner />

      {/*
        `min-h-0` + `flex-1` son lo que permite que el hijo encoja dentro del
        flex en vez de desbordar. Sin ellos, una pantalla larga (Configuracion,
        con sus siete secciones) se recortaba contra el `overflow-hidden` del
        padre y no habia forma de bajar a ver el resto: el contenido estaba, pero
        era inalcanzable.

        El scroll lo aporta CADA pantalla (Configuracion usa `overflow-y-auto`),
        no este contenedor: el editor necesita `h-full` sin scroll propio para
        poder gestionar el suyo en el canvas.
      */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
