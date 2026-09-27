import type { BlockInstance } from "@/types/editor-state";

/**
 * Resuelve a que PROPIEDAD de un bloque corresponde el elemento en el que el
 * cliente hizo click en el canvas.
 *
 * Por que existe:
 *   Los componentes del design system son cajas negras. `MedicalHeroSection`
 *   recibe `title` y lo pinta en un `<h1>`, pero no sabe que esta dentro de un
 *   editor, asi que no puede exponer "este texto es la prop `title`". Hay que
 *   deducirlo desde fuera.
 *
 * Como se deduce (en orden de fiabilidad):
 *
 *   1. `data-field`: un atributo que el componente puede poner si quiere
 *      declararlo explicitamente. Es la via exacta, pero hoy ningun componente
 *      del design system lo usa.
 *
 *   2. Por el TEXTO: se lee el texto del elemento clickeado y se busca que prop
 *      del bloque tiene exactamente ese valor. Funciona sin tocar el design
 *      system, y es fiable porque el cliente hace click sobre lo que VE, que es
 *      justo el valor de la prop.
 *
 *   3. Por `src`/`href`: para imagenes y enlaces, cuyo contenido no es texto.
 *
 * Los textos duplicados (dos props con el mismo valor) se resuelven por
 * cercania: se prefiere la prop cuyo nombre comparte palabras con el elemento
 * (`heroImageSrc` gana a `imageSrc` en un elemento con clase `hero`).
 */

/** Normaliza texto para comparar: sin espacios extra, sin saltos, en minusculas. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** true si el valor parece un texto editable (no un color, URL o numero). */
function isEditableText(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();

  // Muy corto para ser un texto, o claramente una URL/color/ruta.
  if (trimmed.length === 0) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return false;
  if (/^\/[a-z0-9\-_/]*$/i.test(trimmed)) return false;

  return true;
}

/**
 * Recolecta todos los pares `ruta -> texto` de un bloque, incluyendo los items
 * de los arrays (`metrics[0].label`).
 *
 * La ruta es la que usa el panel de propiedades como `locationKey`, para que el
 * scroll pueda encontrar el input exacto.
 */
export function collectTextPaths(
  props: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const found = new Map<string, string>();

  for (const [key, value] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isEditableText(value)) {
      found.set(path, normalizeText(value));
      continue;
    }

    // Arrays de objetos: `metrics[0].label`, `metrics[1].label`...
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const nested = collectTextPaths(
            item as Record<string, unknown>,
            `${key}.${index}`,
          );
          for (const [nestedPath, nestedText] of nested) {
            found.set(nestedPath, nestedText);
          }
        } else if (isEditableText(item)) {
          found.set(`${key}.${index}`, normalizeText(item));
        }
      });
    }
  }

  return found;
}

/**
 * `locationKey` del panel de propiedades a partir de una ruta.
 *
 * El panel usa formatos distintos segun el nivel:
 *   - prop simple:  `title`
 *   - item de array: `metrics-0-label`
 *
 * Esta funcion traduce la ruta interna (`metrics.0.label`) a esa forma, que es
 * la que necesita el `data-field-key` del input para poder scrollear hasta el.
 */
export function pathToLocationKey(path: string): string {
  return path.replace(/\./g, "-");
}

/** Puntua cuanto se parece una ruta al elemento clickeado, para desempatar. */
function scorePath(path: string, element: HTMLElement): number {
  let score = 0;

  const pathWords = path.toLowerCase().split(/[.\-]/).filter(Boolean);
  const haystack = [
    element.className && typeof element.className === "string"
      ? element.className
      : "",
    element.getAttribute("alt") ?? "",
    element.tagName.toLowerCase(),
  ]
    .join(" ")
    .toLowerCase();

  for (const word of pathWords) {
    if (word.length > 2 && haystack.includes(word)) score += 2;
  }

  // Un `<h1>` es casi siempre el titulo: si la prop se llama `title`, gana.
  const tag = element.tagName.toLowerCase();
  if (tag === "h1" && path.toLowerCase().includes("title")) score += 3;
  if (tag === "h2" && path.toLowerCase().includes("title")) score += 2;

  return score;
}

/**
 * Devuelve la ruta de la prop que corresponde al elemento clickeado, o `null`.
 *
 * `null` es un resultado valido y frecuente: el cliente puede hacer click en un
 * fondo, un icono decorativo o un contenedor. En ese caso el editor solo
 * selecciona el bloque, sin resaltar ningun campo.
 */
export function resolveFieldPath(
  element: HTMLElement,
  block: BlockInstance,
): string | null {
  const props =
    block.props && typeof block.props === "object" ? block.props : {};

  // 1. Via explicita: el componente declara su prop.
  const explicit = element.closest("[data-field]");
  if (explicit) {
    const field = explicit.getAttribute("data-field");
    if (field) return field;
  }

  const textPaths = collectTextPaths(props as Record<string, unknown>);

  // 2. Imagenes: se comparan por `src`.
  const tag = element.tagName.toLowerCase();
  if (tag === "img") {
    const src = element.getAttribute("src") ?? "";
    for (const [path, value] of Object.entries(props)) {
      if (typeof value === "string" && value === src && /src|image|photo/i.test(path)) {
        return path;
      }
    }
  }

  // 3. Enlaces y botones: por `href`.
  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    for (const [path, value] of Object.entries(props)) {
      if (typeof value === "string" && value === href && /href|link|url/i.test(path)) {
        return path;
      }
    }
  }

  // 4. Texto: el caso principal.
  const elementText = normalizeText(element.textContent ?? "");
  if (!elementText) return null;

  const candidates = [...textPaths.entries()].filter(
    ([, text]) => text === elementText,
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0][0];

  // Empate: se elige el que mejor encaja con el elemento.
  return candidates
    .map(([path]) => ({ path, score: scorePath(path, element) }))
    .sort((a, b) => b.score - a.score)[0].path;
}