import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = ["/editor", "/settings"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const token = req.cookies.get("accessToken")?.value;

  console.log("--> Host de la petición:", req.headers.get("host"));
  console.log("--> Token detectado en proxy:", token); // llega undefined

  // 1. Extraer el host sin el puerto (ej: "salud-bienestar.localhost")
  const hostWithoutPort = hostname.split(":")[0];

  // 2. Definir si es el dominio raíz absoluto
  const isLocalhostRoot =
    hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1";
  const isMainDomainRoot =
    hostWithoutPort ===
    (process.env.NEXT_PUBLIC_APP_DOMAIN || "multitenant.com");
  const isMainDomain = isLocalhostRoot || isMainDomainRoot;

  // 3. Extraer el subdominio/slug (ej: "salud-bienestar")
  const currentHost = hostWithoutPort
    .replace(".localhost", "")
    .replace(`.${process.env.NEXT_PUBLIC_APP_DOMAIN}`, "");

  // /preview vive fuera del grupo /site/[slug], asi que queda exenta del
  // rewrite multi-tenant: si no, en un subdominio se convertiria en
  // /site/<slug>/preview, que no existe.
  const isStandaloneRoute = pathname.startsWith("/preview");

  const isAuthRoute = PUBLIC_AUTH_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isProtectedRoute =
    isStandaloneRoute ||
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  // --- REGLAS DE REDIRECCIÓN Y AUTENTICACIÓN ---

  // Si intenta acceder a ruta protegida sin token
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
  console.log(isAuthRoute && token);

  // Si intenta acceder a /login teniendo ya token
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  console.log({
    hostname,
    hostWithoutPort,
    isMainDomain,
    currentHost,
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    rewriteTo: `/site/${currentHost}${pathname}`,
  });

  // --- REESCRITURA DE RUTA MULTI-TENANT ---
  //
  // El grupo /site/[slug] NO es la web pública del tenant: es el panel del
  // editor. Si reescribimos la raiz "/" a /site/<slug>/ caemos en una ruta
  // inexistente (solo existe /site/[slug]/editor y /settings) y el usuario
  // ve un 404 justo despues del login.
  //
  // Por eso solo reescribimos rutas que realmente cuelgan del panel.
  const PANEL_ROUTE_PREFIXES = ["/editor", "/settings"];
  const isPanelRoute = PANEL_ROUTE_PREFIXES.some((route) =>
    pathname.startsWith(route),
  );

  if (!isMainDomain && !isAuthRoute && !isStandaloneRoute && isPanelRoute) {
    return NextResponse.rewrite(
      new URL(`/site/${currentHost}${pathname}`, req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
