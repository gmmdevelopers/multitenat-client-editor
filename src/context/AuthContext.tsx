"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { loginRequest, logoutRequest, getMe } from "@/lib/api/auth";
import type { AdminUser, TenantContextInfo } from "@/types/tenant";

interface AuthContextType {
  user: AdminUser | null;
  tenant: TenantContextInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const router = useRouter();

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

  const login = async (email: string, password: string) => {
    const data = await loginRequest(email, password);

    // El backend responde { accessToken, user: { ..., tenant }.
    const loggedUser = data.user;
    persistToken(data.accessToken);
    localStorage.setItem("user", JSON.stringify(loggedUser));
    setUser(loggedUser);
    setTenant(loggedUser.tenant ?? null);

    router.push("/");
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // La sesión local se limpia igual aunque el backend falle.
    }
    clearToken();
    localStorage.removeItem("user");
    setUser(null);
    setTenant(null);
    router.push("/login");
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
