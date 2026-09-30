"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageRenderer } from "@/components/PageRenderer";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import { readPreviewPalette } from "@/lib/preview-palette";
import { useEditorStore } from "@/hooks/useEditorStore";

/**
 * Preview del BORRADOR del editor, en una pestana aparte.
 *
 * No pega contra el backend: lee `blocks` del mismo store persistido que usa
 * el editor, asi que muestra los cambios sin guardar. Quien quiera ver la
 * version publicada debe entrar a la ruta publica del sitio.
 *
 * El parametro `pageId` solo sirve para no mostrar un preview de otra pagina
 * si el usuario cambio de pestana despues de abrirla.
 */
export default function PreviewPage() {
  // useSearchParams exige un limite de Suspense para poder prerenderizar.
  return (
    <Suspense fallback={<PreviewPlaceholder />}>
      <PreviewContent />
    </Suspense>
  );
}

function PreviewPlaceholder() {
  return <div className="min-h-screen bg-white" />;
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const pageId = searchParams.get("pageId");

  const { blocks, pageId: storePageId } = useEditorStore();
  const [isHydrated, setIsHydrated] = useState(false);
  /**
   * Paleta del sitio, espejada del editor en localStorage.
   *
   * El preview se abre en una pestana nueva, asi que no comparte estado de
   * React con el editor y no puede leerla de ahi: se lee del mismo sitio donde
   * la deja el editor (`site-palette-preview`).
   */
  const [sitePalette, setSitePalette] = useState<unknown>(null);
  const [siteType, setSiteType] = useState<string | null>(null);

  // El store arranca vacio (skipHydration) y se rellena desde localStorage.
  // Esperamos a esa rehidratacion para no pintar un preview en blanco.
  useEffect(() => {
    const snapshot = readPreviewPalette();
    if (snapshot) {
      setSitePalette(snapshot.palette);
      setSiteType(snapshot.siteType);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve(useEditorStore.persist.rehydrate()).finally(() =>
      setIsHydrated(true),
    );
  }, []);

  if (!isHydrated) {
    return <PreviewPlaceholder />;
  }

  if (pageId && storePageId && pageId !== storePageId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <p className="text-sm text-stone-500">
          Esta vista previa pertenece a otra página. Vuelve a abrirla desde el
          editor.
        </p>
      </div>
    );
  }

  return (
    // La paleta del sitio se guarda en localStorage al cargar el editor. Sin
    // ella, el preview (que abre en OTRA pestana, con otro estado de React)
    // pintaria con los colores por defecto y no coincidiria con el canvas.
    <SiteThemeProvider palette={sitePalette} siteType={siteType ?? undefined}>
      <PageRenderer blocks={blocks} />
    </SiteThemeProvider>
  );
}
