import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Separacion de dominios (backlog §9):
 *
 *   app.<dominio>            -> panel del cliente (login, editor, settings)
 *
 * ## La web publica YA NO se renderiza aqui
 *
 * Un host de tenant (subdominio o dominio propio) que llegue aqui es un
 * **error de reparto** (Caddy no lo mando a `web-viewer`), no algo que servir.
 * Se responde 404 con un mensaje claro en vez de renderizar una pagina vacia
 * que confundiria al visitante.
 */

const APP_SUBDOMAIN = "app";

/**
 * Rutas que se reescriben a `/site/<slug>/...`.
 *
 * El editor y los ajustes viven bajo el slug de la organizacion activa, que el
 * navegador guarda al iniciar sesion.
 */
const PANEL_ROUTE_PREFIXES = ["/editor", "/settings"];

export async function proxy(req: NextRequest) {
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
  const isLocalhostApp = hostname === "app.localhost";

  /**
   * `app.<APP_DOMAIN>` no entra aqui A PROPOSITO.
   *
   * ## Por que no vale `hostname.startsWith("app.")`
   *
   * Antes era asi, y trataba como panel **cualquier** dominio de cliente que
   * empezara por `app.`: `app.clinica.cl` —un dominio perfectamente valido—
   * recibia el flujo del panel, sin sesion mandaba a `/login` de la plataforma y
   * su web publica nunca se servia. El cliente ponia los nameservers, esperaba
   * 24 h, y su dominio no funcionaba sin ninguna pista de por que.
   *
   * Ahora se compara con el dominio de la plataforma de verdad. Si
   * `NEXT_PUBLIC_APP_DOMAIN` no llega, solo `app.localhost` se considera panel:
   * es mejor no reconocer el panel en un entorno mal configurado que comerse los
   * dominios de los clientes.
   */
  const isAppHost =
    isLocalhostRoot ||
    isLocalhostApp ||
    (Boolean(appDomain) && hostname === `${APP_SUBDOMAIN}.${appDomain}`);

  const isPanelRoute = PANEL_ROUTE_PREFIXES.some((route) =>
    pathname.startsWith(route),
  );

  // --- PANEL (app.*) ---
  if (isAppHost) {
    /**
     * El panel NUNCA se indexa.
     *
     * ## Por que con una cabecera y no con `robots.txt`
     *
     * `robots.txt` es **una peticion mas**: solo lo respeta un buscador que lo
     * pida primero, y no impide indexar una URL concreta que alguien enlace.
     * `X-Robots-Tag: noindex` viaja con **cada respuesta**, asi que vale para
     * cualquier pagina, aunque nadie haya leido el `robots.txt`.
     *
     * ## Por que aqui y no en la pagina
     *
     * El panel no tiene un `robots.txt` propio, y aunque lo tuviera seria una
     * peticion: hay rutas (`/login`) que pueden aparecer en un enlace externo.
     * El proxy es el unico sitio donde `isAppHost` ya esta resuelto.
     *
     * ## La respuesta que se indexaba
     *
     * Sin esto, Google podia guardar `/login` (publica, sin sesion) y
     * `/verify-email` como paginas del sitio, y ademas **redirects**: un 308
     * conserva las cabeceras del destino. Por eso la marca va tambien en la
     * redireccion al login, no solo en `next()`.
     */
    const noIndex = (response: NextResponse) => {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    };

    /**
     * Sin sesion, cualquier ruta del panel manda al login.
     *
     * El panel no tiene rutas publicas: el anterior `isAuthRoute` (/login,
     * /register) y `/preview` existian porque esta misma app servia la web del
     * tenant. Con la web publica en `web-viewer`, aqui todo exige sesion salvo
     * el propio login: si no, una ruta con contenido quedaria accesible sin
     * credenciales. `verify-email` no se ve afectado porque su enlace lleva el
     * token, que es la credencial real, y cae en `/login` igual.
     */
    if (!token && pathname !== "/login") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return noIndex(NextResponse.redirect(loginUrl));
    }

    // /login siempre se sirve, aunque haya token en la cookie.
    //
    // Rebortar al editor cuando la cookie existe provocaba un bucle: token
    // invalido -> /login -> /editor -> 401 -> /login... Si ya hay una sesion
    // valida, la propia pagina de login redirige al editor.
    if (pathname === "/login") {
      return noIndex(NextResponse.next());
    }

    // El editor vive en /site/<slug>/editor, pero el panel es agnostico al
    // tenant: se reescribe con el slug de la organizacion activa, que el
    // navegador guarda al iniciar sesion.
    if (isPanelRoute) {
      const slug = req.cookies.get("x-org-slug")?.value;

      if (slug) {
        return noIndex(
          NextResponse.rewrite(new URL(`/site/${slug}${pathname}`, req.url)),
        );
      }
    }

    // `/` se deja pasar: la propia pagina resuelve el site del tenant y la
    // pagina home, y desde ahi redirige al editor con el `pageId` correcto.
    return noIndex(NextResponse.next());
  }

  // --- NO ES EL PANEL ---
  //
  // El panel es lo UNICO que sirve esta app. La web del tenant (por subdominio o
  // por dominio propio) la sirve `web-viewer`: si una peticion de ese tipo llega
  // aqui, Caddy la esta mandando al contenedor equivocado.
  //
  // Devolver 404 es mejor que renderizar algo a medias: el sintoma apunta al
  // reparto de hosts en vez de parecer un problema de contenido del sitio.
  return new NextResponse(
    "Este dominio no se sirve desde el panel. Revisa el reparto de hosts.",
    { status: 404 },
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
