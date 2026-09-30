"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  paletteCssVariables,
  resolvePaletteTokens,
} from "@multitenant/design-system";

interface SiteThemeProviderProps {
  /** Paleta guardada en `Site.settings.palette`. `null` = la del vertical. */
  palette?: unknown;
  /** Vertical del tenant, para cuando no hay paleta propia. */
  siteType?: string;
  /** Que fondo ve el visitante mientras carga. */
  backgroundToken?: "background" | "surface";
  className?: string;
  children: ReactNode;
}

/**
 * Aplica la paleta del sitio como variables CSS al subarbol.
 *
 * Se usa el MISMO componente en el editor y en la web publica a proposito: si
 * cada uno resolviera la paleta por su cuenta, el cliente veria un color en el
 * canvas y otro en su web, y el fallo apareceria justo despues de publicar.
 *
 * Las variables cuelgan del contenedor, no de `:root`, para que la UI del
 * editor (que es oscura) no herede el tema del cliente y se vuelva ilegible.
 */
export function SiteThemeProvider({
  palette,
  siteType,
  backgroundToken = "background",
  className,
  children,
}: SiteThemeProviderProps) {
  const tokens = useMemo(
    () => resolvePaletteTokens(palette, siteType),
    [palette, siteType],
  );

  const style = useMemo(
    () =>
      ({
        ...paletteCssVariables(tokens),
        // El contenedor ya pinta el fondo y el color de texto base: asi el
        // primer frame no sale en blanco y con el texto por defecto.
        backgroundColor: tokens[backgroundToken],
        color:
          tokens[backgroundToken === "surface" ? "onSurface" : "onBackground"],
      }) as CSSProperties,
    [tokens, backgroundToken],
  );

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}

/**
 * Lee la paleta resuelta sin pintar nada.
 *
 * Lo usa el editor para pasarle el color de marca a componentes que lo reciben
 * por prop (la agenda) en vez de por variable CSS.
 */
export function useSitePaletteTokens(palette?: unknown, siteType?: string) {
  return useMemo(
    () => resolvePaletteTokens(palette, siteType),
    [palette, siteType],
  );
}
