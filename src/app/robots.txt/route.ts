/**
 * `robots.txt` de la web publica del tenant.
 *
 * ## Por que es una route handler y no `app/robots.ts`
 *
 * Se intento con `robots()`, pero el `Sitemap:` tiene que ser una **URL
 * absoluta** (lo exige el protocolo; Google ignora una relativa) y esa funcion
 * **no recibe el request**, asi que no puede saber en que dominio se esta
 * sirviendo. En el subdominio de un cliente tiene que apuntar a **su** sitemap,
 * no al de la plataforma.
 *
 * ## El caso del panel
 *
 * Aqui se sirve lo correcto para **la web de un cliente**, que es lo que Google
 * tiene que indexar. El panel (`app.<dominio>`) no se bloquea desde este archivo
 * porque su proteccion real es la sesion: un `robots.txt` es una peticion, no un
 * control de acceso.
 *
 * **El panel se marca con `X-Robots-Tag: noindex, nofollow` en el proxy**
 * (`proxy.ts`, bloque `isAppHost`), que es donde el host ya esta resuelto. Una
 * cabecera viaja en cada respuesta y no depende de que el buscador haya leido
 * este archivo antes.
 */

/**
 * Rutas que NUNCA deben indexarse.
 *
 * Son rutas del panel y la ruta interna que reescribe el proxy
 * (`/publico/<slug>`): ninguna tiene contenido para un buscador.
 */
const DISALLOW = [
  "/login",
  "/editor",
  "/preview",
  "/site/",
  "/admin",
  "/settings",
  "/publico/",
  "/api/",
];

/**
 * El origen publico de esta peticion.
 *
 * `x-forwarded-host` va primero: detras del proxy, `host` es el nombre interno
 * del contenedor y la URL del sitemap seria inalcanzable desde fuera.
 */
function resolvePublicOrigin(headers: Headers, url: URL): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || headers.get("host")?.trim() || url.host;

  const protocol =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request.headers, url);

  const lines = [
    "User-Agent: *",
    "Allow: /",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
