"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Canvas } from "@/components/editor/Canvas";
import { SiteNotPublishedBanner } from "@/components/editor/SiteNotPublishedBanner";
import { ContactEmailMissingBanner } from "@/components/editor/ContactEmailMissingBanner";
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
import { PalettePanel } from "@/components/editor/PalettePanel";
import { SeoTagsPanel } from "@/components/editor/SeoTagsPanel";
import { UtilitiesPanel } from "@/components/editor/UtilitiesPanel";
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
import { getSiteHomePage, setSitePublished } from "@/lib/api/sites";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { PagesPanel } from "@/components/editor/PagesPanel";
import { DeletePageModal } from "@/components/editor/DeletePageModal";
import { CreatePageModal } from "@/components/editor/CreatePageModal";
import type { PageSummary } from "@/types/site";
import { ViewportMode } from "@/components/editor/ViewportSelector";
import { storePreviewPalette } from "@/lib/preview-palette";
import type { CustomPalette } from "@multitenant/design-system";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";

export default function PageBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParams = useParams<{ slug: string }>();
  const ownerSlugFromRoute = routeParams?.slug ?? "";
  const pageId = searchParams.get("pageId");
  const toast = useToast();
  const { tenant, user, logout } = useAuth();

  /**
   * Slug con el que se construyen las rutas del panel.
   *
   * `tenant.slug` es la fuente de verdad (el layout ya redirige si la URL no
   * coincide), pero durante el primer render puede no estar hidratado: el slug
   * de la ruta es el fallback para que el enlace a Configuracion no salga
   * apuntando a `/site//settings`.
   */
  const ownerSlug = tenant?.slug ?? ownerSlugFromRoute;

  const [zoom, setZoom] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageTitle, setPageTitle] = useState("");
  const [pagePath, setPagePath] = useState("/");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  /**
   * Paleta del sitio, para pintar el canvas con los colores del cliente.
   *
   * Vive aqui y no en el store del editor porque NO forma parte del borrador de
   * la pagina: es configuracion del sitio. Si se guardara en los bloques, dos
   * paginas del mismo sitio podrian tener paletas distintas.
   */
  const [sitePalette, setSitePalette] = useState<unknown>(null);
  /** Vertical del sitio, que decide los colores por defecto. */
  const [siteType, setSiteType] = useState<string | undefined>(undefined);
  /**
   * Logo del sitio (el icono de Configuracion), para las cabeceras del canvas.
   *
   * Se rellena con la respuesta del editor, igual que la paleta: venir de otra
   * peticion podria dar un canvas con un logo y una web con otro.
   */
  const [siteIconUrl, setSiteIconUrl] = useState<string | null>(null);
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

  /**
   * Si el SITIO esta en linea (`Site.isPublished`).
   *
   * Es distinto de `hasUnpublished`: aquel mira si la pagina tiene cambios
   * pendientes, este si la web existe para los visitantes. Un sitio puede
   * tener las paginas publicadas y seguir en 404.
   */
  const [isSitePublished, setIsSitePublished] = useState(false);
  /** Subdominio del sitio (`mi-clinica`), para mostrar su URL en la toolbar. */
  const [siteDomain, setSiteDomain] = useState<string | null>(null);
  const [siteCustomDomain, setSiteCustomDomain] = useState<string | null>(null);
  /**
   * Buzon de los formularios del sitio, o `null` si no esta configurado.
   *
   * Se usa para avisar en el editor de que los mensajes se guardan pero no se
   * envian por correo. El fallo seria invisible: el formulario responde bien al
   * visitante y el mensaje queda en la base, pero nadie se entera.
   */
  const [siteContactEmail, setSiteContactEmail] = useState<string | null>(null);
  /** El correo sin verificar impide publicar; el boton lo avisa antes. */
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  /**
   * Estado del correo, para que el boton de publicar lo sepa ANTES de pulsar.
   *
   * Se consulta aqui y no se deduce de un intento fallido: el cliente debe ver
   * "Confirma tu correo" en el boton, no descubrirlo con un 403 al pulsarlo.
   */
  const { verified: emailVerified } = useEmailVerification();

  useEffect(() => {
    // `false` = confirmado sin verificar. `null` (aun comprobando, o fallo de
    // red) NO bloquea: es preferible dejar intentar y recibir el 403 del
    // backend que impedir una accion que quiza si estaba permitida.
    setNeedsEmailVerification(emailVerified === false);
  }, [emailVerified]);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [activeTab, setActiveTab] = useState<OrganismTab>("all");
  const [sidebarMode, setSidebarMode] = useState<
    "pages" | "sections" | "templates" | "palette" | "utilities" | "seo"
  >("sections");

  /**
   * Etiquetas SEO de la pagina abierta.
   *
   * Viven en el editor y no en el store de bloques: son un dato de la PAGINA, no
   * del lienzo, y no deben entrar en el historial de deshacer (deshacer un
   * cambio de color no tiene por que quitar una etiqueta).
   */
  const [seoTags, setSeoTags] = useState<string[]>([]);
  /** Titulo y descripcion SEO de la pagina abierta. */
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

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
    focusField,
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

    /**
     * Al cambiar de pagina, se SUELTA la seleccion.
     *
     * ## El fallo (5.7)
     *
     * `selectedBlockId` vive en el store y **sobrevive** al cambio de pagina: no
     * pertenece a ninguna pagina en concreto. Al abrir otra desde el listado, el
     * lienzo ya no contiene ese bloque —`selectedBlock` queda `undefined`— pero
     * el id seguia marcado.
     *
     * El resultado es el sintoma que se reporto: la URL cambia, la pagina nueva
     * se carga... y el editor **parece** no haber navegado, porque se queda sin
     * panel de propiedades y sin el bloque enfocado, como si no hubiera nada
     * seleccionado que explicara lo que se ve.
     *
     * Se limpia ANTES de pedir la pagina, no despues: si se dejara hasta que
     * llegaran los bloques, durante la carga convivirian la seleccion vieja y los
     * bloques nuevos.
     */
    setSelectedBlockId(null);

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
        // Etiquetas SEO de ESTA pagina (vacio si nunca se editaron).
        setSeoTags(page.seoTags ?? []);
        setSeoTitle(page.seoTitle ?? "");
        setSeoDescription(page.seoDescripcion ?? "");
        setHasUnpublished(page.hasUnpublishedChanges);

        // Estado del SITIO, que es lo que decide si la web responde o da 404.
        if (page.site) {
          setIsSitePublished(page.site.isPublished);
          setSiteDomain(page.site.domain);
          setSiteCustomDomain(page.site.customDomain);
          setSiteContactEmail(page.site.contactEmail ?? null);
          // La paleta se rellena de la respuesta del editor y no de una
          // peticion aparte: si no coincidieran, el canvas pintaria un tema y
          // la web publicada otro.
          setSitePalette(page.site.palette ?? null);
          setSiteType(page.site.siteType ?? undefined);
          setSiteIconUrl(page.site.iconImageUrl ?? null);
          storePreviewPalette({
            palette: page.site.palette ?? null,
            siteType: page.site.siteType ?? null,
          });
        }
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
  }, [pageId, router, loadBlocks, setSelectedBlockId, toast]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  /**
   * Refresca el estado del SITIO al volver a la pestana del editor.
   *
   * El cliente configura su correo de contacto en Configuracion y vuelve con el
   * enlace de la toolbar. Como es la MISMA ruta, Next no remonta la pagina y el
   * efecto de carga no se vuelve a ejecutar: el aviso "tus formularios no estan
   * avisando a nadie" seguia apareciendo aunque el correo ya estuviera guardado.
   *
   * Se recarga SOLO el estado del sitio (nunca los bloques) para no pisar los
   * cambios sin guardar del cliente: `loadBlocks` sobrescribiria su trabajo.
   */
  useEffect(() => {
    if (!pageId) return;

    function refreshSiteState() {
      if (document.visibilityState !== "visible") return;

      void getPageForEditor(pageId!)
        .then((page) => {
          if (!page.site) return;

          setIsSitePublished(page.site.isPublished);
          setSiteDomain(page.site.domain);
          setSiteCustomDomain(page.site.customDomain);
          setSiteContactEmail(page.site.contactEmail ?? null);
          setSitePalette(page.site.palette ?? null);
          setSiteType(page.site.siteType ?? undefined);
        })
        .catch(() => {
          // Es un refresco de cortesia: si falla, se conserva lo que ya habia.
        });
    }

    document.addEventListener("visibilitychange", refreshSiteState);
    // `focus` ademas de `visibilitychange`: al volver de Configuracion con un
    // enlace del propio panel la pestana nunca se oculta, asi que
    // `visibilitychange` no se dispara y el aviso se quedaria obsoleto.
    window.addEventListener("focus", refreshSiteState);

    return () => {
      document.removeEventListener("visibilitychange", refreshSiteState);
      window.removeEventListener("focus", refreshSiteState);
    };
  }, [pageId]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.4));
  const handleResetZoom = () => setZoom(1);

  /**
   * Aplica una paleta al lienzo al instante, sin guardarla.
   *
   * El canvas ya pinta con `paletteCssVariables`, asi que adelantar el color
   * aqui es todo lo que hace falta para la vista en vivo. Guardar es una accion
   * aparte: el cliente debe poder probar colores sin tocar su web publicada.
   */
  function handlePreviewPalette(next: CustomPalette | null) {
    setSitePalette(next);

    // El preview (pestana nueva) no comparte estado de React: lee la paleta de
    // localStorage. Si no se actualizara aqui, la vista previa mostraria la
    // paleta vieja mientras el lienzo muestra la nueva.
    storePreviewPalette({ palette: next, siteType: siteType ?? null });
  }

  /**
   * Recarga el sitio tras guardar la paleta.
   *
   * Se vuelve a leer del servidor en vez de confiar en el estado local: el
   * backend MEZCLA los settings (no los reemplaza), asi que lo guardado puede no
   * ser identico a lo enviado.
   */
  async function handlePaletteSaved() {
    if (!pageId) return;

    try {
      const page = await getPageForEditor(pageId);
      if (!page.site) return;

      setSitePalette(page.site.palette ?? null);
      setSiteType(page.site.siteType ?? undefined);
      storePreviewPalette({
        palette: page.site.palette ?? null,
        siteType: page.site.siteType ?? null,
      });
    } catch (err) {
      toast.error(
        getErrorMessage(err, "La paleta se guardo, pero no se pudo recargar."),
      );
    }
  }

  /**
   * Activa una utilidad.
   *
   * `addOrganism` ya deja el bloque nuevo como seleccionado, que es lo que
   * necesita el cliente: el siguiente paso es escribir el numero de telefono en
   * el panel de propiedades, y el bloque no se ve en el canvas (vive en su
   * propia capa), asi que no habria forma de seleccionarlo a mano.
   */
  function handleAddUtility(metaName: string) {
    addOrganism(metaName);
    toast.info("Configura la utilidad en el panel de la derecha.");
  }

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

  /**
   * Publica el SITIO completo.
   *
   * Hace tres cosas en orden:
   *
   *   1. Guarda el borrador — si no, se publicaria la version anterior.
   *   2. Publica la pagina actual, para que sus bloques pasen a
   *      `publishedBlocks`.
   *   3. Enciende el interruptor del SITIO (`isPublished`), que es lo que hace
   *      que la web deje de responder 404.
   *
   * El paso 3 es el que faltaba: antes solo se hacia el 2, asi que un cliente
   * nuevo publicaba su pagina, veia "publicado" en el editor y su web seguia
   * sin existir para los visitantes.
   *
   * El orden importa: publicar el sitio primero lo dejaria en linea un instante
   * con el contenido viejo.
   */
  async function handlePublishSite() {
    if (!pageId || !activeSiteId) return;

    setIsPublishing(true);

    try {
      await saveDraftBlocks(pageId, blocks);

      try {
        await publishPage(pageId);
      } catch (error) {
        // 409 = la pagina no tenia cambios pendientes. No es un fallo: el sitio
        // puede estar sin publicar aunque sus paginas ya esten al dia.
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status !== 409) throw error;
      }

      await setSitePublished(activeSiteId, true);

      setHasUnpublished(false);
      setIsSitePublished(true);
      toast.success("Tu sitio esta en linea");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;

      // 403 = correo sin verificar. Se dice que falta, en vez del mensaje
      // generico del backend, que el cliente no puede accionar.
      if (status === 403) {
        toast.error("Confirma tu correo para publicar tu sitio.");
      } else {
        toast.error(
          getErrorMessage(err, "No pudimos publicar tu sitio. Intenta de nuevo."),
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
        handlePublishSite={handlePublishSite}
        handleSaveDraft={handleSaveDraft}
        handlePreview={handlePreview}
        publicationState={
          !isSitePublished
            ? "never-published"
            : hasUnpublished
              ? "has-changes"
              : "up-to-date"
        }
        isPublishing={isPublishing}
        siteDomain={siteDomain}
        customDomain={siteCustomDomain}
        needsEmailVerification={needsEmailVerification}
        settingsHref={`/site/${ownerSlug}/settings`}
        adminHref={`/site/${ownerSlug}/admin`}
        userFullName={user?.fullName ?? ""}
        userEmail={user?.email ?? ""}
        onLogout={() => void logout()}
      />

      {/* Aviso de sitio sin publicar. Va justo bajo la toolbar, antes de la
          barra de titulo de la pagina: es lo primero que debe ver un cliente
          que acaba de entrar y su web aun no existe para nadie. */}
      {!isSitePublished ? (
        <SiteNotPublishedBanner
          siteDomain={siteDomain}
          customDomain={siteCustomDomain}
          needsEmailVerification={needsEmailVerification}
          isPublishing={isPublishing}
          onPublish={handlePublishSite}
        />
      ) : null}

      {/* Aviso de formularios sin buzon. Va junto al de publicacion: son los dos
          "esto existe pero no funciona como esperas", y el cliente los necesita
          ver antes de dar su web por terminada. */}
      {!siteContactEmail ? (
        <ContactEmailMissingBanner
          settingsHref={`/site/${ownerSlug}/settings`}
        />
      ) : null}

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
        {/*
          Sidebar Izquierdo.

          El scroll NO vive aqui: cada panel decide el suyo. Antes el `aside`
          entero scrolleaba (`overflow-y-auto` + `p-4`), asi que al bajar por la
          lista de secciones o templates se arrastraban tambien el buscador y
          los tabs de arriba, que deben quedar siempre a la vista.

          `min-h-0` + `overflow-hidden` son lo que permite que el hijo scrollee
          en lugar del contenedor: sin `min-h-0`, un flex item no puede encoger
          por debajo del tamano de su contenido y el hijo nunca llegaria a ser
          scrolleable.
        */}
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-stone-800 bg-stone-900/50">
          {/* Tabs de modo. Van fijos arriba, fuera de cualquier area scrolleable. */}
          <div className="shrink-0 px-4 pb-3 pt-4">
            {/*
              Dos grupos y no seis tabs en fila.

              ## Por que (antes se cortaba "Utilidades" y no se veia "SEO")

              El sidebar mide 288 px y habia **seis** tabs con `flex-1` en una sola
              fila: `Páginas + Secciones + Templates + Paleta + Utilidades + SEO`
              no cabe. Como el `aside` tiene `overflow-hidden`, lo que sobraba se
              recortaba en lugar de verse.

              Encoger la letra habria cabido, pero mal: son **dos cosas distintas**
              mezcladas.

              | Grupo | Que hace |
              |---|---|
              | **Contenido** | Que editas: páginas, secciones, templates |
              | **Apariencia** | Como lo ajustas: paleta, utilidades, SEO |

              Al separarlos, cada grupo cabe en una fila sin apretarse y se
              entiende de un vistazo para que sirve cada boton.
            */}
            <div className="flex flex-col gap-2">
              {/* --- Grupo 1: contenido --- */}
              <div className="flex rounded-xl bg-stone-950/60 p-1">
                <button
                  type="button"
                  data-sidebar-mode="pages"
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
                  data-sidebar-mode="sections"
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
                  data-sidebar-mode="templates"
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

              {/* --- Grupo 2: apariencia y ajustes --- */}
              <div className="flex rounded-xl bg-stone-950/60 p-1">
                <button
                  type="button"
                  data-sidebar-mode="palette"
                  onClick={() => setSidebarMode("palette")}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                    sidebarMode === "palette"
                      ? "bg-amber-400 text-black"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  Paleta
                </button>
                <button
                  type="button"
                  data-sidebar-mode="utilities"
                  onClick={() => setSidebarMode("utilities")}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                    sidebarMode === "utilities"
                      ? "bg-amber-400 text-black"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  Utilidades
                </button>
                <button
                  type="button"
                  data-sidebar-mode="seo"
                  onClick={() => setSidebarMode("seo")}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                    sidebarMode === "seo"
                      ? "bg-amber-400 text-black"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  SEO
                </button>
              </div>
            </div>
          </div>

          {sidebarMode === "pages" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <PagesPanel
                pages={pages}
                activePageId={pageId}
                isLoading={isLoadingPages}
                onOpen={handleOpenPage}
                onDelete={setPendingDelete}
                onCreate={handleCreatePage}
              />
            </div>
          ) : sidebarMode === "sections" ? (
            /* Secciones: los tabs de vertical quedan fijos y solo scrollea la
               lista de organismos. */
            <>
              <div className="shrink-0 px-4">
                <OrganismTabs
                  active={activeTab}
                  onChange={setActiveTab}
                  counts={tabCounts}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div className="flex flex-col gap-2">
                  {/* Capacidades premium: se anuncian pero no se pueden usar
                      hasta subir de plan. Ocultarlas del todo escondería el
                      upgrade. */}
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
              </div>
            </>
          ) : sidebarMode === "templates" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <TemplateGallery
                plan={tenantPlan}
                busy={isLoadingPage}
                onApplyToCurrent={handleApplyTemplate}
                onCreatePage={handleCreatePageFromTemplate}
              />
            </div>
          ) : sidebarMode === "palette" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <PalettePanel
                siteId={activeSiteId}
                palette={sitePalette}
                siteType={siteType}
                onPreview={handlePreviewPalette}
                onSaved={handlePaletteSaved}
              />
            </div>
          ) : sidebarMode === "seo" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <SeoTagsPanel
                pageId={pageId ?? ""}
                initialTags={seoTags}
                initialTitle={seoTitle}
                initialDescription={seoDescription}
                onSaved={() => setHasUnpublished(true)}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <UtilitiesPanel
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onAdd={handleAddUtility}
                onRemove={deleteBlock}
                onSelect={setSelectedBlockId}
              />
            </div>
          )}
        </aside>

        {/* Canvas Central */}
        <Canvas
          blocks={blocks}
          pageId={pageId}
          selectedBlockId={selectedBlockId}
          viewportMode={viewportMode}
          zoom={zoom}
          onZoomChange={setZoom}
          onSelectBlock={setSelectedBlockId}
          onDeleteBlock={deleteBlock}
          onResetBlock={resetBlockProps}
          onReorderBlocks={reorderBlocksById}
          onFocusField={focusField}
          palette={sitePalette}
          siteType={siteType}
          logoUrl={siteIconUrl}
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
