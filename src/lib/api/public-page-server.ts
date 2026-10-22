/**
 * Datos de la web publica, leidos desde el SERVIDOR.
 *
 * ## Por que este archivo esta aparte de `lib/api/pages.ts`
 *
 * `pages.ts` importa `./client`, que monta `axios` con interceptores de
 * `localStorage` y cookies. Ese modulo esta pensado para el navegador:
 *
 *   - en el servidor `typeof window === "undefined"`, asi que **no lee la cookie
 *     `x-tenant-slug`** y el backend no sabe de que negocio es la pagina;
 *   - arrastra `localStorage` a un contexto donde no existe.
 *
 * Meter el `fetch` de servidor alli obligaria a todo el que importe `pages.ts`
 * (el editor entero) a convivir con codigo de servidor. Aqui, en cambio, solo
 * entra quien renderiza la pagina publica.
 *
 * ## El tenant va por CABECERA, no por cookie
 *
 * En el navegador el slug se resolvia a medias entre el `?slug=` de la URL y la
 * cookie que escribe el proxy. En el servidor no hay ninguna de las dos cosas
 * fiables: el slug llega como **parametro de ruta** (`/publico/[slug]`) y se
 * manda explicito en `x-tenant-slug`, que es el mecanismo previsto para esto.
 */

import type { CustomPalette } from "@multitenant/design-system";

import type { BlockInstance } from "@/types/editor-state";

/**
 * Los datos publicos del negocio, para los datos estructurados.
 *
 * Todos pueden ser `null`: un negocio recien creado no tiene direccion ni
 * telefono. El que arma el JSON-LD **omite** las propiedades vacias en vez de
 * mandar cadenas vacias, que Google trata como datos invalidos.
 */
export interface PublicBusinessData {
  name: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Lo que devuelve el endpoint publico de una pagina. */
export interface PublicPageData {
  id: string;
  path: string;
  title: string;
  seoTitle: string;
  seoDescripcion: string;
  /** Etiquetas del cliente (`<meta name="keywords">`). */
  seoTags?: string[];
  publishedBlocks: BlockInstance[];
  publishedAt: string | null;
  palette?: Partial<CustomPalette> | null;
  iconUrl?: string | null;
  siteName?: string | null;
  /** Datos del negocio para el `JSON-LD`. */
  business?: PublicBusinessData | null;
}

/**
 * La base del API para el servidor.
 *
 * `API_URL_INTERNAL` **no** lleva el prefijo `NEXT_PUBLIC_`: no se incrusta en el
 * bundle del navegador a proposito. En produccion apunta al nombre interno del
 * servicio del backend (ver `PENDIENTES-SERVIDOR.md`).
 *
 * El respaldo a `NEXT_PUBLIC_API_URL` es solo para no romper en local si la
 * variable no esta: en produccion, depender del respaldo significa que el
 * contenedor intenta salir a internet para hablar con su propio backend.
 */
function resolveServerApiBaseUrl(): string {
  const raw = (
    process.env.API_URL_INTERNAL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).trim();

  const base = raw || "http://localhost:3000/api";
  const withoutTrailingSlash = base.replace(/\/+$/, "");

  // Mismo criterio que el cliente: el backend vive bajo `/api`.
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

/** Una ruta publicada del sitio, con su fecha de publicacion. */
export interface PublicPageEntry {
  path: string;
  publishedAt: string | null;
}

/**
 * Las rutas publicadas del sitio, para el `sitemap.xml`.
 *
 * ## Por que devuelve `[]` y no lanza
 *
 * Un sitemap con una lista vacia es valido: solo dice "hoy no hay paginas que
 * anunciar". Fallar aqui romperia el `sitemap.xml` entero por una peticion, y
 * los buscadores volverian a pedirlo y encontrarian el mismo 500. Se prefiere
 * una respuesta vacia y el error en los logs.
 *
 * (La pagina en si **si** distingue el fallo del 404: ahi un error vacio
 * significaria "esta pagina no existe", que es una mentira distinta.)
 */
export async function listPublicPagesOnServer(
  slug: string,
): Promise<PublicPageEntry[]> {
  try {
    const response = await fetch(
      `${resolveServerApiBaseUrl()}/pages/public/pages`,
      {
        headers: { "x-tenant-slug": slug, Accept: "application/json" },
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) return [];

    const body = (await response.json()) as { pages?: PublicPageEntry[] };

    return body.pages ?? [];
  } catch (err) {
    console.error("[publico] no se pudo listar las paginas:", slug, err);
    return [];
  }
}

/**
 * Pide una pagina publicada por su ruta.
 *
 * @param slug  El negocio, tal como viene en la ruta (`/publico/[slug]`).
 * @param path  La ruta de la pagina dentro del sitio (`/`, `/agenda`...).
 *
 * @returns La pagina, o `null` si no existe o no esta publicada.
 *
 * ## Por que devuelve `null` y no lanza
 *
 * "No hay pagina publicada" y "el API no responde" son cosas distintas, y quien
 * llama las trata igual en pantalla (404) pero **no** en los logs. Aqui se
 * distingue: un 404 del API es `null` (caso normal, el visitante se equivoco de
 * URL); cualquier otro fallo **si** se lanza, porque es un problema real que hay
 * que ver en los logs y no un 404 merecido.
 */
export async function getPublicPageByPathOnServer(
  slug: string,
  path: string,
): Promise<PublicPageData | null> {
  const query = new URLSearchParams({ path });

  const response = await fetch(
    `${resolveServerApiBaseUrl()}/pages/public/by-path?${query.toString()}`,
    {
      headers: {
        // El tenant, explicito. Es lo que en el navegador hacia la cookie.
        "x-tenant-slug": slug,
        Accept: "application/json",
      },
      /**
       * Cache corta.
       *
       * La web de un negocio no cambia cada segundo, pero si al publicar: 60 s
       * da un HTML instantaneo sin dejar al cliente viendo una version vieja por
       * mucho tiempo. Ademas evita un viaje al backend por cada visita.
       */
      next: { revalidate: 60 },
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar la pagina publica (${response.status}) de "${slug}${path}".`,
    );
  }

  return (await response.json()) as PublicPageData;
}
