import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
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

    // En la web publica el navegador no tiene sesion y el backend no siempre
    // puede resolver el tenant por subdominio (local). El proxy comparte el
    // slug en esta cookie SOLO en el dominio del tenant, asi que el panel
    // (app.<dominio>) nunca la envia por error.
  }
  return config;
});

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
