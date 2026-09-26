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
  try {
    const realNext = fs.realpathSync(
      path.join(__dirname, "node_modules", "next"),
    );

    // Resuelto dentro del proyecto (Docker): la raiz es este directorio.
    if (!path.relative(__dirname, realNext).startsWith("..")) {
      return __dirname;
    }

    // Resuelto fuera (monorepo): sube hasta el `node_modules` que lo contiene.
    const storeIndex = realNext.indexOf(`${path.sep}node_modules${path.sep}`);
    if (storeIndex !== -1) return realNext.slice(0, storeIndex);

    return path.resolve(__dirname, "..");
  } catch {
    // Sin `next` instalado: el ancestro del monorepo es el valor seguro.
    return path.resolve(__dirname, "..");
  }
}

const nextConfig: NextConfig = {
  // `standalone` genera un servidor minimo con solo lo que la app necesita en
  // runtime. La imagen pasa de ~1GB a ~150MB porque no arrastra el toolchain
  // de build ni las dependencias de desarrollo.
  output: "standalone",
  turbopack: {
    root: resolveTurbopackRoot(),
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.1.197",
    "salud-bienestar.multitenant.test",
    "app.localhost",
    "salud-bienestar.localhost",
    "app.multitenant.cl",
  ],
  // El design system se consume como copia (`file:` en package.json): pnpm lo
  // duplica en node_modules, asi que hay que reinstalar (o rsync) tras cada
  // cambio del DS. Se probo `link:` (symlink) y Turbopack no lo resuelve
  // cuando el destino queda fuera del root del proyecto.
  transpilePackages: ["@multitenant/design-system"],
};

export default nextConfig;
