/**
 * Resolucion de dominios propios en el PROXY.
 *
 * ## El problema
 *
 * El proxy sirve la web publica segun el host. Con `clinica.multitenant.cl` saca
 * el slug del propio nombre. Con `clinica.cl` **no hay nada que sacar**: ese
 * dominio no dice nada de nuestra plataforma.
 *
 * La respuesta la tiene el backend (`GET /api/public/domain/:host`), y aqui se
 * consulta y se **cachea**.
 *
 * ## Por que la cache es obligatoria, no un extra
 *
 * Esta funcion se ejecuta en **cada request de cada visitante** de una web de
 * cliente. Sin cache, un dominio propio añadiria una llamada al API delante de
 * *todas* las paginas, imagenes y fuentes: la web iria mas lenta que la de un
 * subdominio, justo al cliente que paga por su marca.
 */

/**
 * Cuanto vive una respuesta en memoria.
 *
 * 5 minutos: un dominio recien activado puede tardar eso en verse, y es un
 * retraso aceptable (el cambio de DNS del cliente tarda mucho mas). Mas corto
 * multiplicaria las llamadas; mas largo haria que desactivar un dominio siguiera
 * sirviendolo un rato largo.
 */
const TTL_MS = 5 * 60 * 1000;

/** Tope de la cache, para que no crezca sin limite. */
const MAX_ENTRIES = 500;

interface CacheEntry {
  /** `null` = se pregunto y no es de nadie. Se cachea tambien. */
  slug: string | null;
  expiresAt: number;
}

/**
 * La cache, **por instancia**.
 *
 * ## Por que un `Map` de modulo
 *
 * El proxy no tiene estado por request, y esta cache es del proceso. Un `Map`
 * aqui es lo mas simple que funciona.
 *
 * ## Lo que implica con varias instancias
 *
 * Cada instancia tiene la suya. No es un problema de **correccion** (todas
 * consultan la misma fuente), solo de que una instancia puede tardar hasta el
 * TTL en ver un dominio recien activado.
 */
const cache = new Map<string, CacheEntry>();

/**
 * Peticiones EN VUELO, por host.
 *
 * ## Por que hace falta
 *
 * Una pagina publica pide el HTML, varios JS y CSS **a la vez**. Sin esto, los 10
 * requests simultaneos de un mismo visitante verian la cache vacia y lanzarian
 * 10 consultas identicas al backend. Compartir la promesa deja **una**.
 */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Normaliza el host igual que el backend.
 *
 * Tiene que coincidir con `normalizeHost` del backend
 * (`custom-domain-resolver.service.ts`): si uno quita `www.` y el otro no, el
 * mismo dominio se cachearia con dos claves y una de ellas nunca acertaria.
 */
export function normalizeHost(raw: string): string | null {
  if (!raw) return null;

  let host = raw.trim().toLowerCase();
  host = host.replace(/:\d+$/, "").replace(/\.$/, "");
  host = host.replace(/^www\./, "");

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  if (host === "localhost") return null;

  return host.includes(".") ? host : null;
}

/** La base del API, sin `/api` duplicado. */
function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) return "http://localhost:3000/api";

  const withoutTrailingSlash = raw.replace(/\/+$/, "");

  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

/**
 * El slug del tenant dueño de `host`, o `null`.
 *
 * Nunca lanza: un dominio propio que falla al resolverse debe dejar pasar la
 * peticion sin slug (y el backend respondera lo que corresponda), no romper el
 * proxy entero y tumbar tambien las webs que si funcionan.
 */
export async function resolveCustomDomainSlug(
  host: string,
): Promise<string | null> {
  const normalized = normalizeHost(host);

  if (!normalized) return null;

  const cached = cache.get(normalized);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  /**
   * Se reutiliza la consulta en vuelo si existe.
   *
   * ## El detalle importante
   *
   * Si simplemente se devolviera la promesa y esa promesa acabara en error, el
   * `inFlight.delete` del `finally` correria antes de que los demas la leyeran.
   * Por eso se guarda una promesa que **no rechaza** (devuelve `null`), y el
   * borrado ocurre en el `finally` de la que se crea aqui.
   */
  const pending = inFlight.get(normalized);

  if (pending) return pending;

  const request = (async (): Promise<string | null> => {
    try {
      const response = await fetch(
        `${apiBase()}/public/domain/${encodeURIComponent(normalized)}`,
        {
          /**
           * Sin cache de Next: la gestionamos nosotros.
           *
           * `no-store` evita que el resultado de un dominio se reutilice para
           * otro (el fetch de Next infiere la clave del `fetch` segun la URL,
           * pero tambien respeta cabeceras y modos que aqui sobran).
           */
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        /**
         * Un 404 significa "no es de nadie" y **se cachea**.
         *
         * Sin esto, un dominio que nadie ha pedido (o un escaneo de bots con
         * miles de hosts) consultaria al backend en cada request. El coste de
         * cachear un 404 es que un dominio recien activado tarde hasta el TTL,
         * que es justo el mismo retraso aceptado para el caso positivo.
         */
        if (response.status === 404) {
          writeCache(normalized, null);
        }

        return null;
      }

      const data = (await response.json()) as { slug?: unknown };

      const slug =
        typeof data.slug === "string" && data.slug ? data.slug : null;

      writeCache(normalized, slug);

      return slug;
    } catch {
      /**
       * Fallo de red: NO se cachea.
       *
       * Cachear un fallo de red dejaria el dominio sin funcionar durante todo el
       * TTL aunque el backend se recuperara en el siguiente segundo.
       */
      return null;
    } finally {
      inFlight.delete(normalized);
    }
  })();

  inFlight.set(normalized, request);

  return request;
}

function writeCache(host: string, slug: string | null): void {
  /**
   * Si la cache llego al tope, se vacia entera.
   *
   * Una politica LRU real seria mas precisa, pero aqui el tamano tipico es el
   * numero de dominios propios activos (decenas). Cuando supera 500, casi todo
   * lo que hay dentro ya esta viejo.
   */
  if (cache.size >= MAX_ENTRIES) {
    cache.clear();
  }

  cache.set(host, { slug, expiresAt: Date.now() + TTL_MS });
}

/** Solo para pruebas: olvida lo cacheado. */
export function clearCustomDomainCache(): void {
  cache.clear();
  inFlight.clear();
}
