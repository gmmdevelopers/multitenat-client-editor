"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";

/**
 * Conmutador de tema claro / oscuro.
 *
 * ## Por que el panel lo tiene y el resto no
 *
 * La app del paciente y el landing siguen al sistema (`prefers-color-scheme`):
 * es lo que se espera en un movil, donde el ajuste ya esta hecho. El panel es una
 * **herramienta de trabajo** abierta todo el dia, y ahi seguir al sistema no
 * siempre coincide con lo que se quiere.
 *
 * ## Por que un solo boton y no un interruptor
 *
 * Con **dos estados**, un boton que alterna es mas simple que un control de dos
 * posiciones: ocupa menos, y el icono ya dice a donde vas. Un `switch` tendria
 * que rotularse ("Claro / Oscuro") para no ser ambiguo.
 *
 * El icono muestra **a donde lleva** (sol si estas en oscuro), que es la
 * convencion de los conmutadores de tema.
 *
 * ## Por que lleva `data-theme-toggle`
 *
 * Es el gancho estable para las pruebas de UI, igual que `data-admin-section` en
 * las secciones del panel. El texto del `aria-label` puede cambiar; el atributo
 * no.
 */
export function ThemeToggle({ isOpen }: { isOpen: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      data-theme-toggle={theme}
      onClick={toggle}
      /**
       * `title` con el menu cerrado: el boton queda solo con el icono, y sin
       * esto no habria forma de saber que hace.
       */
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 transition hover:bg-stone-800 hover:text-white ${
        isOpen ? "" : "justify-center"
      }`}
    >
      {/*
        Se intercambian los iconos y no se rota uno: un sol y una luna se
        reconocen mejor que un icono girando.
      */}
      {isDark ? (
        <Sun className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Moon className="h-3.5 w-3.5 shrink-0" />
      )}

      {isOpen ? (
        <span className="truncate">
          {isDark ? "Modo claro" : "Modo oscuro"}
        </span>
      ) : null}
    </button>
  );
}
