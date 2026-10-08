"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (loading) return;

    if (!user || !tenant) {
      router.replace("/login");
      return;
    }

    const activeSlug = params?.slug as string;
    if (activeSlug && tenant.slug !== activeSlug) {
      router.replace(`/site/${tenant.slug}/editor`);
    }
  }, [user, tenant, loading, router, params]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <span className="animate-pulse">Cargando espacio de trabajo...</span>
      </div>
    );
  }

  if (!user || !tenant) return null;

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
