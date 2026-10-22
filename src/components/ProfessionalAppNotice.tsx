"use client";

import { LogOut, Smartphone } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

/**
 * Enlace de descarga de la app del staff.
 *
 * ## Por que apunta a `/app` y no a Google Play directo
 *
 * Es una **redireccion**, no la tienda: `multitenant.cl/app` detecta el
 * dispositivo y lleva a cada uno a su tienda (o avisa si no hay app para el).
 *
 * El QR lo puede escanear un iPhone, y el mismo enlace tiene que servirle. Si
 * apuntara a Play Store, un iPhone abriria una pagina que no le sirve.
 *
 * Mientras la app no este publicada, la redireccion de Android lleva a Play y
 * **Play devuelve un 404** — es esperado, y empieza a funcionar el dia que se
 * publique, sin tocar nada aqui.
 *
 * No se lee de una variable de entorno a proposito: es **un dato de producto**
 * (donde se descarga la app), no una configuracion que cambie entre entornos.
 * Ponerla en `.env` obligaria a acordarse de definirla en cada despliegue, y sin
 * ella el QR quedaria apuntando a un hueco.
 */
const APP_DOWNLOAD_URL = "https://multitenant.cl/app";

/**
 * Aviso para el `professional` que intenta entrar al panel web.
 *
 * ## Por que una pantalla y no un 403
 *
 * El profesional **no tiene prohibido** el panel: es que su herramienta es
 * **otra**. Un error seco ("no tienes permiso") le haria pensar que le falta un
 * permiso que en realidad hay que pedirle al dueño, cuando lo que tiene que
 * hacer es **instalar la app**.
 *
 * Asi que se le explica **que** puede hacer, **donde**, y se le da el camino:
 * un QR que lleva directo a la descarga.
 *
 * ## Por que lleva su propio boton de salir
 *
 * Es la **unica** pantalla que este rol ve, y no tiene el panel alrededor (que es
 * donde vive la navegacion). Sin un boton propio, quedaria atrapado: no podria
 * cerrar sesion ni cambiar de cuenta sin borrar las cookies a mano.
 */
export function ProfessionalAppNotice() {
  const { logout, user, tenant } = useAuth();

  /**
   * El QR se genera con un servicio de imagenes y no con una libreria.
   *
   * ## Por que no se añade una dependencia
   *
   * Traer `qrcode` (o similar) por **una pantalla** añade peso al bundle de todo
   * el panel. El QR es un dato estatico que no cambia: no necesita generarse en
   * el navegador.
   *
   * ## Que se manda al servicio
   *
   * Solo la URL de descarga, que es **publica** (es la misma para todos). No
   * viaja ningun dato del negocio ni del usuario, asi que no hay nada que
   * exponer. Aun asi, si se prefiere no depender de un tercero, la alternativa
   * es generar el SVG en build time con un script — igual que los tokens.
   */
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    APP_DOWNLOAD_URL,
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-gray-950">
            <Smartphone className="h-5 w-5 text-amber-400" />
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            Tu herramienta es la app
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Como profesional, tu agenda, tus horarios y el chat con tus pacientes
            viven en la <strong className="text-gray-300">app móvil</strong>. El
            panel web es para administrar el negocio.
          </p>
        </div>

        {/* El QR: lo unico accionable de la pantalla. */}
        <div className="flex flex-col items-center rounded-xl border border-gray-800 bg-gray-950 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="Código QR para descargar la app"
            width={220}
            height={220}
            className="h-[220px] w-[220px] rounded-lg bg-white p-2"
          />

          <p className="mt-4 text-center text-xs text-gray-400">
            Escanéalo con tu teléfono para descargar la app
          </p>

          <a
            href={APP_DOWNLOAD_URL}
            className="mt-3 text-xs font-semibold text-amber-400 transition hover:text-amber-300"
          >
            O ábrela directamente aquí
          </a>
        </div>

        {/* A quien pedir ayuda: el aviso no debe dejar al profesional sin salida. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          ¿No puedes instalar la app? Pídele a{" "}
          <strong className="text-gray-400">
            {tenant?.name ?? "el administrador"}
          </strong>{" "}
          que revise tu acceso.
        </p>

        <button
          type="button"
          data-professional-logout="true"
          onClick={() => void logout()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-800 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>

        {user?.email ? (
          <p className="mt-4 truncate text-center text-[11px] text-gray-600">
            {user.email}
          </p>
        ) : null}
      </div>
    </div>
  );
}