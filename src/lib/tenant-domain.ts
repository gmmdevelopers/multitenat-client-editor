/**
 * Dominio de la plataforma y composicion de URLs de tenant.
 *
 * Existe para no repetir la cadena del dominio en cada pantalla: ya se
 * desincronizo una vez (`multitenant.com` en el onboarding y el layout, y
 * `multitenant.cl` en configuracion), asi que el cliente veia dos dominios
 * distintos para el mismo sitio.
 *
 * `NEXT_PUBLIC_APP_DOMAIN` es la fuente de verdad, y es la MISMA variable que
 * usa el proxy (`src/proxy.ts`) para extraer el slug del subdominio. Si aqui
 * hubiera un valor distinto, la URL que se muestra al cliente no resolveria.
 */
export const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || "multitenant.cl";

/**
 * Compone el dominio completo de un tenant a partir de su slug.
 *
 * En local se usa `.localhost`, que es lo que resuelve el navegador: un
 * `mi-negocio.multitenant.cl` en desarrollo apuntaria al servidor real y no a
 * la maquina del desarrollador.
 */
export function buildTenantDomain(slug: string): string {
  if (!slug) return APP_DOMAIN;

  return `${slug}.${APP_DOMAIN}`;
}

/** URL completa con protocolo, para enlaces que se abren en otra pestaña. */
export function buildTenantUrl(slug: string): string {
  const isLocal = APP_DOMAIN.endsWith(".test") || APP_DOMAIN === "localhost";

  return `${isLocal ? "http" : "https"}://${buildTenantDomain(slug)}`;
}

/**
 * Limpia lo que el usuario escriba en el campo de subdominio.
 *
 * El campo pide SOLO el subdominio, pero la gente pega la URL completa o escribe
 * el dominio entero. Guardar eso rompe el proxy, que espera un unico nivel
 * (`massajes`), no `massajes.multitenant.cl`.
 *
 *   `Massajes`                     -> `massajes`
 *   `massajes.multitenant.cl`      -> `massajes`
 *   `https://massajes.multi.../`   -> `massajes`
 *   `mi negocio`                   -> `mi-negocio`
 */
export function normalizeSubdomain(raw: string): string {
  let value = raw.trim().toLowerCase();

  // Quita el protocolo si lo pegaron (`https://massajes...`).
  value = value.replace(/^https?:\/\//, "");

  // Quita todo lo que venga despues del primer `/` (paths, query).
  value = value.split("/")[0] ?? "";

  // Quita un puerto si lo hubiera (`massajes:3000`).
  value = value.split(":")[0] ?? "";

  // Quita el dominio de la plataforma si escribieron el host completo.
  if (value.endsWith(APP_DOMAIN)) {
    value = value.slice(0, -APP_DOMAIN.length).replace(/\.$/, "");
  }

  // Quita un `.localhost` en desarrollo.
  if (value.endsWith(".localhost")) {
    value = value.slice(0, -".localhost".length);
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * Valida un subdominio ya normalizado.
 *
 * Devuelve el mensaje de error, o `null` si es valido. Un subdominio mal formado
 * no da error en el backend, simplemente deja un sitio que el proxy nunca
 * resuelve: el cliente ve un 404 sin saber por que.
 */
export function validateSubdomain(subdomain: string): string | null {
  if (!subdomain) return "El subdominio es obligatorio.";

  if (subdomain.length < 3) {
    return "Debe tener al menos 3 caracteres.";
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
    return "Solo letras minusculas, numeros y guiones (sin empezar ni terminar en guion).";
  }

  return null;
}
