"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageRenderer } from "@/components/PageRenderer";
import { getPublicPageByPath } from "@/lib/api/pages";
import { getErrorMessage } from "@/lib/api/errors";
import type { BlockInstance } from "@/types/editor-state";

/**
 * Web publica del tenant.
 *
 * El proxy reescribe la raiz `/` de un subdominio a `/site/<slug>/home`, y esa
 * es la ruta que se sirve aqui: el visitante anonimo ve la pagina PUBLICADA del
 * cliente, no el panel.
 *
 * Los bloques vienen de la API publica y se renderizan sin los adornos del
 * editor, pero CON los organismos conectados (la agenda sigue funcionando).
 */
export default function PublicHomePage() {
  // `useSearchParams` exige un limite de Suspense para poder prerenderizar.
  return (
    <Suspense fallback={<PublicLoading />}>
      <PublicPageContent />
    </Suspense>
  );
}

function PublicLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <span className="animate-pulse text-sm text-stone-500">Cargando...</span>
    </div>
  );
}

function PublicPageContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path") ?? "/";

  const [blocks, setBlocks] = useState<BlockInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPublicPageByPath(path)
      .then((page) => {
        if (cancelled) return;
        setBlocks(page.publishedBlocks ?? []);
        document.title = page.seoTitle || page.title || "Sitio";
      })
      .catch((err) => {
        if (cancelled) return;
        setBlocks([]);
        setError(
          getErrorMessage(err, `No hay una página publicada en "${path}".`),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (blocks === null) return <PublicLoading />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <h1 className="text-4xl font-bold text-stone-800">404</h1>
        <p className="max-w-md text-sm text-stone-500">{error}</p>
      </div>
    );
  }

  return <PageRenderer blocks={blocks} />;
}
