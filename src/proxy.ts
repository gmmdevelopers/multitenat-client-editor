import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Separacion de dominios:
 *
 *   app.<dominio>            -> panel del cliente (login, editor, settings)
 *   <slug>.<dominio>         -> web publica del tenant (solo render)
 *
 * Son dos mundos que no se mezclan: el panel exige sesion y la web publica no.
 * Antes compartian el subdominio del tenant, y eso hacia que `/` significara
 * dos cosas distintas (editor para el cliente, web para el visitante).
 */

const PUBLIC_AUTH_ROUTES = ["/login", "/register"];
const PANEL_ROUTE_PREFIXES = ["/editor", "/settings"];

const APP_SUBDOMAIN = "app";

/**
 * Subdominios que NO son tenants.
 *
 * `www` y los de servicio se reservan para la plataforma: si un cliente se
 * registrara como `www`, romperia el acceso al sitio institucional.
 */
const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "cdn",
  "static",
  "assets",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = (req.headers.get("host") || "").split(":")[0];
  const token = req.cookies.get("accessToken")?.value;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;

  // --- Clasificar el host ---
  //
  // Ojo: si `NEXT_PUBLIC_APP_DOMAIN` no llega al runtime, TODO host se trataria
  // como tenant y el panel quedaria inaccesible. Antes habia un default
  // (`multitenant.com`) que enmascaraba el problema con un dominio equivocado.
  const isLocalhostRoot =
    hostname === "localhost" || hostname === "127.0.0.1";
  const isAppHost =
    isLocalhostRoot ||
    hostname === "app.localhost" ||
    hostname.startsWith(`${APP_SUBDOMAIN}.`);

  /**
   * Slug del tenant a partir del subdominio.
   *
   * En local: `salud-bienestar.localhost` -> `salud-bienestar`.
   * En produccion: `salud-bienestar.multitenant.cl` -> `salud-bienestar`.
   *
   * Se exige EXACTAMENTE un nivel de subdominio: el apex (`multitenant.cl`) no
   * es un tenant, y `a.b.multitenant.cl` tampoco. `www` se descarta porque es
   * el sitio de la plataforma, no una organizacion.
   */
  const extractSlug = (): string | undefined => {
    if (isAppHost) return undefined;

    let candidate: string | undefined;

    if (hostname.endsWith(".localhost")) {
      candidate = hostname.slice(0, -`.localhost`.length);
    } else {
      if (!appDomain) return undefined;

      const suffix = `.${appDomain}`;
      if (!hostname.endsWith(suffix)) return undefined;

      candidate = hostname.slice(0, -suffix.length);
    }

    if (!candidate) return undefined;

    // Un solo nivel: descarta apex vacio y subdominios compuestos.
    if (candidate.includes(".")) return undefined;

    const normalized = candidate.toLowerCase();

    if (RESERVED_SLUGS.includes(normalized)) return undefined;

    return normalized;
  };

  const tenantSlug = extractSlug();

  // Host desconocido (ni panel ni tenant): devolvemos 404 en vez de renderizar
  // un sitio vacio que confundiria al visitante.
  if (!isAppHost && !tenantSlug) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const isPanelRoute = PANEL_ROUTE_PREFIXES.some((route) =>
    pathname.startsWith(route),
  );
  const isAuthRoute = PUBLIC_AUTH_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isStandaloneRoute = pathname.startsWith("/preview");

  // --- PANEL (app.*) ---
  if (isAppHost) {
    // Sin sesion, cualquier ruta del panel manda al login.
    if (!token && !isAuthRoute && !isStandaloneRoute) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // /login siempre se sirve, aunque haya token en la cookie.
    //
    // Rebortar al editor cuando la cookie existe provocaba un bucle: token
    // invalido -> /login -> /editor -> 401 -> /login... Si ya hay una sesion
    // valida, la propia pagina de login redirige al editor.
    if (isAuthRoute) {
      return NextResponse.next();
    }

    // El editor vive en /site/<slug>/editor, pero el panel es agnostico al
    // tenant: se reescribe con el slug de la organizacion activa, que el
    // navegador guarda al iniciar sesion.
    if (isPanelRoute) {
      const slug = req.cookies.get("x-org-slug")?.value;

      if (slug) {
        return NextResponse.rewrite(
          new URL(`/site/${slug}${pathname}`, req.url),
        );
      }
    }

    // `/` se deja pasar: la propia pagina resuelve el site del tenant y la
    // pagina home, y desde ahi redirige al editor con el `pageId` correcto.
    return NextResponse.next();
  }

  // --- WEB PUBLICA (tenant.*) ---
  //
  // Aqui no hay panel ni sesion: todo se renderiza como el sitio del cliente.
  // El tenant viaja en cookie porque en local el backend no siempre puede
  // resolverlo por subdominio.
  const response = NextResponse.next();

  if (tenantSlug) {
    response.cookies.set("x-tenant-slug", tenantSlug, {
      path: "/",
      sameSite: "lax",
    });
  }

  if (pathname.startsWith("/login") || isPanelRoute) {
    // El panel no vive en el dominio publico.
    return NextResponse.redirect(new URL("/", req.url));
  }

  const publicUrl = new URL(`/publico/${tenantSlug ?? "sitio"}`, req.url);
  publicUrl.searchParams.set("path", pathname);

  const rewritten = NextResponse.rewrite(publicUrl);
  if (tenantSlug) {
    rewritten.cookies.set("x-tenant-slug", tenantSlug, {
      path: "/",
      sameSite: "lax",
    });
  }

  return rewritten;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
