/**
 * Anclas de los bloques de una pagina.
 *
 * ## Por que existe este archivo
 *
 * El enlace "ir a esta seccion" que el cliente elige en las propiedades de un
 * boton tiene que apuntar a **un elemento que exista**. Antes la regla que armaba
 * el `href` (`#<metaName>-<id corto>`) vivia SOLO en el panel de propiedades: el
 * renderizador nunca puso ese `id` en el bloque, asi que el enlace cambiaba la
 * URL (`.../preview#appointmentscheduler-1791`) y el navegador no tenia a que
 * desplazarse. La URL cambiaba y la pantalla no se movia.
 *
 * Tener una unica funcion para **generar** el ancla y para **poner** el `id` es
 * lo que evita que vuelvan a desincronizarse.
 */

/**
 * El ancla de un bloque: `#appointmentscheduler-1791`.
 *
 * `metaName` identifica el TIPO de seccion y el id corto la INSTANCIA: una
 * pagina puede tener dos bloques del mismo tipo (dos agendas, dos listas de
 * servicios) y cada uno necesita su ancla propia.
 *
 * El id va en minusculas para que el `href` no dependa de mayusculas: el
 * navegador compara los fragmentos tal cual, y `#Agenda-1791` no encontraría
 * `id="agenda-1791"`.
 */
export function blockAnchor(block: { metaName: string; id: string }): string {
  return `${block.metaName.toLowerCase()}-${block.id.slice(0, 4)}`;
}

/** El `href` completo que se guarda en el boton: `#agenda-1791`. */
export function blockAnchorHref(block: {
  metaName: string;
  id: string;
}): string {
  return `#${blockAnchor(block)}`;
}

/**
 * El `id` del DOM para un fragmento de URL, sin el `#`.
 *
 * Acepta `#agenda-1791` o `agenda-1791` porque no siempre se sabe de donde viene
 * el valor guardado (un boton viejo pudo guardarlo con o sin almohadilla).
 */
export function anchorIdFromHash(hash: string): string {
  return hash.replace(/^#/, "");
}
