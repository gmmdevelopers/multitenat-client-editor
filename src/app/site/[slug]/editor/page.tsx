"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Canvas } from "@/components/editor/Canvas";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { OrganismTooltipPreview } from "@/components/editor/OrganismTooltipPreview";
import { useEditorStore } from "@/hooks/useEditorStore";
import {
  DEFAULT_SITE_TYPE,
  ORGANISMS_REGISTRY,
  getLockedOrganismsForTab,
  getOrganismsForTab,
  templateToBlocks,
} from "@/lib/editor-registry";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import type { ComponentRegistryEntry } from "@multitenant/design-system";
import { useAuth } from "@/context/AuthContext";
import type { Plan } from "@multitenant/design-system";
import {
  OrganismTabs,
  type OrganismTab,
} from "@/components/editor/OrganismTabs";
import { useCallback, useMemo, useRef } from "react";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import {
  createPage,
  deletePage,
  getPageForEditor,
  listPages,
  publishPage,
  saveDraftBlocks,
  updatePage,
} from "@/lib/api/pages";
import { getSiteHomePage } from "@/lib/api/sites";
import { PagesPanel } from "@/components/editor/PagesPanel";
import { DeletePageModal } from "@/components/editor/DeletePageModal";
import { CreatePageModal } from "@/components/editor/CreatePageModal";
import type { PageSummary } from "@/types/site";
import { ViewportMode } from "@/components/editor/ViewportSelector";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";

export default function PageBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageId = searchParams.get("pageId");
  const toast = useToast();
  const { tenant } = useAuth();

  const [zoom, setZoom] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageTitle, setPageTitle] = useState("");
  const [pagePath, setPagePath] = useState("/");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PageSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingCreate, setPendingCreate] =
    useState<ComponentRegistryEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  /** Evita que la carga inicial pise una plantilla ya aplicada. */
  const templateAppliedRef = useRef(false);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [activeTab, setActiveTab] = useState<OrganismTab>("all");
  const [sidebarMode, setSidebarMode] = useState<
    "pages" | "sections" | "templates"
  >("sections");

  // El plan del tenant decide si aparecen las capacidades premium
  // (el ecommerce es plan pro). Si no viene, asumimos producto base.
  const tenantPlan: Plan = (tenant?.plan as Plan) ?? "basic";

  // Organismos visibles segun el tab activo y el plan contratado.
  const visibleOrganisms = useMemo(
    () => getOrganismsForTab(activeTab, false, tenantPlan),
    [activeTab, tenantPlan],
  );

  const lockedOrganisms = useMemo(
    () => getLockedOrganismsForTab(activeTab, tenantPlan),
    [activeTab, tenantPlan],
  );

  // Conteo por tab para mostrarlo en cada boton.
  const tabCounts = useMemo(() => {
    const tabs: OrganismTab[] = [
      "all",
      "medical",
      "dental",
      "skincare",
      "barber",
      "massage",
    ];

    return tabs.reduce(
      (acc, tab) => {
        acc[tab] = getOrganismsForTab(tab, false, tenantPlan).length;
        return acc;
      },
      {} as Record<OrganismTab, number>,
    );
  }, [tenantPlan]);

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

    // Rehidratamos ANTES de pedir la pagina a la API. Si se rehidrata despues,
    // localStorage restaura los bloques viejos y pisa los recien cargados
    // (era el bug de "aplico una plantilla y desaparece").
    void Promise.resolve(useEditorStore.persist.rehydrate())
      .catch(() => undefined)
      .then(() => getPageForEditor(pageId))
      .then((page) => {
        if (cancelled) return;

        // Si el usuario ya aplico una plantilla, no pisamos su trabajo con lo
        // que devuelve el servidor (que aun tiene los bloques antiguos).
        if (templateAppliedRef.current) {
          setActiveSiteId(page.siteId ?? null);
          setPagePath(page.path);
          setLoadError(null);
          return;
        }

        // La API es la fuente de verdad: sobrescribe lo persistido.
        loadBlocks(page.blocks ?? [], page.id);
        setActiveSiteId(page.siteId ?? null);
        setPageTitle(page.title);
        setPagePath(page.path);
        setHasUnpublished(page.hasUnpublishedChanges);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = getErrorMessage(err, "No se pudo cargar la página.");
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, router, loadBlocks, toast]);

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
      toast.success("Borrador guardado");
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el borrador."));
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
      toast.success("Cambios publicados");
    } catch (err) {
      // El backend responde 409 cuando no hay cambios sin publicar: es un
      // caso esperado, no un fallo, asi que se muestra como aviso.
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.info("No hay cambios sin publicar");
      } else {
        toast.error(
          getErrorMessage(err, "No se pudieron publicar los cambios."),
        );
      }
    } finally {
      setIsPublishing(false);
    }
  }

  /**
   * Carga una plantilla reemplazando los bloques del canvas actual.
   * No guarda: el usuario revisa y decide si guarda o publica.
   */
  function handleApplyTemplate(entry: ComponentRegistryEntry) {
    const blocks = templateToBlocks(entry);

    if (blocks.length === 0) {
      toast.error("Esta plantilla no tiene secciones definidas.");
      return;
    }

    // Marcamos que el canvas ya tiene contenido propio para que el efecto de
    // carga inicial no vuelva a pedir la pagina y pise la plantilla.
    templateAppliedRef.current = true;
    loadBlocks(blocks);
    setPageTitle(entry.meta.displayName);
    toast.success(
      `Plantilla "${entry.meta.displayName}" cargada (${blocks.length} secciones)`,
    );
  }

  /**
   * Crea una pagina nueva a partir de una plantilla y navega a ella.
   * El path se deriva del tipo de pagina para que el cliente solo lo ajuste.
   */
  /**
   * Abre el modal de creacion con el template elegido.
   *
   * Antes se usaba `window.prompt`, que bloquea el navegador y no permite
   * validar la ruta antes de enviarla.
   */
  function handleCreatePageFromTemplate(entry: ComponentRegistryEntry) {
    if (!activeSiteId || !tenant) {
      toast.error("No se pudo determinar el sitio actual.");
      return;
    }

    setPendingCreate(entry);
  }

  /** Crea la pagina con la ruta y el titulo confirmados en el modal. */
  async function handleConfirmCreate(path: string, title: string) {
    if (!pendingCreate || !activeSiteId) return;

    setIsCreating(true);
    try {
      const { page } = await createPage({
        siteId: activeSiteId,
        path,
        title,
        seoTitle: title,
        seoDescripcion: pendingCreate.meta.description ?? "",
        blocks: templateToBlocks(pendingCreate),
      });

      toast.success(`Página «${path}» creada`);
      setPendingCreate(null);
      templateAppliedRef.current = false;
      void refreshPages();
      router.push(`?pageId=${page.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo crear la página."));
    } finally {
      setIsCreating(false);
    }
  }

  /** Recarga el listado de paginas del sitio. */
  const refreshPages = useCallback(async () => {
    if (!activeSiteId) return;
    setIsLoadingPages(true);
    try {
      setPages(await listPages(activeSiteId));
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cargar el listado de páginas."));
    } finally {
      setIsLoadingPages(false);
    }
  }, [activeSiteId, toast]);

  useEffect(() => {
    if (activeSiteId) void refreshPages();
  }, [activeSiteId, refreshPages]);

  /** Abre otra pagina del sitio sin salir del editor. */
  function handleOpenPage(nextPageId: string) {
    // La plantilla aplicada pertenece a la pagina anterior: al cambiar de
    // pagina, la API vuelve a mandar.
    templateAppliedRef.current = false;
    router.push(`?pageId=${nextPageId}`);
  }

  /**
   * Crea una pagina nueva. Reutiliza el flujo de templates, que es donde el
   * usuario elige el diseno de partida.
   */
  function handleCreatePage() {
    setSidebarMode("templates");
    toast.info("Elige una plantilla y pulsa «Página nueva».");
  }

  /** Confirma el borrado tras escribir la ruta en el modal. */
  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await deletePage(pendingDelete.id);

      toast.success(`Página «${pendingDelete.path}» eliminada`);
      setPendingDelete(null);

      // Si borramos la que estaba abierta, volvemos al home del sitio.
      if (pendingDelete.id === pageId) {
        if (activeSiteId) {
          const home = await getSiteHomePage(activeSiteId);
          templateAppliedRef.current = false;
          router.push(`?pageId=${home.pageId}`);
        }
        return;
      }

      void refreshPages();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo eliminar la página."));
    } finally {
      setIsDeleting(false);
    }
  }

  /**
   * Abre el borrador en una pestana nueva. No pegamos contra la API: el
   * preview lee del mismo store persistido, asi que muestra los cambios
   * sin guardar. La version publicada se ve en la ruta publica del sitio.
   */
  function handlePreview() {
    if (!pageId) return;

    const opened = window.open(
      `/preview?pageId=${pageId}`,
      "_blank",
      "noopener,noreferrer",
    );

    if (!opened) {
      toast.error(
        "El navegador bloqueo la pestana. Habilita las ventanas emergentes.",
      );
    }
  }

  if (isLoadingPage) {
    return (
      <div className="flex h-full items-center justify-center bg-stone-950 text-white">
        <span className="animate-pulse">Cargando página...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-stone-950 px-4 text-center">
        <div className="max-w-md rounded-xl border-red-500/50 bg-red-500/10 p-6 text-sm text-red-400">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    // `h-full` en vez de `h-screen`: el editor vive dentro del contenedor del
    // layout (que ya define la altura de la ventana), asi que declarar
    // `h-screen` otra vez sumaba altura y rompia el scroll.
    <div className="flex h-full flex-col overflow-hidden bg-stone-950 font-sans text-white">
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
        handlePreview={handlePreview}
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar Izquierdo */}
        <aside className="w-72 shrink-0 border-r border-stone-800 bg-stone-900/50 p-4 overflow-y-auto">
          {/* Tres modos: gestionar paginas, anadir bloques o partir de plantilla. */}
          <div className="mb-3 flex rounded-xl bg-stone-950/60 p-1">
            <button
              type="button"
              onClick={() => setSidebarMode("pages")}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                sidebarMode === "pages"
                  ? "bg-stone-800 text-white"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              Páginas
            </button>
            <button
              type="button"
              onClick={() => setSidebarMode("sections")}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                sidebarMode === "sections"
                  ? "bg-stone-800 text-white"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              Secciones
            </button>
            <button
              type="button"
              onClick={() => setSidebarMode("templates")}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                sidebarMode === "templates"
                  ? "bg-amber-400 text-black"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              Templates
            </button>
          </div>

          {sidebarMode === "pages" ? (
            <PagesPanel
              pages={pages}
              activePageId={pageId}
              isLoading={isLoadingPages}
              onOpen={handleOpenPage}
              onDelete={setPendingDelete}
              onCreate={handleCreatePage}
            />
          ) : sidebarMode === "sections" ? (
            <>
          <OrganismTabs
            active={activeTab}
            onChange={setActiveTab}
            counts={tabCounts}
          />

          <div className="flex flex-col gap-2">
            {/* Capacidades premium: se anuncian pero no se pueden usar hasta
                subir de plan. Ocultarlas del todo escondería el upgrade. */}
            {lockedOrganisms.length > 0 ? (
              <div className="mt-2 rounded-xl border-dashed border-amber-400/30 bg-amber-400/5 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Disponible en plan Pro
                </p>
                <div className="flex flex-col gap-1.5">
                  {lockedOrganisms.map(({ meta }) => (
                    <div
                      key={meta.name}
                      className="flex items-center justify-between rounded-lg bg-stone-950/60 px-2.5 py-1.5"
                    >
                      <span className="text-[11px] text-stone-400">
                        {meta.displayName}
                      </span>
                      <span className="text-[10px] text-amber-400">🔒</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {visibleOrganisms.map(({ meta }) => (
              <OrganismTooltipPreview
                key={meta.name}
                metaName={meta.name}
                displayName={meta.displayName}
                description={meta.description || ""}
                onAdd={() => addOrganism(meta.name)}
              />
            ))}

            {visibleOrganisms.length === 0 ? (
              <p className="rounded-xl border-dashed border-stone-800 p-4 text-center text-[11px] text-stone-500">
                Todavía no hay organismos con diseño para este tipo de sitio.
                Puedes usar los del tab <strong>Todos</strong>.
              </p>
            ) : null}
          </div>
            </>
          ) : (
            <TemplateGallery
              plan={tenantPlan}
              busy={isLoadingPage}
              onApplyToCurrent={handleApplyTemplate}
              onCreatePage={handleCreatePageFromTemplate}
            />
          )}
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

      {pendingCreate ? (
        <CreatePageModal
          templateName={pendingCreate.meta.displayName}
          templateDescription={pendingCreate.meta.description}
          suggestedPath={`/${pendingCreate.meta.pageKind ?? "pagina"}`}
          existingPaths={pages.map((p) => p.path)}
          isCreating={isCreating}
          onCancel={() => setPendingCreate(null)}
          onConfirm={(path, title) => void handleConfirmCreate(path, title)}
        />
      ) : null}

      {pendingDelete ? (
        <DeletePageModal
          pageTitle={pendingDelete.title}
          pagePath={pendingDelete.path}
          isDeleting={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </div>
  );
}
