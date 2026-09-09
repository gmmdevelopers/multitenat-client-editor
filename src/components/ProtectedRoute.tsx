"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
        return;
      }

      if (params?.tenantSlug && user.tenant.slug !== params.tenantSlug) {
        router.push(`/editor`);
      }
    }
  }, [user, loading, router, params]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        Cargando editor...
      </div>
    );
  }

  return <>{children}</>;
}
