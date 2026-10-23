import type { Metadata } from "next";

import { PublicPageClient } from "@/components/PublicPageClient";
import { SiteThemeProvider } from "@/components/SiteThemeProvider";
import {
  getPublicPageByPathOnServer,
  type PublicPageData,
} from "@/lib/api/public-page-server";
import {
  resolveDefaultProps,
  resolvePageComponents,
} from "@/lib/page-components";

/**
 * Web publica del tenant — **componente de SERVIDOR**.
 *
 * ## Por que de servidor (esto es el punto 8 / 9 etapa 1)
 *
 * Un componente cliente no puede emitir `<title>` ni `<meta description>`: esos
 * llegan al navegador por `document.title`, **despues** de descargar y ejecutar
 * JS. Google ve el HTML inicial; con el cliente veia el `<title>` del template
 * —el del panel— y no el del negocio.
 *
 * ## Las DOS mitades
 *
 * | Pieza | Donde vive |
 * |---|---|
 * | Pedir la pagina, metas, 404 | **Aqui**, en el servidor |
 * | Aviso de pago y salto a ancla | `PublicPageClient`, lo unico que necesita el navegador |
 *
 * ## De donde salen el slug y la ruta
 *
 * El proxy reescribe a `/publico/<slug>?path=/agenda` y ademas escribe el slug en
 * la cabecera `x-tenant-slug` de la peticion reescrita (`proxy.ts`). Aqui se leen
 * **los `params` y `searchParams` de la propia ruta**, que es lo que Next entrega
 * al servidor: el parametro dinamico trae el slug y el query `path` trae la
 * pagina. No hace falta mirar cabeceras.
 */

/**
 * El titulo de la pestana: el NOMBRE DEL SITIO, con la pagina detras.
 *
 *   home        -> "Clinica Dental"
 *   /agenda     -> "Agenda · Clinica Dental"
 *
 * En la home el nombre solo ya es el titulo correcto; en las internas ayuda a
 * saber donde estas cuando hay varias pestanas abiertas.
 */
function buildDocumentTitle(
  siteName: string | null | undefined,
  path: string,
): string {
  const brand = siteName?.trim() || "Sitio";

  const isHome = path === "/" || path === "";
  if (isHome) return brand;

  const segment = path.replace(/\/+$/, "").split("/").pop() ?? "";
  const pageLabel = segment
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();

  return pageLabel ? `${pageLabel} \u00b7 ${brand}` : brand;
}

/** Los tipos de los parametros de esta ruta. */
type SitePageParams = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ path?: string }>;
};

/**
 * Metas de la pagina, emitidas en el HTML que recibe el buscador.
 *
 * ## Los dos lectores
 *
 * `siteName` es **para la persona** que tiene la pestana abierta; `seoTitle` es
 * **para el buscador** (lo escribe el cliente en el panel y suele ser una frase
 * larga). Por eso el `<title>` usa el nombre del negocio y el `og:title` usa el
 * `seoTitle`: al compartir el enlace manda la frase descriptiva.
 *
 * ## Lo que NO se hace aqui
 *
 * Inventar metas cuando la pagina no existe. Sin pagina publicada no hay nada
 * que anunciar, y prometerle a Google un titulo de una pagina que da 404 es peor
 * que no decir nada.
 */
export async function generateMetadata({
  params,
  searchParams,
}: SitePageParams): Promise<Metadata> {
  const { slug } = await params;
  const { path: rawPath } = await searchParams;
  const path = rawPath || "/";

  if (!slug) return {};

  const page = await getPublicPageByPathOnServer(slug, path).catch(() => null);
  if (!page) return {};

  const title = buildDocumentTitle(page.siteName, path);
  const description = page.seoDescripcion?.trim() || undefined;

  return {
    title,
    description,
    openGraph: {
      title: page.seoTitle?.trim() || title,
      description,
      type: "website",
    },
    ...(page.seoTags && page.seoTags.length > 0
      ? { keywords: page.seoTags }
      : {}),
    ...(page.iconUrl ? { icons: { icon: page.iconUrl } } : {}),
  };
}

function PublicNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <h1 className="text-4xl font-bold text-stone-800">404</h1>
      <p className="max-w-md text-sm text-stone-500">
        No hay una página publicada en esta dirección.
      </p>
    </div>
  );
}

export default async function PublicSitePage({
  params,
  searchParams,
}: SitePageParams) {
  const { slug } = await params;
  const { path: rawPath } = await searchParams;
  const path = rawPath || "/";

  if (!slug) return <PublicNotFound />;

  let page: PublicPageData | null = null;

  try {
    page = await getPublicPageByPathOnServer(slug, path);
  } catch (err) {
    /**
     * Un fallo real (el API no responde) NO es un 404.
     *
     * Se muestra el mismo 404 al visitante —no hay otra cosa que enseñarle— pero
     * el log deja claro que fue un error de red y no una URL equivocada. Sin
     * esto, los dos casos se diagnostican igual.
     */
    console.error("[publico] error al cargar la pagina:", slug, path, err);
    return <PublicNotFound />;
  }

  if (!page) return <PublicNotFound />;

  const blocks = page.publishedBlocks ?? [];

  /**
   * Los componentes y los props por defecto se resuelven AQUI, en el servidor.
   *
   * ## Por que es lo que baja el bundle
   *
   * Si `PageRenderer` los buscara por su cuenta, tendria que importar
   * `ALL_BLOCKS_MAP`, que arrastra los **130 componentes** del design system
   * (incluidas las 50 plantillas de pagina entera). Aqui se mira **solo** los que
   * esta pagina usa y se pasan ya resueltos.
   *
   * Los componentes viajan como referencias de React Server Components, no
   * como codigo: el visitante recibe el HTML de las secciones y el JS de las que
   * de verdad son interactivas.
   */
  const components = resolvePageComponents(blocks);
  const defaultProps = resolveDefaultProps(blocks);

  return (
    <SiteThemeProvider palette={page.palette ?? null}>
      {/*
        El unico trozo de cliente: el aviso de pago (`?pago=`) y el salto a un
        ancla (`#seccion`). Los bloques ya vienen armados desde aqui, asi que el
        HTML sale con contenido y no con un "Cargando...".
      */}
      <PublicPageClient
        blocks={blocks}
        components={components}
        defaultProps={defaultProps}
        pagePath={path}
        logoUrl={page.iconUrl ?? null}
      />
    </SiteThemeProvider>
  );
}
