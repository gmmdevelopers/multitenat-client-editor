import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = ["/editor", "/settings"];

export function middleware(req: NextRequest) {
  console.log("middleware init");

  const { pathname } = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const token = req.cookies.get("accessToken")?.value;

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

  const isAuthRoute = PUBLIC_AUTH_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

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
    return NextResponse.redirect(new URL("/editor", req.url));
  }

  // --- REESCRITURA DE RUTA MULTI-TENANT ---
  if (!isMainDomain) {
    return NextResponse.rewrite(
      new URL(`/site/${currentHost}${pathname}`, req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
