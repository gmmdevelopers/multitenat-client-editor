"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
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
      router.push("/login");
      return;
    }

    const activeSlug = (params?.slug ?? params?.tenantSlug) as
      | string
      | undefined;

    if (activeSlug && tenant.slug !== activeSlug) {
      router.push(`/site/${tenant.slug}/editor`);
    }
  }, [user, tenant, loading, router, params]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        Cargando editor...
      </div>
    );
  }

  return <>{children}</>;
}
