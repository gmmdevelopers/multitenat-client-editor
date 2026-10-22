import type { PublicBusinessData } from "@/lib/api/public-page-server";

/**
 * Datos estructurados de la web publica (`schema.org` / JSON-LD).
 *
 * ## Para que sirve
 *
 * Es lo que permite que Google muestre, **sin que el cliente toque nada**:
 *
 *   - el negocio con horario, direccion y telefono en el panel de la derecha;
 *   - el nombre, la valoracion y la foto en la busqueda;
 *   - que el asistente de Google pueda responder "a que hora abre X".
 *
 * Se emite en **todas** las paginas del sitio: el negocio es el mismo, y Google
 * acepta el `LocalBusiness` en cualquier pagina del dominio.
 *
 * ## La regla mas importante: no inventar datos
 *
 * Un JSON-LD con datos falsos es **peor que no tenerlo**: Google lo contrasta con
 * el contenido visible, y si no cuadra puede aplicar una accion manual. Por eso
 * cada propiedad se omite si el dato no existe (`null`), en vez de mandarse vacia.
 */

/** Lo minimo que hace falta para describir el negocio. */
interface BuildOptions {
  business: PublicBusinessData | null | undefined;
  /** URL absoluta de esta pagina. */
  url: string;
  /** URL absoluta del icono/logo, si el sitio tiene uno. */
  logoUrl: string | null;
  /** Una linea que describe el negocio, si la pagina no tiene descripcion. */
  fallbackDescription?: string | null;
}

/**
 * Arma el objeto JSON-LD.
 *
 * ## Por que `LocalBusiness` y no `MedicalBusiness` / `Dentist`
 *
 * Habria un tipo mas especifico por rubro (dentista, barberia, veterinaria), y
 * Google los distingue. Pero elegirlo mal es peor que usar el generico: un
 * `Dentist` en un negocio de masajes manda una senal incorrecta. `LocalBusiness`
 * es valido para todos y es el que menos se puede equivocar.
 *
 * El tipo especifico por rubro queda como mejora, cuando el `siteType` sea
 * fiable en la respuesta publica.
 */
export function buildBusinessJsonLd({
  business,
  url,
  logoUrl,
  fallbackDescription,
}: BuildOptions): Record<string, unknown> | null {
  // Sin nombre no hay nada que describir: un JSON-LD sin `name` no lo acepta
  // Google y solo añadiria ruido al `<head>`.
  const name = business?.name?.trim();
  if (!name) return null;

  const description =
    business?.description?.trim() || fallbackDescription?.trim() || undefined;

  /**
   * Se construye **solo con lo que existe**.
   *
   * `undefined` aqui no genera la propiedad al serializar, que es exactamente lo
   * que se busca. No se usan cadenas vacias en ningun caso.
   */
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url,
  };

  if (description) jsonLd.description = description;
  if (logoUrl) jsonLd.image = logoUrl;
  if (logoUrl) jsonLd.logo = logoUrl;

  const phone = business?.phone?.trim();
  if (phone) jsonLd.telephone = phone;

  /**
   * La direccion, como `PostalAddress`.
   *
   * `address` es **una sola linea** en la base ("Plaza de Armas, Santiago"), no
   * campos separados. Se manda entera en `streetAddress` en vez de intentar
   * partirla: adivinar la ciudad de un texto libre fallaria justo en los casos
   * raros, y `streetAddress` admite la direccion completa igual.
   */
  const address = business?.address?.trim();
  if (address) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "CL",
    };
  }

  /**
   * Las coordenadas, solo si estan las dos.
   *
   * El backend ya lo valida, pero se repite aqui porque este modulo es publico
   * dentro de la app y no debe depender de una guarda en otro sitio.
   */
  if (business?.latitude != null && business?.longitude != null) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: business.latitude,
      longitude: business.longitude,
    };
  }

  return jsonLd;
}

/**
 * Serializa para el `<script>`.
 *
 * ## Por que se escapa `<`
 *
 * `JSON.stringify` no escapa `<`, y un valor que contenga `</script>` cerraria la
 * etiqueta antes de tiempo: es un XSS por inyeccion de datos del cliente en el
 * HTML. Escapando `<` como `\u003c` el JSON sigue siendo valido y no puede salir
 * del `<script>`.
 *
 * Los datos los escribe el propio cliente del negocio, asi que no es un atacante
 * externo, pero es su contenido y no se confia en el para romper la pagina.
 */
export function serializeJsonLd(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
