import fs from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * Raiz de compilacion de Turbopack.
 *
 * Turbopack resuelve `next` desde la raiz del workspace, y esa raiz la deduce
 * buscando el lockfile mas cercano: `pnpm-workspace.yaml` + el lockfile viven en
 * `multitenant/`, un nivel arriba. Como ese directorio queda FUERA de este repo
 * Git, Next lo ignora y luego no encuentra `next/package.json`:
 *
 *   "Could not find the Next.js package" ... "the workspace root is incorrect"
 *
 * El fallo solo aparece con el dev server (siempre compila desde el monorepo);
 * en Docker las dependencias se instalan dentro de este directorio, asi que la
 * raiz valida es el propio directorio.
 *
 * Se decide por el destino REAL del symlink `node_modules/next`, no por la
 * existencia de `node_modules/.pnpm`: ese directorio existe aqui (tiene las
 * dependencias propias del design system) pero NO contiene `next`, que vive
 * arriba. Fiarse de `.pnpm` daria un falso positivo y romperia el build.
 */
function resolveTurbopackRoot(): string {
  /**
   * En el MONOREPO, la raiz es la carpeta que contiene `packages/`.
   *
   * Se decide por la existencia de `packages/design-system`, **no** por donde
   * este `next`: el editor instala aislado, asi que `next` vive dentro de el y
   * no dice nada sobre el monorepo. Ese fue el fallo del intento anterior.
   */
  const monorepoRoot = path.resolve(__dirname, "..");

  if (fs.existsSync(path.join(monorepoRoot, "packages", "design-system"))) {
    return monorepoRoot;
  }

  // Sin `packages/` al lado (Docker): la raiz es el propio directorio, que es
  // donde se instalaron todas las dependencias.
  return __dirname;
}

const nextConfig: NextConfig = {
  // `standalone` genera un servidor minimo con solo lo que la app necesita en
  // runtime. La imagen pasa de ~1GB a ~150MB porque no arrastra el toolchain
  // de build ni las dependencias de desarrollo.
  output: "standalone",
  turbopack: {
    /**
     * La raiz es el MONOREPO, no el editor.
     *
     * ## Por que
     *
     * El editor tiene su propio `pnpm-workspace.yaml` y su lockfile, asi que
     * pnpm instala **aislado**: `next` vive en `client-editor/node_modules`, no
     * en la raiz. `resolveTurbopackRoot()` mira donde esta `next`, lo encuentra
     * dentro, y devolvia **este directorio** como raiz.
     *
     * Con esa raiz, `packages/design-system` queda **FUERA** del proyecto, y
     * Turbopack no lo resuelve:
     *
     *     Module not found: Can't resolve '@multitenant/design-system'
     *
     * Subiendo la raiz a `multitenant/`, el DS entra en el area que Turbopack
     * vigila y el `link:` funciona.
     *
     * ## Y por que sigue estando bien en Docker
     *
     * En la imagen no hay monorepo: el `packages/` no se copia y el DS se
     * instala como copia desde GitHub (`file:` deja de aplicar). Ahi el ancestro
     * no contiene `packages/`, y `resolveTurbopackRoot()` devuelve el propio
     * directorio. Ver esa funcion.
     */
    root: resolveTurbopackRoot(),
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.1.197",
    "salud-bienestar.multitenant.test",
    "app.localhost",
    "salud-bienestar.localhost",
    "app.multitenant.cl",
    "app.multitenant.test",
  ],
  // El design system se consume como copia (`file:` en package.json): pnpm lo
  // duplica en node_modules, asi que hay que reinstalar (o rsync) tras cada
  // cambio del DS. Se probo `link:` (symlink) y Turbopack no lo resuelve
  // cuando el destino queda fuera del root del proyecto.
  transpilePackages: ["@multitenant/design-system"],
};

export default nextConfig;
