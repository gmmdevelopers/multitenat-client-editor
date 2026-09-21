import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.1.197",
    "salud-bienestar.multitenant.test",
    "app.localhost",
    "salud-bienestar.localhost",
  ],
  // El design system se consume como copia (`file:` en package.json): pnpm lo
  // duplica en node_modules, asi que hay que reinstalar (o rsync) tras cada
  // cambio del DS. Se probo `link:` (symlink) y Turbopack no lo resuelve
  // cuando el destino queda fuera del root del proyecto.
  transpilePackages: ["@multitenant/design-system"],
};

export default nextConfig;
