"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { buildTenantDomain } from "@/lib/tenant-domain";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, loading, logout } = useAuth();
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
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <aside className="w-64 border-r border-gray-800 bg-gray-950 flex flex-col justify-between p-4">
        <div>
          <div className="mb-8 border-b border-gray-800 pb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Organización
            </h2>
            <p className="text-lg font-bold text-white truncate">
              {tenant.name}
            </p>
            <span className="inline-block mt-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
              {buildTenantDomain(tenant.slug)}
            </span>
          </div>

          <nav className="space-y-1">
            <a
              href={`/site/${tenant.slug}/editor`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              Editor
            </a>
            <a
              href={`/site/${tenant.slug}/settings`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              Configuración & Dominio PRO
            </a>
          </nav>
        </div>

        <div className="border-t border-gray-800 pt-4 flex items-center justify-between">
          <div className="truncate">
            <p className="text-sm font-medium text-white truncate">
              {user.fullName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Salir
          </button>
        </div>
      </aside>

      {/* Contenedor de la vista: el hijo maneja su propio scroll interno.
          `min-h-0` evita que un hijo con altura fija desborde el flex. */}
      {/* `min-h-0` permite que el hijo encoja dentro del flex, y `overflow-y-auto`
          hace scrolleable el contenido largo (por ejemplo Configuración) sin
          tocar el sidebar, que queda fijo. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-900">
        {children}
      </div>
    </div>
  );
}
