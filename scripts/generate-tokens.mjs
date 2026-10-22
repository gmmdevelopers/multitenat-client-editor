/**
 * Genera las variables CSS del editor desde `@multitenant/tokens`.
 *
 * ## Es el mismo mecanismo que el landing y el dashboard
 *
 * El CSS **no puede importar TypeScript**: `globals.css` no ejecuta codigo. Sin
 * este script, los colores habria que copiarlos a mano y habria **dos fuentes de
 * verdad**: cambiar el acento en el paquete no lo cambiaria aqui, y nada avisaria.
 *
 * ## Este SI tiene dos modos
 *
 * El landing y el dashboard son oscuro-fijo. **El panel no**: tiene conmutador
 * (claro / oscuro), porque es una herramienta de trabajo y en escritorio la
 * preferencia del sistema no siempre es la que uno quiere para el panel.
 *
 * Por eso se generan los DOS juegos de variables:
 *
 *   - `:root`           -> modo claro
 *   - `.dark`           -> modo oscuro (clase, no media query)
 *
 * La clase `.dark` la pone el conmutador en el `<html>`. Se usa una clase y no
 * `@media (prefers-color-scheme)` a proposito: con la media query el usuario no
 * puede elegir, solo seguir al sistema.
 *
 * ## Donde se lee el paquete
 *
 * De `../../packages/tokens/src/primitives.ts` por **ruta directa** y no por
 * `import("@multitenant/tokens")`: Node no procesa TypeScript desde
 * `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Es una
 * restriccion de UBICACION, no de contenido: el mismo archivo funciona fuera.
 *
 * ## Las dos ubicaciones (local y Docker)
 *
 * | Donde | Como llega el paquete | Ruta del fuente |
 * |---|---|---|
 * | Local (monorepo) | `file:../packages/tokens` | `../../packages/tokens/src/` |
 * | Docker (CI) | `github:gmmdevelopers/multitenants-tokens` | `node_modules/@multitenant/tokens/src/` |
 *
 * La de `node_modules` **se copia a temporal** antes de importarla: es el mismo
 * archivo en una ubicacion que Node acepta. Sin esto, el build del contenedor
 * falla con `ERR_MODULE_NOT_FOUND` (el paquete no esta en el contexto de build).
 *
 * Se lee `primitives` y no `tokens` porque `tokens.ts` importa `./primitives`
 * **sin extension**, y Node exige la extension explicita en ESM.
 *
 * Uso: `node --experimental-strip-types scripts/generate-tokens.mjs`
 */

import { copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "../src/app/tokens.generated.css");

const localPath = resolve(here, "../../packages/tokens/src/primitives.ts");
const installedPath = resolve(
  here,
  "../node_modules/@multitenant/tokens/src/primitives.ts",
);

let sourcePath;
let temporaryPath = null;

if (existsSync(localPath)) {
  sourcePath = localPath;
} else if (existsSync(installedPath)) {
  temporaryPath = join(tmpdir(), `multitenant-tokens-${process.pid}.ts`);
  copyFileSync(installedPath, temporaryPath);
  sourcePath = temporaryPath;
} else {
  throw new Error(
    `No se encontro el fuente de tokens. Se probaron:\n  - ${localPath}\n  - ${installedPath}`,
  );
}

try {
  const { primitives, radius, spacing } = await import(sourcePath);

  const { gray, amber, red, green, blue, purple } = primitives;

/**
 * Los dos modos, en tokens semanticos.
 *
 * **Espejan `light` y `dark` de `packages/tokens/src/tokens.ts`.** Si alli cambia
 * un valor, aqui hay que cambiarlo tambien. Es el precio de leer TypeScript desde
 * un script de Node; queda anotado en los dos sitios.
 */
  const light = {
  background: gray[50],
  surface: gray[100],
  surfaceAlt: gray[200],
  surfacePressed: gray[300],

  text: gray[900],
  textMuted: gray[500],
  textSubtle: gray[400],
  textOnAccent: gray[900],
  textOnSurface: gray[900],

  accent: amber[500],
  accentSoft: amber[100],
  accentPressed: amber[600],

  border: gray[200],
  borderStrong: gray[300],

  danger: red[600],
  dangerSoft: red[50],

  success: green[600],
  successSoft: green[50],

  info: blue[700],
  infoSoft: blue[100],
  premium: purple[700],
  premiumSoft: purple[100],
};

  const dark = {
  background: gray[950],
  surface: gray[900],
  surfaceAlt: gray[800],
  surfacePressed: gray[700],

  text: gray[50],
  textMuted: gray[400],
  textSubtle: gray[500],
  textOnAccent: gray[900],
  textOnSurface: gray[50],

  accent: amber[400],
  accentSoft: gray[800],
  accentPressed: amber[300],

  border: gray[800],
  borderStrong: gray[700],

  danger: red[600],
  dangerSoft: gray[800],

  success: green[600],
  successSoft: gray[800],

  info: blue[300],
  infoSoft: blue[950],
  premium: purple[300],
  premiumSoft: purple[950],
};

/**
 * Mapa de token -> variable CSS.
 *
 * Mismo nombre que en el landing y el dashboard (`text` -> `foreground`,
 * `surfaceAlt` -> `surface-raised`), para que las superficies hablen igual.
 */
  const NAME_MAP = {
  text: "foreground",
  textMuted: "muted",
  textSubtle: "text-subtle",
  textOnAccent: "on-accent",
  textOnSurface: "on-surface",
  surfaceAlt: "surface-raised",
  border: "line",
  borderStrong: "line-strong",
  accentPressed: "accent-strong",
};

  function cssName(token) {
    return NAME_MAP[token] ?? token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  }

  const lines = [];

  lines.push("/**");
  lines.push(" * GENERADO AUTOMATICAMENTE. NO EDITAR A MANO.");
  lines.push(" *");
  lines.push(" * Sale de `@multitenant/tokens` con:");
  lines.push(" *   node --experimental-strip-types scripts/generate-tokens.mjs");
  lines.push(" *");
  lines.push(" * Para cambiar un color, se cambia en el paquete y se regenera: asi la");
  lines.push(" * marca queda igual en el panel, el dashboard, la landing y la app.");
  lines.push(" */");
  lines.push("");
  lines.push("/*");
  lines.push(" * MODO CLARO: el que se aplica por defecto.");
  lines.push(" *");
  lines.push(" * El modo oscuro lo activa la clase `.dark` en el <html> (ver abajo), que");
  lines.push(" * pone el conmutador. Se usa una CLASE y no");
  lines.push(" * `@media (prefers-color-scheme: dark)` porque el usuario tiene que poder");
  lines.push(" * elegir: en un panel de trabajo, seguir al sistema no siempre es lo que");
  lines.push(" * quiere (muchos tienen el sistema en claro y prefieren el panel oscuro).");
  lines.push(" */");
  lines.push(":root {");

  for (const [token, value] of Object.entries(light)) {
    lines.push(`  --${cssName(token)}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Espaciado y radios: iguales en los dos modos. */");

  for (const [name, value] of Object.entries(spacing)) {
    lines.push(`  --space-${name}: ${value / 16}rem;`);
  }

  for (const [name, value] of Object.entries(radius)) {
    lines.push(
      `  --radius-${name}: ${value === 999 ? "9999px" : `${value}px`};`,
    );
  }

  lines.push("}");
  lines.push("");
  lines.push(
    "/* MODO OSCURO: solo los colores cambian (las escalas son las mismas). */",
  );
  lines.push(".dark {");

  for (const [token, value] of Object.entries(dark)) {
    lines.push(`  --${cssName(token)}: ${value};`);
  }

  lines.push("}");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Tokens generados en ${outputPath}`);
} finally {
  // Se borra la copia temporal, incluso si la lectura fallo. Si no, cada build
  // dejaria un residuo en `/tmp`.
  if (temporaryPath) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      // Que no se pueda borrar no debe tumbar el build: el CSS ya esta escrito.
    }
  }
}
