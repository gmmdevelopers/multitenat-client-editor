"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageRenderer } from "@/components/PageRenderer";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import { readPreviewPalette } from "@/lib/preview-palette";
import { useEditorStore } from "@/hooks/useEditorStore";
import { ALL_BLOCKS_MAP, getDefaultPropsForOrganism } from "@/lib/editor-registry";

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

  /**
   * Los componentes del preview, resueltos aqui.
   *
   * ## Por que en la pagina y no en `PageRenderer`
   *
   * `PageRenderer` ya no importa `ALL_BLOCKS_MAP` (era lo que metia los 130
   * componentes del design system en el bundle de la web publica). El preview si
   * puede permitirse ese import: es una pantalla del EDITOR, no la web del
   * visitante, y necesita poder pintar cualquier bloque mientras se edita.
   *
   * Se memoiza por la lista de bloques: recalcular el mapa en cada render del
   * preview seria trabajo tirado, y la lista cambia menos que el render.
   */
  const previewComponents = useMemo(
    () =>
      Object.fromEntries(
        Array.from(new Set(blocks.map((block) => block.metaName)))
          .map((name) => [name, ALL_BLOCKS_MAP.get(name)?.component])
          .filter(([, component]) => Boolean(component)),
      ) as Record<string, any>,
    [blocks],
  );

  const previewDefaultProps = useMemo(
    () =>
      Object.fromEntries(
        Array.from(new Set(blocks.map((block) => block.metaName))).map(
          (name) => [name, getDefaultPropsForOrganism(name)],
        ),
      ) as Record<string, Record<string, unknown>>,
    [blocks],
  );

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
      {/*
        `interactive`: el preview es una vista REAL del resultado, asi que los
        formularios deben poder rellenarse. Es la unica forma de comprobar que el
        envio funciona antes de publicar.

        El editor (canvas) los deja en modo diseno; aqui no, porque este es
        justamente el sitio donde se prueba.
      */}
      <PageRenderer
        blocks={blocks}
        components={previewComponents}
        defaultProps={previewDefaultProps}
        interactive
        pagePath="/preview"
      />
    </SiteThemeProvider>
  );
}
