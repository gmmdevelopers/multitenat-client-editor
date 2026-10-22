"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * El tema del panel: claro u oscuro.
 *
 * ## Por que hay conmutador, si el resto de la plataforma sigue al sistema
 *
 * En la app del paciente y en el landing, el tema **sigue al sistema**
 * (`prefers-color-scheme`): es lo que espera cualquiera en el movil, y el modo
 * de ahorro de bateria de Android activa el oscuro por su cuenta.
 *
 * El panel es distinto: es una **herramienta de trabajo** que alguien tiene
 * abierta todo el dia. Ahi seguir al sistema no siempre es lo que se quiere
 * (muchos tienen el escritorio en claro y prefieren el panel oscuro, o al
 * reves). Por eso **el usuario elige**, y la eleccion se recuerda.
 *
 * ## Como se aplica
 *
 * Se pone (o se quita) la clase `.dark` en el `<html>`. El CSS
 * (`tokens.generated.css`) define los dos juegos de variables: `:root` para
 * claro y `.dark` para oscuro. Nada mas cambia.
 *
 * Se usa una **clase** y no `@media (prefers-color-scheme)` a proposito: con la
 * media query no habria eleccion posible.
 */

export type Theme = "light" | "dark";

/**
 * Clave en `localStorage`.
 *
 * Se versiona (`v1`) para poder cambiar el formato mas adelante sin que un valor
 * viejo rompa la lectura: si el formato cambia, se sube a `v2` y el anterior se
 * ignora solo.
 */
const STORAGE_KEY = "multitenant-theme-v1";

interface ThemeContextValue {
  theme: Theme;
  /** Cambia el tema y lo guarda. */
  setTheme: (theme: Theme) => void;
  /** Alterna entre claro y oscuro. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * El tema con el que arrancar, **antes** de leer `localStorage`.
 *
 * Devuelve `dark` por defecto: es el modo en el que se diseño el panel, y el
 * cambio a claro es lo que el usuario pide explicitamente.
 */
function initialTheme(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  /**
   * Al montar, se lee la preferencia guardada y se aplica la clase.
   *
   * Va en un `useEffect` y no en el `useState` inicial porque `localStorage` no
   * existe en el servidor: leerlo durante el render rompe el SSR de Next (el
   * HTML del servidor no coincidiria con el del cliente).
   */
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }
  }, []);

  /**
   * Aplica la clase al `<html>` cada vez que cambia el tema.
   *
   * Se hace aqui y no en el `onClick` del boton: asi vale para **cualquier**
   * origen del cambio (el boton, la preferencia guardada al arrancar, o codigo
   * futuro). Un solo sitio que sincroniza el estado con el DOM.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * El tema del panel. Lanza si falta el provider, para detectarlo en desarrollo.
 *
 * ## El script de arranque
 *
 * Ver `layout.tsx`: hay un script **inline** que pone la clase `.dark` antes de
 * que React monte. Sin el, la pagina se pinta primero en claro (el valor por
 * defecto del CSS) y **cambia a oscuro** al hidratar: un destello blanco en cada
 * carga, muy visible.
 *
 * `suppressHydrationWarning` en el `<html>` es necesario por ese script: el HTML
 * del servidor no lleva la clase y el del cliente si, y React avisaria de la
 * diferencia.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>.");
  }

  return context;
}
