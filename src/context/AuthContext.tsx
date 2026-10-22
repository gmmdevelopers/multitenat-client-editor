"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { loginRequest, logoutRequest, getMe } from "@/lib/api/auth";
import type { AdminUser, TenantContextInfo } from "@/types/tenant";

interface AuthContextType {
  user: AdminUser | null;
  tenant: TenantContextInfo | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** El proxy (middleware) lee el token desde la cookie, no desde localStorage. */
export function persistToken(token: string) {
  localStorage.setItem("accessToken", token);
  document.cookie = `accessToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

function clearToken() {
  localStorage.removeItem("accessToken");
  document.cookie = "accessToken=; path=/; max-age=0; samesite=lax";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tenant, setTenant] = useState<TenantContextInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");

    if (storedUser && token) {
      const parsed = JSON.parse(storedUser) as AdminUser;
      setUser(parsed);
      setTenant(parsed.tenant ?? null);
    }
    setLoading(false);
  }, []);

  // Si hay token pero no usuario hidratado, lo recuperamos desde /auth/me.
  useEffect(() => {
    if (loading || user) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    void getMe()
      .then((me) => {
        setUser(me);
        setTenant(me.tenant ?? null);
        localStorage.setItem("user", JSON.stringify(me));
      })
      .catch(() => {
        clearToken();
        localStorage.removeItem("user");
      });
  }, [loading, user]);

  const login = async (
    email: string,
    password: string,
    tenantSlug: string,
  ) => {
    const data = await loginRequest(email, password, tenantSlug);

    // El backend responde { accessToken, user: { ..., tenant }.
    const loggedUser = data.user;
    persistToken(data.accessToken);
    localStorage.setItem("user", JSON.stringify(loggedUser));

    // El proxy la usa para reescribir /editor a /site/<slug>/editor: el panel
    // es agnostico al tenant y necesita saber cual es la organizacion activa.
    document.cookie = `x-org-slug=${encodeURIComponent(
      tenantSlug,
    )}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    setUser(loggedUser);
    setTenant(loggedUser.tenant ?? null);

    /**
     * Navegacion COMPLETA, no `router.push`.
     *
     * ## El bug que arregla
     *
     * Con `router.push("/")` la navegacion es **de cliente** (SPA), y en una
     * navegacion de cliente el **proxy (middleware) NO se ejecuta**. Como el
     * panel es agnostico al tenant y `/` se reescribe a `/site/<slug>` **en el
     * proxy**, la sesion recien creada no se aplicaba: el cliente entraba y
     * tenia que **recargar a mano** para que el proxy viera las cookies.
     *
     * ## Por que aqui SI conviene recargar
     *
     * Recargar la pagina es justo lo que se busca: acaba de cambiar **la
     * sesion**, y con ella las cookies (`accessToken`, `x-org-slug`) y lo que el
     * proxy debe resolver. Todo el estado del servidor tiene que recomponerse, y
     * una navegacion de cliente se lo salta.
     *
     * No se usa `router.refresh()`: esa refresca los componentes del servidor
     * **sin** volver a ejecutar el middleware, que es lo que falla aqui.
     */
    window.location.href = "/";
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // La sesión local se limpia igual aunque el backend falle.
    }
    clearToken();

    /**
     * Al salir tambien se borra `x-org-slug`.
     *
     * Es la cookie con la que el proxy sabe **que negocio** esta abierto. Sin
     * borrarla, al entrar con OTRA cuenta el proxy seguiria reescribiendo al
     * negocio anterior hasta que se renovara al iniciar sesion: un instante en
     * el que se verian datos del negocio equivocado.
     */
    document.cookie = "x-org-slug=; path=/; max-age=0; samesite=lax";

    localStorage.removeItem("user");
    setUser(null);
    setTenant(null);

    /**
     * Navegacion COMPLETA, por el mismo motivo que en `login`.
     *
     * Con `router.push` el proxy (middleware) **no se ejecuta**, asi que las
     * cookies que se acaban de borrar seguirian contando para el servidor hasta
     * la siguiente peticion completa. Al recargar, el proxy vuelve a decidir con
     * el estado limpio.
     */
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth debe ser usado dentro de AuthProvider");
  return context;
};
