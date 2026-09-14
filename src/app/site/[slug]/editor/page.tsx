"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Canvas } from "@/components/editor/Canvas";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { OrganismTooltipPreview } from "@/components/editor/OrganismTooltipPreview";
import { useEditorStore } from "@/hooks/useEditorStore";
import { ORGANISMS_REGISTRY } from "@/lib/editor-registry";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { getPageForEditor, publishPage, saveDraftBlocks } from "@/lib/api/pages";
import { ViewportMode } from "@/components/editor/ViewportSelector";

export default function PageBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageId = searchParams.get("pageId");

  const [zoom, setZoom] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageTitle, setPageTitle] = useState("");
  const [pagePath, setPagePath] = useState("/");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");

  const {
    blocks,
    selectedBlockId,
    loadBlocks,
    setSelectedBlockId,
    addOrganism,
    updateBlockProp,
    resetBlockProps,
    reorderBlocksById,
    deleteBlock,
  } = useEditorStore();

  useEffect(() => {
    if (!pageId) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    void getPageForEditor(pageId)
      .then((page) => {
        if (cancelled) return;
        loadBlocks(page.blocks ?? []);
        setPageTitle(page.title);
        setPagePath(page.path);
        setHasUnpublished(page.hasUnpublishedChanges);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err?.response?.data?.message || "No se pudo cargar la página.";
        setLoadError(Array.isArray(message) ? message[0] : message);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, router, loadBlocks]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.4));
  const handleResetZoom = () => setZoom(1);

  async function handleSaveDraft() {
    if (!pageId) return;
    setIsSaving(true);
    try {
      const res = await saveDraftBlocks(pageId, blocks);
      setHasUnpublished(res.hasUnpublishedChanges);
    } catch {
      // toast: "Error al guardar"
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!pageId) return;
    setIsPublishing(true);
    try {
      await saveDraftBlocks(pageId, blocks);
      await publishPage(pageId);
      setHasUnpublished(false);
    } catch {
      // toast: "Error al publicar"
    } finally {
      setIsPublishing(false);
    }
  }

  if (isLoadingPage) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-950 text-white">
        <span className="animate-pulse">Cargando página...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-950 px-4 text-center">
        <div className="max-w-md rounded-xl border-red-500/50 bg-red-500/10 p-6 text-sm text-red-400">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-950 font-sans text-white">
      <EditorToolbar
        blocksLength={blocks.length}
        handleViewportChange={setViewportMode}
        viewportMode={viewportMode}
        zoom={zoom}
        handleResetZoom={handleResetZoom}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handlePublishPage={handlePublish}
        handleSaveDraft={handleSaveDraft}
      />

      <div className="flex items-center justify-between border-b border-stone-800 bg-stone-900/40 px-4 py-2 text-xs text-stone-400">
        <span className="font-medium text-stone-200">
          {pageTitle}
          {pagePath === "/" ? (
            <span className="ml-2 rounded bg-blue-500/10 px-2 py-0.5 text-blue-400">
              Home
            </span>
          ) : null}
        </span>
        <span>
          {isSaving ? "Guardando..." : null}
          {isPublishing ? "Publicando..." : null}
          {!isSaving && !isPublishing && hasUnpublished
            ? "Cambios sin publicar"
            : null}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Izquierdo */}
        <aside className="w-72 border-r border-stone-800 bg-stone-900/50 p-4 overflow-y-auto">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-400">
            Agregar Secciones
          </h2>

          <div className="flex flex-col gap-2">
            {ORGANISMS_REGISTRY.map(({ meta }) => (
              <OrganismTooltipPreview
                key={meta.name}
                metaName={meta.name}
                displayName={meta.displayName}
                description={meta.description || ""}
                onAdd={() => addOrganism(meta.name)}
              />
            ))}
          </div>
        </aside>

        {/* Canvas Central */}
        <Canvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          viewportMode={viewportMode}
          zoom={zoom}
          onZoomChange={setZoom}
          onSelectBlock={setSelectedBlockId}
          onDeleteBlock={deleteBlock}
          onResetBlock={resetBlockProps}
          onReorderBlocks={reorderBlocksById}
        />

        {/* Sidebar Derecho */}
        <PropertiesPanel
          selectedBlock={selectedBlock}
          onUpdateProp={updateBlockProp}
        />
      </div>
    </div>
  );
}
