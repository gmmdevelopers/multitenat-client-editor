import { ORGANISMS_REGISTRY } from "./editor-registry";

/**
 * Imagen que trae el design system por defecto.
 *
 * Se ofrece en el selector como punto de partida: un cliente recien registrado
 * no tiene nada subido, y sin esto veria una galeria vacia la primera vez que
 * edita un bloque.
 */
export interface DefaultImage {
  url: string;
  /** De que componente sale, para agruparlas y que se entienda el origen. */
  sourceLabel: string;
  /** Nombre de la prop de la que se extrajo (`heroImageSrc`). */
  fieldName: string;
}

/**
 * Campos cuyo valor es una imagen.
 *
 * Se filtra por el nombre del campo y no por el `control` del meta: hay metas
 * que declaran una URL de imagen con `control: 'text'` (los mas antiguos), y
 * fiarse solo del control dejaria fuera imagenes validas.
 */
function isImageField(fieldName: string, value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  // Solo URLs absolutas: un valor relativo o un color no es una imagen.
  if (!/^https?:\/\//i.test(value)) return false;

  const looksLikeImage =
    /image|src|photo|avatar|logo|banner|cover/i.test(fieldName) ||
    /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(value);

  return looksLikeImage;
}

/**
 * Catalogo de imagenes por defecto del design system.
 *
 * Se recorre el registry en vez de mantener una lista escrita a mano: si el DS
 * anade una imagen nueva a un meta, aparece sola en el selector. Una lista fija
 * se desincronizaria en la siguiente version del design system.
 *
 * Las URLs se deduplican: la misma foto se repite en varios componentes, y
 * mostrarla cinco veces en el modal no aporta nada.
 */
export function getDefaultImages(): DefaultImage[] {
  const byUrl = new Map<string, DefaultImage>();

  for (const entry of ORGANISMS_REGISTRY) {
    const label = entry.component?.displayName || entry.meta.name;

    const inspect = (
      fields: readonly { name: string; defaultValue?: unknown }[] | undefined,
    ) => {
      for (const field of fields ?? []) {
        if (!isImageField(field.name, field.defaultValue)) continue;

        const url = field.defaultValue.trim();
        if (byUrl.has(url)) continue;

        byUrl.set(url, {
          url,
          sourceLabel: label,
          fieldName: field.name,
        });
      }
    };

    inspect(entry.meta.fields);
    for (const group of entry.meta.groups ?? []) inspect(group.fields);
  }

  return [...byUrl.values()].sort((a, b) =>
    a.sourceLabel.localeCompare(b.sourceLabel),
  );
}

/** true si la URL pertenece al design system y no al bucket del tenant. */
export function isDefaultImage(url: string): boolean {
  return !url.includes("/tenants/");
}