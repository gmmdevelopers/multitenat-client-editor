import axios from "axios";

/**
 * Normaliza la URL del API para que siempre termine en `/api`.
 *
 * El backend monta todo bajo el prefijo `/api`, pero la variable de entorno se
 * escribe a mano en cada entorno (y en Coolify se olvido el sufijo). Depender
 * de que todos lo recuerden es fragil: mejor lo garantizamos aqui.
 */
function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) return "http://localhost:3000/api";

  // Quitamos barras finales para poder concatenar sin duplicar.
  const withoutTrailingSlash = raw.replace(/\/+$/, "");

  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // El tenant viaja por header.
    //
    // El API vive en `api.<dominio>`, asi que el backend NO puede deducir el
    // tenant del host: la peticion llega desde el navegador a otro dominio. El
    // proxy escribe `x-tenant-slug` como cookie cuando se sirve la web publica
    // de un tenant, y aqui la reenviamos.
    const tenantSlug = readCookie("x-tenant-slug");
    if (tenantSlug && !config.headers["x-tenant-slug"]) {
      config.headers["x-tenant-slug"] = tenantSlug;
    }
  }
  return config;
});

/**
 * Lee una cookie del navegador.
 *
 * No usamos `document.cookie` parseado a mano porque los valores pueden venir
 * codificados (el slug se escribe con `encodeURIComponent`).
 */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  if (!match) return undefined;

  const value = match.slice(name.length + 1);

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Solo las rutas del panel mandan al login. La web publica tambien usa
      // este cliente y un visitante sin cuenta no debe ser redirigido.
      const isPublicRequest = String(error.config?.url ?? "").includes(
        "/public/",
      );

      if (!isPublicRequest && typeof window !== "undefined") {
        // Token invalido o expirado: hay que limpiar la sesion o el proxy
        // vuelve a mandar al editor y se entra en un bucle de redirecciones.
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        document.cookie = "accessToken=; path=/; max-age=0; samesite=lax";

        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);
