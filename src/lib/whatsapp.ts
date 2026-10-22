/**
 * Enlace de WhatsApp para escribirle a un paciente.
 *
 * ## Por que un modulo propio
 *
 * El formato del telefono es el punto fragil: `wa.me` exige **solo digitos, con
 * codigo de pais y sin simbolos**. Un numero con espacios, guiones o un `+` mal
 * puesto abre WhatsApp con un error, y desde el panel eso se ve como "el boton
 * no hace nada".
 *
 * ## El dato real es sucio
 *
 * `Patient.phone` es un `String` libre: **no hay validacion de formato** en el
 * backend. En la base hay numeros como `964048872` (sin codigo de pais), y
 * tambien pueden llegar con `+56 9 1234 5678` desde el formulario publico.
 *
 * Normalizar aqui, en un solo sitio, evita que cada boton invente su propia
 * limpieza — que es como se acaba con un enlace que funciona en una pantalla y
 * no en otra.
 */

/**
 * Codigo de pais por defecto.
 *
 * **Chile (56)** porque la plataforma opera ahi. No se deduce del numero: un
 * telefono sin prefijo internacional es ambiguo (podria ser de cualquier pais),
 * y asumir el local es lo correcto para el mercado real.
 *
 * El dia que haya clientes en otro pais, esto pasa a leerse del tenant.
 */
const DEFAULT_COUNTRY_CODE = "56";

/**
 * Deja el telefono en digitos, listo para `wa.me`.
 *
 * Devuelve `null` si no queda un numero usable: es preferible **no mostrar el
 * boton** a mostrar uno que abra WhatsApp con un error.
 *
 * ## La regla del 9 chileno
 *
 * Los moviles de Chile son `+56 9 XXXX XXXX` (nueve digitos tras el pais). Pero
 * mucha gente escribe el numero local **sin el 9** (`964048872` tiene 9 digitos
 * y ya lo incluye; `64048872` seria el mismo sin el). No se intenta adivinar:
 * si tras quitar el prefijo quedan 9 digitos, se asume que el 9 ya esta.
 */
export function toWhatsAppNumber(phone: string | null): string | null {
  if (!phone) return null;

  // Solo digitos: fuera espacios, guiones, parentesis y el `+`.
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 0) return null;

  /**
   * Ya trae el codigo de pais.
   *
   * `56` + 9 digitos = 11. Es el caso de un numero guardado como
   * `+56912345678` o `56912345678`.
   */
  if (digits.length === 11 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digits;
  }

  /**
   * Numero local sin prefijo: se le añade el pais.
   *
   * Cubre los dos formatos que aparecen en la practica: 9 digitos (con el 9) y
   * 8 digitos (sin el, cuando alguien lo omitio).
   */
  if (digits.length === 9 || digits.length === 8) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  /**
   * Cualquier otra longitud se considera internacional y se respeta.
   *
   * Es el caso de un numero de otro pais guardado con su prefijo, que ya tiene
   * los digitos necesarios. Adivinar aqui seria peor que dejarlo pasar: el
   * usuario vera en el enlace si el numero es el correcto.
   */
  if (digits.length >= 10) {
    return digits;
  }

  // Demasiado corto para ser un telefono: no se muestra el boton.
  return null;
}

/**
 * Enlace `wa.me` con un mensaje opcional ya escrito.
 *
 * ## Por que `wa.me` y no `api.whatsapp.com`
 *
 * `wa.me` es el dominio corto oficial y **abre la app nativa** en movil. La otra
 * forma tiende a abrir la version web, que en un telefono con la app instalada
 * es una friccion innecesaria.
 *
 * El mensaje va en `text` y codificado: un texto con espacios o tildes sin
 * codificar rompe la URL.
 */
export function buildWhatsAppLink(
  phone: string | null,
  message?: string,
): string | null {
  const number = toWhatsAppNumber(phone);

  if (!number) return null;

  const base = `https://wa.me/${number}`;

  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
