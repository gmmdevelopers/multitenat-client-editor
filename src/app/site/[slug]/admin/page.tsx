"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Entrada del panel de administracion.
 *
 * Redirige a la primera seccion en vez de mostrar un indice: hoy solo hay una
 * (los mensajes), y una pantalla intermedia que solo lleva a otra no aporta.
 * Cuando haya varias, este es el sitio para convertirlo en un resumen.
 *
 * Es de cliente porque usa `useParams`: en Next 15 la prop `params` llega como
 * Promise y resolverla exigiria un componente de servidor.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  const routeParams = useParams<{ slug: string }>();

  useEffect(() => {
    if (routeParams?.slug) {
      // La agenda es la pantalla principal del panel: es lo que el cliente abre
      // cada dia. Los mensajes se consultan de vez en cuando.
      router.replace(`/site/${routeParams.slug}/admin/agenda`);
    }
  }, [routeParams?.slug, router]);

  return null;
}
