/**
 * Optimizacion de imagenes con las transformaciones de Cloudflare.
 *
 * SE APLICA SOLO EN LA WEB PUBLICA.
 *
 *   En el editor las imagenes se muestran tal cual: el objetivo ahi es elegir,
 *   no servir trafico, y una transformacion por cada miniatura anadiria latencia
 *   sin beneficio. Ademas, el editor va con sesion y lo usa una persona; la web
 *   publica la ve cada visitante.
 *
 * FORMATO: se usa `format=auto` y NO `format=webp`.
 *   `auto` sirve WebP, o AVIF si el navegador lo soporta (que es mas ligero
 *   todavia), y cae al original si no soporta ninguno. Forzar `webp` daria un
 *   resultado peor a los navegadores modernos y no mejoraria a los antiguos.
 *
 * COMO FUNCIONA LA URL: la transformacion se pide al dominio de la ZONA, no al
 * bucket. El origen (`media.multitenant.cl/...`) viaja al final:
 *
 *   https://media.multitenant.cl/cdn-cgi/image/width=1600,format=auto/https://media.multitenant.cl/tenants/x/foto.jpg
 *
 * Por eso `media.multitenant.cl` tiene que ser un dominio propio de la zona de
 * Cloudflare: sobre el dominio de desarrollo (`pub-xxxx.r2.dev`) las
 * transformaciones NO funcionan.
 */

/**
 * Anchos con los que se sirve una imagen.
 *
 * `1600` es el ancho de render mas grande: el contenedor del design system mide
 * `78rem` (~1248 px), asi que 1600 cubre tambien pantallas de alta densidad con
 * margen. `800` y `400` cubren tablet y movil.
 *
 * Servir siempre 1600 desperdiciaria ancho de banda en movil; servir siempre 400
 * dejaria la imagen borrosa en escritorio.
 */
const DEFAULT_WIDTHS = [400, 800, 1600] as const;

/** Calidad de compresion. 82 es el punto donde no se aprecia perdida visible. */
const DEFAULT_QUALITY = 82;

/**
 * true si las transformaciones estan habilitadas y se deben usar.
 *
 * Es un interruptor EXPLICITO, y no una deteccion automatica, por un motivo
 * concreto: si la zona tiene las transformaciones desactivadas, la ruta
 * `/cdn-cgi/image/...` devuelve un **404 con HTML**, no la imagen original. Con
 * el interruptor apagado se sirven las URLs directas y la web del cliente se ve
 * bien; con el encendido por error, TODAS sus imagenes se rompen.
 *
 * El valor por defecto es `false` a proposito: encenderlo exige haber
 * comprobado antes que la transformacion responde.
 *
 * Para comprobarlo:
 *   curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
 *     "https://media.multitenant.cl/cdn-cgi/image/width=200/https://media.multitenant.cl/tenants/<algo>.jpg"
 *
 * Debe devolver 200 con un `image/*`. Si devuelve 404 y `text/html`, la
 * transformacion NO esta habilitada todavia.
 */
function transformationsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_IMAGE_TRANSFORMS_ENABLED === "true";
}

/** true si la URL ya pasa por las transformaciones. */
function isAlreadyTransformed(url: string): boolean {
  return url.includes("/cdn-cgi/image/");
}

/**
 * true si la URL es de una imagen que podemos transformar.
 *
 * Solo las del bucket propio: una URL externa (Unsplash, un CDN ajeno) no esta
 * en la zona de Cloudflare y `/cdn-cgi/image` responderia 404. Esas se dejan
 * como estan.
 */
export function canTransform(url: string): boolean {
  if (!transformationsEnabled()) return false;

  const base = process.env.NEXT_PUBLIC_IMAGE_TRANSFORM_BASE?.trim();
  if (!base) return false;

  if (!url.startsWith("http")) return false;
  if (isAlreadyTransformed(url)) return false;

  return url.startsWith(base);
}

/**
 * Construye la URL que sirve la imagen transformada a un ancho concreto.
 *
 * Devuelve la URL original si no se puede transformar (imagen externa, sin
 * configuracion): es preferible servir el original a devolver una URL que daria
 * 404.
 *
 *   `width` se omite si es `undefined`, para poder pedir "solo convertir a
 *   WebP" sin fijar tamano.
 */
export function buildTransformedUrl(
  url: string,
  options: { width?: number; quality?: number; height?: number } = {},
): string {
  if (!canTransform(url)) return url;

  const base = process.env.NEXT_PUBLIC_IMAGE_TRANSFORM_BASE!.trim().replace(
    /\/+$/,
    "",
  );

  const parts = [`quality=${options.quality ?? DEFAULT_QUALITY}`, "format=auto"];

  if (options.width) parts.push(`width=${options.width}`);
  if (options.height) parts.push(`height=${options.height}`);

  // `onerror=redirect` deja que Cloudflare sirva el original si la
  // transformacion falla (imagen corrupta, formato no soportado). Sin esto, un
  // archivo problematico dejaria un hueco roto en la web del cliente.
  parts.push("onerror=redirect");

  return `${base}/cdn-cgi/image/${parts.join(",")}/${url}`;
}

/**
 * Juego de URLs para `srcset`, con un candidato por ancho.
 *
 * Permite al navegador elegir la resolucion segun su pantalla, en vez de
 * descargar siempre la mas grande.
 */
export function buildSrcSet(
  url: string,
  widths: readonly number[] = DEFAULT_WIDTHS,
): string | undefined {
  if (!canTransform(url)) return undefined;

  const entries = widths
    .slice()
    .sort((a, b) => a - b)
    .map((width) => `${buildTransformedUrl(url, { width })} ${width}w`);

  return entries.join(", ");
}

/**
 * Aplica las transformaciones a las props de un bloque, en una sola pasada.
 *
 * Se recorre el objeto entero en vez de tocar solo las tres props conocidas
 * (`heroImageSrc`, `imageSrc`, `backgroundImageSrc`): los componentes del design
 * system pueden anadir imagenes nuevas, y ademas hay arrays con imagenes dentro
 * (`metrics`, por ejemplo). Detectar "esto es una URL de imagen del bucket"
 * cubre los casos presentes y los futuros sin mantener una lista.
 *
 * NO se anade `srcset` aqui: eso exige cambiar el componente que pinta el
 * `<img>`, y los del design system no lo aceptan. El ancho lo fija la
 * transformacion, no el navegador.
 */
export function transformImagesInProps<T extends Record<string, unknown>>(
  props: T,
  options: { width?: number } = {},
): T {
  const transformValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return canTransform(value)
        ? buildTransformedUrl(value, { width: options.width })
        : value;
    }

    // Arrays con imagenes dentro (`metrics`, `team`, `gallery`...).
    if (Array.isArray(value)) {
      return value.map((item) => transformValue(item));
    }

    // Objetos anidados.
    if (value && typeof value === "object") {
      const next: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        next[key] = transformValue(nested);
      }
      return next;
    }

    return value;
  };

  return transformValue(props) as T;
}