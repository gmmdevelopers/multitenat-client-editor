"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Clock,
  Inbox,
  Menu,
  Tag,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";

import { DepositNoticeBanner } from "@/components/DepositNoticeBanner";
import { useAuth } from "@/context/AuthContext";

/**
 * Secciones del panel de administración.
 *
 * Se declara como lista y no como enlaces sueltos para que añadir una seccion
 * sea una linea: el drawer, el resaltado de la activa y el titulo salen de aqui.
 *
 * La agenda y otras herramientas del dia a dia se iran sumando a esta lista.
 */
const SECTIONS = [
  {
    key: "agenda",
    label: "Agenda",
    href: "agenda",
    icon: CalendarDays,
    description: "Las citas de la semana, por profesional.",
  },
  {
    key: "services",
    label: "Servicios",
    href: "services",
    icon: Tag,
    description: "Lo que ofreces, su duración y su precio.",
  },
  {
    key: "professionals",
    label: "Profesionales",
    href: "professionals",
    icon: UserRound,
    description: "Tu equipo y los servicios que ofrece cada uno.",
  },
  {
    // Va DESPUES de Profesionales y no dentro de Configuracion: es un ajuste
    // operativo, y alli -entre la paleta y el dominio- el cliente no lo
    // encontraria cuando lo necesita, que es al organizar la agenda.
    key: "hours",
    label: "Horario de atención",
    href: "hours",
    icon: CalendarClock,
    description: "Cuándo atiendes y en qué horas se puede agendar.",
  },
  {
    // Pegado al horario: son los DOS ajustes que deciden la disponibilidad
    // (la regla semanal y sus excepciones). Separarlos obligaria a buscarlos en
    // dos sitios cada vez que la agenda no ofrece las horas esperadas.
    key: "time-off",
    label: "Feriados y vacaciones",
    href: "time-off",
    icon: CalendarOff,
    description: "Fechas concretas en que la agenda está cerrada.",
  },
  {
    // Junto al horario del negocio: es su version POR PERSONA, y tenerlas
    // seguidas hace evidente que una es la regla general y la otra la excepcion.
    key: "professional-hours",
    label: "Horario por profesional",
    href: "professional-hours",
    icon: Clock,
    description: "Quién atiende en horarios distintos al del negocio.",
  },
  {
    // Ultima, y despues de todo lo que decide la DISPONIBILIDAD: esta seccion
    // no cambia cuando se puede agendar, sino cuanto se paga. Mezclarla con los
    // horarios haria buscar en el sitio equivocado.
    key: "deposit",
    label: "Cobro al agendar",
    href: "deposit",
    icon: Wallet,
    description: "Cuánto paga el paciente al reservar.",
  },
  {
    key: "contact",
    label: "Formulario de contacto",
    href: "contact",
    icon: Inbox,
    description: "Mensajes que enviaron tus visitantes.",
  },
] as const;

/**
 * Layout del panel de administracion del sitio.
 *
 * Va SEPARADO del editor: son dos tareas distintas. El editor es para diseñar
 * (pantalla completa, canvas, paneles), y este panel es para OPERAR (leer los
 * mensajes que llegan). Mezclarlos obligaba a que el editor cargara cosas que no
 * necesita y hacia que una bandeja de entrada compitiera por el espacio del
 * lienzo.
 *
 * El drawer arranca abierto en pantallas grandes y cerrado en moviles: en
 * escritorio hay espacio de sobra, y en el movil el contenido es lo primero.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `useParams` y no la prop `params`: este layout es de cliente (necesita
  // `useAuth` y `useState`), y en Next 15 la prop llega como Promise, que solo
  // se puede resolver en un componente de servidor. El layout del panel ya usa
  // este mismo patron.
  const routeParams = useParams<{ slug: string }>();
  const { user, tenant, loading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-stone-400">
          Cargando panel...
        </span>
      </div>
    );
  }

  if (!user || !tenant) return null;

  const basePath = `/site/${routeParams?.slug ?? ""}/admin`;

  return (
    <div className="flex h-full min-h-0">
      {/* Drawer lateral */}
      <aside
        data-admin-drawer={isOpen ? "open" : "closed"}
        className={`flex shrink-0 flex-col border-r border-stone-800 bg-stone-950 transition-all duration-200 ${
          isOpen ? "w-64" : "w-14"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-stone-800 px-3">
          {isOpen ? (
            <span className="truncate text-xs font-bold uppercase tracking-wider text-amber-300">
              Administración
            </span>
          ) : null}

          <button
            type="button"
            data-toggle-drawer="true"
            onClick={() => setIsOpen((current) => !current)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            {isOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {SECTIONS.map((section) => {
            const href = `${basePath}/${section.href}`;
            const isActive = pathname === href;
            const Icon = section.icon;

            return (
              <Link
                key={section.key}
                href={href}
                data-admin-section={section.key}
                title={isOpen ? undefined : section.label}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-amber-400/15 text-amber-300"
                    : "text-stone-400 hover:bg-stone-800 hover:text-white"
                } ${isOpen ? "" : "justify-center"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {isOpen ? (
                  <span className="truncate">{section.label}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {isOpen ? (
          <div className="border-t border-stone-800 p-3">
            {/* Vuelta al editor. Va en el pie, separado de las secciones: no es
                otra pantalla del panel, es salir de el. */}
            <Link
              href={`/site/${routeParams?.slug ?? ""}/editor`}
              data-admin-back-to-editor="true"
              className="mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 transition hover:bg-stone-800 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al editor
            </Link>

            <p className="truncate text-[11px] font-semibold text-white">
              {tenant.name}
            </p>
            <p className="truncate text-[10px] text-stone-500">{user.email}</p>
          </div>
        ) : (
          /* Con el drawer cerrado el enlace se queda en icono: sin el, volver al
             editor exigiria abrir el menu primero. */
          <Link
            href={`/site/${routeParams?.slug ?? ""}/editor`}
            data-admin-back-to-editor="true"
            title="Volver al editor"
            className="flex items-center justify-center border-t border-stone-800 py-3 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
      </aside>

      {/* Contenido: cada pantalla aporta su propio scroll, como en Configuracion. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* El aviso de cobro va AQUI, sobre el contenido y bajo el drawer: es
            el unico sitio de la app donde tiene sentido, porque solo aqui se
            configura la agenda. */}
        <DepositNoticeBanner />

        <div className="min-h-0 flex-1 overflow-y-auto bg-stone-900">
          {children}
        </div>
      </div>
    </div>
  );
}
