import { listPublicPagesOnServer } from "@/lib/api/public-page-server";

/**
 * `sitemap.xml` de la web publica del tenant.
 *
 * ## Por que es una route handler y no `app/sitemap.ts`
 *
 * `sitemap()` de Next **no recibe el request**. Pero aqui hay dos datos que solo
 * estan en la peticion:
 *
 * | Dato | De donde sale |
 * |---|---|
 * | El **slug** del negocio | Del host (`clinica.multitenant.cl`) o del `?slug=` que pone el proxy |
 * | La **URL base** de las entradas | Del mismo host: el sitemap debe listar URLs **absolutas** del domino del cliente, no de la plataforma |
 *
 * Un `sitemap.ts` fijo tendria que inventarse el dominio, y con `SITE_URL` en
 * variable de entorno todos los tenants generarian el mismo sitemap apuntando al
 * mismo sitio: peor que no tener ninguno.
 *
 * ## Que se anuncia
 *
 * Solo paginas con `publishedAt`. Un sitemap con borradores o con rutas que dan
 * 404 le enseña a Google errores, y eso penaliza mas que no tener sitemap.
 */

/** Rutas que no cuentan como una pagina que se pueda anunciar. */
const IGNORED_PREFIXES = ["/login", "/editor", "/preview", "/site/", "/admin", "/api/"];

/**
 * El host publico de esta peticion.
 *
 * `x-forwarded-host` va primero: detras del proxy, `host` es el nombre interno del
 * contenedor y las URLs del sitemap serian inalcanzables desde fuera.
 */
function resolvePublicOrigin(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || headers.get("host")?.trim();

  if (!host) return null;

  // El proxy puede resolver el slug por `?slug=`; el origin no cambia por eso.
  const protocol =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  return `${protocol}://${host}`;
}

/**
 * El slug del negocio.
 *
 * En produccion llega en el **subdominio** (`clinica.multitenant.cl`); en local,
 * donde el host es `localhost`, llega en `?slug=` porque el proxy lo conserva al
 * reescribir. Si no se puede determinar, no hay sitemap: anunciar las paginas de
 * un negocio bajo el dominio de otro es un error grave de multitenant.
 */
function resolveSlug(headers: Headers, url: URL): string | null {
  /**
   * Primero la CABECERA, que es lo que escribe el proxy con el slug ya resuelto.
   *
   * Es la fuente fiable: el `Host` que llega aqui es el de la peticion interna,
   * y el `?slug=` solo existe cuando el visitante lo trae en la URL.
   */
  const fromHeader = headers.get("x-tenant-slug")?.trim();
  if (fromHeader) return fromHeader;

  const fromQuery = url.searchParams.get("slug")?.trim();
  if (fromQuery) return fromQuery;

  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostname = (forwarded || headers.get("host") || url.host).split(":")[0];

  // `clinica.multitenant.cl` -> `clinica`. El apex y `www`/`app` no son tenants.
  const [first, ...rest] = hostname.toLowerCase().split(".");
  if (rest.length < 2) return null;
  if (["www", "app", "api", "admin"].includes(first)) return null;

  return first;
}

/** Escapa un texto para XML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request.headers);
  const slug = resolveSlug(request.headers, url);

  if (!origin || !slug) {
    /**
     * Se responde un sitemap **vacio pero valido**, no un 404.
     *
     * Un 404 en `/sitemap.xml` es una senal de error para los buscadores; un
     * sitemap vacio solo dice "no hay nada que anunciar hoy".
     */
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
      { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  const pages = await listPublicPagesOnServer(slug);

  const entries = pages
    .filter(
      (page) => !IGNORED_PREFIXES.some((prefix) => page.path.startsWith(prefix)),
    )
    .map((page) => {
      const loc = `${origin}${page.path === "/" ? "" : escapeXml(page.path)}`;
      const lastmod = page.publishedAt
        ? `<lastmod>${new Date(page.publishedAt).toISOString()}</lastmod>`
        : "";

      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
