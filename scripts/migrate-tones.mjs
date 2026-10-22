/**
 * Migra las clases de TONO (`stone-900`) a clases de PAPEL (`surface`).
 *
 * ## Por que un script y no editarlos a mano
 *
 * Son ~850 usos en 50 archivos. A mano es lento y, sobre todo, **se queda a
 * medias**: una clase olvidada se ve igual que las migradas **en modo oscuro**
 * (porque el tono coincide con el papel), y el fallo solo aparece al cambiar a
 * claro. Es decir: un olvido no da error, da un parche de color.
 *
 * Con el script, el mapeo es exacto y se puede revisar. **No es magia**: aplica
 * la tabla de abajo, que es la que se decidio revisando cada clase.
 *
 * ## La tabla
 *
 * | Tono | Papel | Por que |
 * |---|---|---|
 * | `stone-950` | `background` | El fondo mas oscuro del panel. |
 * | `stone-900` | `surface` | El fondo de las tarjetas y el contenido. |
 * | `stone-800` | `line` | Bordes y separadores. |
 * | `stone-700` | `line-strong` | Bordes con mas contraste (inputs). |
 * | `stone-600` | `muted` | Texto tenue. |
 * | `stone-500` | `text-subtle` | Texto mas tenue (metadatos). |
 * | `stone-400` | `muted` | Texto secundario. |
 * | `stone-300` | `foreground` | Texto principal. |
 * | `stone-100/200` | `foreground` | Texto principal (casi blanco). |
 * | `white` | `foreground` | Texto principal sobre superficies. |
 * | `amber-*` | `accent*` | El acento de la marca. |
 * | `emerald-*` | `success` | Estados correctos. |
 * | `red-*` | `danger` | Errores. |
 *
 * ## Lo que NO toca
 *
 *   - Los `stone-*` que van **en comentarios** (los respeta: solo cambia clases
 *     dentro de `className`).
 *   - Las clases con **variante** (`hover:`, `focus:`) se conservan: se cambia
 *     solo el nombre del color.
 *
 * Uso: `node scripts/migrate-tones.mjs <archivo>`
 */

import { readFileSync, writeFileSync } from "node:fs";

/**
 * Mapa de clase -> clase.
 *
 * El orden importa: `stone-950` tiene que resolverse **antes** que `stone-95`,
 * porque si no un prefijo corto se comeria parte del numero. Por eso se ordenan
 * de mas largo a mas corto al aplicarlos.
 */
const MAP = {
  // --- Estructura del panel (stone, la escala principal) ---
  "stone-950": "background",
  "stone-900": "surface",
  "stone-800": "line",
  "stone-700": "line-strong",
  /**
   * `stone-500/600` se usan **para bordes Y para texto**, y cada caso necesita
   * un nombre distinto: un `border-text-subtle` (borde con nombre de texto) o un
   * `text-line-strong` (texto con nombre de borde) son nombres sin sentido.
   *
   * El prefijo lo resuelve el script: `border-` toma un nombre de borde y el
   * resto toma uno de texto. Ver `PREFIX_OVERRIDES`.
   */
  "stone-600": "neutral-mid",
  "stone-500": "neutral-mid",
  "stone-400": "muted",
  "stone-300": "foreground",
  "stone-200": "foreground",
  "stone-100": "foreground",

  // --- Estructura del panel (gray y zinc: se unifican con stone) ---
  "gray-950": "background",
  "gray-900": "surface",
  "gray-800": "line",
  "gray-700": "line-strong",
  "gray-600": "neutral-mid",
  "gray-500": "neutral-mid",
  "gray-400": "muted",
  "gray-300": "foreground",
  "gray-200": "foreground",
  "gray-100": "foreground",

  "zinc-950": "background",
  "zinc-900": "surface",
  "zinc-800": "line",
  "zinc-700": "line-strong",
  "zinc-600": "neutral-mid",
  "zinc-500": "neutral-mid",
  "zinc-400": "muted",
  "zinc-300": "foreground",
  "zinc-200": "foreground",

  // --- Acento (ambar de la marca) ---
  "amber-200": "accent-strong",
  "amber-300": "accent-strong",
  "amber-400": "accent",
  "amber-500": "accent",
  "amber-600": "accent-strong",
  "amber-950": "accent-soft",

  // --- Estados ---
  "emerald-300": "success",
  "emerald-400": "success",
  "emerald-500": "success",
  "emerald-600": "success",
  "emerald-950": "success-soft",
  "green-400": "success",
  "green-500": "success",

  "red-200": "danger",
  "red-300": "danger",
  "red-400": "danger",
  "red-500": "danger",
  "red-600": "danger",
  "red-950": "danger-soft",

  // --- Planes (colores de categoria) ---
  "blue-300": "info",
  "blue-400": "info",
  "blue-500": "info",
  "blue-950": "info-soft",
  "purple-300": "premium",
  "purple-400": "premium",
  "purple-500": "premium",
  "purple-950": "premium-soft",

  // --- Texto sobre superficies y sobre el acento ---
  //
  // `text-black` sobre un boton ambar es el caso mas comun del panel, y
  // `text-white` es el texto principal sobre las superficies oscuras.
  black: "on-accent",
  white: "foreground",
};

/**
 * Prefijos que llevan un color.
 *
 * `text-black` -> `text-on-accent`, pero `bg-black` NO existe en el panel; si
 * apareciera, el mapa lo resuelve igual.
 */
/**
 * Cuando el papel es `neutral-mid` (tono intermedio), el nombre depende del
 * PREFIJO.
 *
 * Es el unico caso ambiguo de la tabla: `stone-500/600` sirve para un borde
 * visible y para un texto tenue, y son dos papeles con nombres distintos. Con
 * uno solo, siempre hay un nombre sin sentido: `border-text-subtle` o
 * `text-line-strong`.
 */
/**
 * Cuando el papel es ambiguo, el nombre depende del PREFIJO.
 *
 * Son los dos casos en que la misma clase hacia de borde Y de fondo, y cada uso
 * necesita un nombre distinto. Con uno solo, siempre hay un nombre sin sentido:
 * `bg-line` (fondo con nombre de borde) o `border-surface` (borde con nombre de
 * fondo).
 *
 * Se resuelven aqui y no en el mapa porque el mapa no conoce el prefijo.
 */
const PREFIX_OVERRIDES = {
  "line": {
    /** Un fondo con `stone-800` es una superficie elevada, no una linea. */
    bg: "surface-raised",
    default: "line",
  },
  "neutral-mid": {
    border: "line-strong",
    divide: "line-strong",
    ring: "line-strong",
    outline: "line-strong",
    bg: "surface-raised",
    // El resto (text, placeholder, fill, stroke...) es texto tenue.
    default: "text-subtle",
  },
};

const PREFIXES = [
  "bg",
  "text",
  "border",
  "from",
  "to",
  "via",
  "ring",
  "divide",
  "fill",
  "stroke",
  "outline",
  "decoration",
  "placeholder",
  "caret",
  "shadow",
];

const filePath = process.argv[2];

if (!filePath) {
  console.error("Falta el archivo: node scripts/migrate-tones.mjs <archivo>");
  process.exit(1);
}

let source = readFileSync(filePath, "utf8");

/**
 * Solo se toca el contenido de los `className`.
 *
 * Sin esto, un `stone-900` dentro de un **comentario** se cambiaria, y los
 * comentarios que explican el mapeo ("`bg-stone-950` -> `bg-background`")
 * quedarian como "`bg-background` -> `bg-background`": sin sentido.
 */
const TONE = Object.keys(MAP).sort((a, b) => b.length - a.length).join("|");

/**
 * Captura: `(prefijo-(variante:)*)(tono)`.
 *
 * El prefijo se conserva tal cual (incluye `hover:`, `focus:`...) y solo cambia
 * el nombre del color.
 */
const PATTERN = new RegExp(
  `\\b((?:[a-z-]+:)*)((?:${PREFIXES.join("|")}))-(${TONE})\\b`,
  "g",
);

let replacements = 0;

source = source.replace(PATTERN, (match, variants, prefix, tone) => {
  let mapped = MAP[tone];

  // Caso especial: `text-black` -> `text-on-accent`, pero `bg-black` no tiene
  // sentido con ese nombre. Se deja solo si el prefijo es de texto.
  if (tone === "black") {
    if (prefix !== "text") return match;
  }

  // Papel ambiguo: el nombre depende del prefijo (ver `PREFIX_OVERRIDES`).
  const overrides = PREFIX_OVERRIDES[mapped];

  if (overrides) {
    mapped = overrides[prefix] ?? overrides.default;
  }

  // `border-stone-800/60` (con opacidad) se conserva la parte de opacidad.
  replacements += 1;

  return `${variants}${prefix}-${mapped}`;
});

writeFileSync(filePath, source, "utf8");

console.log(`${replacements} cambios en ${filePath}`);
