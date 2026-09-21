import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` genera un servidor minimo con solo lo que la app necesita en
  // runtime. La imagen pasa de ~1GB a ~150MB porque no arrastra el toolchain
  // de build ni las dependencias de desarrollo.
  output: "standalone",
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
