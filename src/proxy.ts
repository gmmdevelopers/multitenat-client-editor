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

const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/verify-email"];
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
   * Slug del tenant a partir del SUBDOMINIO (y solo del subdominio).
   *
   * En local: `salud-bienestar.localhost` -> `salud-bienestar`.
   * En produccion: `salud-bienestar.multitenant.cl` -> `salud-bienestar`.
   *
   * Se exige EXACTAMENTE un nivel de subdominio: el apex (`multitenant.cl`) no
   * es un tenant, y `a.b.multitenant.cl` tampoco. `www` se descarta porque es
   * el sitio de la plataforma, no una organizacion.
   *
   * Se llama `...FromHost` a proposito: el respaldo por `?slug=` vive fuera de
   * esta funcion, para que quede claro que aqui NO se mira la query.
   */
  const extractSlugFromHost = (): string | undefined => {
    if (isAppHost) return undefined;

    /**
     * Una IP **nunca** es un host de tenant.
     *
     * Sin esto, `192.168.1.197` se interpretaba como subdominio: la ultima
     * parte parece un dominio y el candidato salia `192.168.1` -> slug `192`.
     * El backend respondia "Tenant slug 192 was not found", y encima esa
     * resolucion **ganaba** al `?slug=` legitimo, asi que el respaldo por query
     * no llegaba a usarse.
     *
     * Es el caso de la app movil: la WebView llega por la IP del Mac (no puede
     * usar `*.localhost`, que iOS no resuelve) y el tenant viaja por query.
     */
    const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    if (isIpAddress) return undefined;

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

  /**
   * Slug por QUERY, como respaldo.
   *
   * ## Por que hace falta
   *
   * La app movil abre la web del tenant en una `WebView`, y le pasa la URL que
   * compone el backend (`http://<host>:3001`). Pero en un emulador de Android o
   * en un telefono fisico **no hay subdominio**: se llega por `10.0.2.2` o por
   * la IP del Mac, y ninguna de las dos lleva el slug. Sin subdominio, el proxy
   * no sabe que tenant servir.
   *
   * Y `*.localhost` tampoco sirve ahi: el `WKWebView` de iOS no lo resuelve
   * (si el navegador del sistema), asi que la app recibia "Site not found"
   * aunque la misma URL abriera bien en Safari.
   *
   * ## Por que es seguro
   *
   * El slug no es un secreto: la web publica la sirve el proxy a cualquier
   * visitante que use el subdominio. Aceptarlo por query no expone nada que no
   * estuviera ya accesible. Y **solo se mira si el host no resolvio tenant**, asi
   * que en produccion (con subdominio o dominio propio) no interviene.
   */
  const slugFromQuery = req.nextUrl.searchParams.get("slug")?.trim();

  /**
   * Slug que resuelve el HOST, guardado aparte.
   *
   * Se guarda en una variable y no se llama dos veces a `extractSlugFromHost()`
   * porque abajo hay que distinguir "lo resolvio el host" de "lo trajo la
   * query": si viniera de la query, hay que invalidar la cookie para que una
   * copia vieja no la contradiga.
   */
  const slugFromHost = extractSlugFromHost();

  const tenantSlug = slugFromHost ?? slugFromQuery ?? undefined;

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
    //
    // `/verify-email` tambien pasa: el enlace del correo se puede abrir en un
    // dispositivo donde el cliente no tiene sesion, y ahi la verificacion debe
    // funcionar igual. El token del enlace ES la credencial.
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

  /**
   * Se INVALIDA la cookie cuando el slug llega por query.
   *
   * ## Por que
   *
   * Una cookie vieja **no se puede corregir escribiendo encima**: el cliente la
   * lee **antes** de que el proxy responda. Si quedo envenenada (el proxy
   * extraia `192` del host cuando el dominio era una IP), la app la reenvia como
   * header en cada peticion y la API resuelve el tenant equivocado: **404 "Tenant
   * slug 192 was not found"** aunque la URL ya sea correcta.
   *
   * Sobrescribirla no basta porque el navegador mantiene la copia vieja hasta
   * que expira o alguien la cambia de verdad. Borrarla obliga a reescribirla con
   * el valor nuevo en la misma respuesta.
   *
   * Y se hace **solo** en el caso de `?slug=`: es el unico en que el tenant no
   * va en el host, asi que es donde una cookie vieja puede contradecir a la URL.
   * En el subdominio, el host manda y la cookie se escribe encima sin problema.
   */
  if (!slugFromHost && slugFromQuery && tenantSlug) {
    response.cookies.set("x-tenant-slug", tenantSlug, {
      path: "/",
      sameSite: "lax",
      // `maxAge: 0` la marca para borrar en el navegador, y el `set` de abajo la
      // deja con el valor correcto. Sin el borrado explicito, el navegador puede
      // conservar el valor anterior.
      maxAge: 0,
    });

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

  /**
   * El `?slug=` se CONSERVA en la URL reescrita.
   *
   * ## Por que hace falta
   *
   * La pagina publica lee el slug de `window.location.search` para mandarlo como
   * cabecera a la API (`buildSlugHeaders` en `lib/api/pages.ts`). Pero al
   * reescribir a `/publico/<slug>?path=...` el slug se **perdia**: quedaba solo
   * `?path=/`, el cliente no encontraba el parametro y **no mandaba cabecera**.
   *
   * Entonces la peticion caia a la **cookie**, que puede ser de una visita
   * anterior (`x-tenant-slug=192`, de cuando el host era una IP). El navegador
   * funcionaba porque ahi la cookie ya era correcta; la WebView, con la MISMA
   * URL, daba 404.
   *
   * Conservandolo, la pagina siempre tiene la fuente fiable (la URL de la
   * peticion) y deja de depender de una cookie que puede estar obsoleta.
   */
  if (slugFromQuery) {
    publicUrl.searchParams.set("slug", slugFromQuery);
  }

  const rewritten = NextResponse.rewrite(publicUrl);

  if (tenantSlug) {
    /**
     * El slug viaja tambien en una CABECERA de la peticion reescrita.
     *
     * ## Por que, si ya va en la cookie
     *
     * Porque la pagina publica es un **server component**: se renderiza en el
     * servidor, donde `document.cookie` NO existe. El cliente de la API lee la
     * cookie para reenviarla como header, asi que en el servidor no tiene de
     * donde sacarla y la peticion llega **sin slug**.
     *
     * Y con un host que no resuelve tenant (la IP del Mac, en la app movil), el
     * backend responde "Tenant slug ... was not found". El navegador funcionaba
     * porque ahi si hay cookie de cliente; la WebView, mismo URL, daba 404.
     *
     * Con esto el slug llega a la API **desde el servidor**, sin depender de
     * que exista un navegador.
     */
    rewritten.headers.set("x-tenant-slug", tenantSlug);

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
