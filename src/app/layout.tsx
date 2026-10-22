import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multitenant | Panel",
  description: "Panel de administracion de Multitenant.",
  /**
   * Icono de la PLATAFORMA (panel y resto de rutas).
   *
   * ## Por que se declara aqui y ya no es `app/favicon.ico`
   *
   * El archivo `app/favicon.ico` es una convencion de Next que se emite en
   * **todas** las rutas y **no se puede quitar por ruta**. Eso chocaba con la web
   * del cliente: su icono se declaraba en su propia pagina, quedaban dos
   * `<link rel="icon">` y el navegador se quedaba con el de la plataforma.
   *
   * La documentacion de Next es explicita: "Los favicons solo se pueden poner en
   * el segmento raiz de `app/`. Si necesitas mas granularidad, usa `icon`".
   *
   * Asi que el archivo se movio a `public/favicon.ico` (sigue sirviendose en
   * `/favicon.ico`) y la plataforma lo declara **como `icon`**, que si se puede
   * sobrescribir por ruta. La web del cliente declara el suyo en su pagina.
   */
  icons: { icon: [{ url: "/favicon.ico" }] },
};

/**
 * Script que aplica el tema ANTES de que React monte.
 *
 * ## Por que hace falta
 *
 * El CSS pinta primero el modo **claro** (es el de `:root`). Si la preferencia
 * guardada es oscuro, la pagina se veria blanca y **saltaria a oscuro** al
 * hidratar: un destello muy visible en cada carga.
 *
 * Con este script, la clase `.dark` se pone en el `<html>` mientras el navegador
 * parsea el `<head>`, **antes del primer pintado**. Cuando React monta, la clase
 * ya esta.
 *
 * ## Por que va inline y no en un archivo
 *
 * Tiene que ejecutarse **antes** de cualquier otro recurso; un `.js` aparte es
 * una peticion mas y podria llegar despues del primer pintado.
 *
 * Va en `try/catch` porque `localStorage` puede **lanzar**: con las cookies
 * bloqueadas, o en el modo privado de algunos navegadores. Si lanza, se queda el
 * modo por defecto (oscuro) en vez de romper la carga.
 */
const THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("multitenant-theme-v1");
    var theme = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      /**
       * `suppressHydrationWarning` porque el script de abajo cambia la clase del
       * `<html>` antes de que React hidrate: el HTML del servidor no la lleva y el
       * del cliente si, y React avisaria de esa diferencia.
       *
       * Es el caso LEGITIMO de esta prop: la diferencia es intencionada y de un
       * solo atributo. No se usa para tapar otros avisos.
       */
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
