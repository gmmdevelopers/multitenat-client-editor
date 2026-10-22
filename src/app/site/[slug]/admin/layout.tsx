"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Clock,
  Inbox,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Tag,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { DepositNoticeBanner } from "@/components/DepositNoticeBanner";
import { useAuth } from "@/context/AuthContext";
import { getUnreadCount } from "@/lib/api/inbox";
import { allowedAdminSections, canUseEditor } from "@/lib/role-routing";

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
    // Justo despues de Agenda: es lo que el negocio revisa al llegar, junto al
    // dia de citas. Bajarla mas la volveria facil de olvidar.
    key: "chats",
    label: "Chats",
    href: "chats",
    icon: MessageSquare,
    description: "Mensajes que te escriben tus pacientes desde la app.",
  },
  {
    /**
     * Pacientes: las fichas del negocio.
     *
     * Va DESPUES de Chats —se llega desde una conversacion o desde una cita— y
     * ANTES de Profesionales: es informacion del dia a dia (quien llama), no
     * configuracion del equipo.
     */
    key: "patients",
    label: "Pacientes",
    href: "patients",
    icon: Users,
    description: "Las fichas de quienes atendiste y su historial.",
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
  {
    // La ultima, y con `ShieldCheck` en vez del icono de personas: no es "mas
    // gente", es **quien puede hacer que**. Va separada del resto porque
    // asignar roles es la llave del negocio, no una tarea del dia a dia.
    key: "team",
    label: "Equipo",
    href: "team",
    icon: ShieldCheck,
    description: "Quién entra al panel y qué puede hacer.",
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
  const { user, tenant, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  /**
   * Mensajes sin leer, para el contador del tab de Chats.
   *
   * Se carga aqui, en el layout, y no en la pagina de chats: el sentido del
   * contador es avisar **sin** estar en la seccion. Si viviera alli, solo lo
   * verias al entrar, que es cuando ya no hace falta.
   *
   * Se refresca cada 30 s: es un panel de trabajo, y una conversacion nueva
   * debe notarse sin recargar. Un intervalo corto golpearia el backend sin
   * aportar (un paciente no escribe cada 10 segundos).
   */
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void getUnreadCount()
        .then((count) => {
          if (!cancelled) setUnread(count);
        })
        // Silencioso: un fallo en el contador no debe romper el panel.
        .catch(() => undefined);
    };

    load();
    const timer = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-muted">
          Cargando panel...
        </span>
      </div>
    );
  }

  if (!user || !tenant) return null;

  const basePath = `/site/${routeParams?.slug ?? ""}/admin`;

  /**
   * Que secciones ve este rol.
   *
   * `null` = todas (`owner` y `admin`, que administran el negocio entero). Una
   * lista = solo esas (`receptionist`: agenda y chats).
   *
   * Se filtra aqui y no en el array `SECTIONS` para no duplicar la declaracion:
   * una seccion nueva aparece sola para los roles con acceso completo.
   */
  const allowed = allowedAdminSections(user.role);
  const visibleSections = allowed
    ? SECTIONS.filter((section) => allowed.includes(section.key))
    : SECTIONS;

  /**
   * El boton del pie cambia segun lo que el rol pueda hacer.
   *
   * ## Por que NO basta con esconder el editor
   *
   * Para quien no puede abrir el canvas, "Volver al editor" seria un enlace a
   * una pantalla que lo devuelve aqui (el layout del sitio lo redirige). Un boton
   * que rebota es peor que no tenerlo: parece roto.
   *
   * Y esas personas necesitan **salir de la aplicacion**, que es lo que el panel
   * no ofrece en ningun otro sitio: la navegacion de usuario vive en la toolbar
   * del editor, que es justo a la que no tienen acceso.
   */
  const showEditorLink = canUseEditor(user.role);

  return (
    <div className="flex h-full min-h-0">
      {/* Drawer lateral */}
      <aside
        data-admin-drawer={isOpen ? "open" : "closed"}
        className={`flex shrink-0 flex-col border-r border-line bg-background transition-all duration-200 ${
          isOpen ? "w-64" : "w-14"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-3">
          {isOpen ? (
            <span className="truncate text-xs font-bold uppercase tracking-wider text-accent-strong">
              Administración
            </span>
          ) : null}

          <button
            type="button"
            data-toggle-drawer="true"
            onClick={() => setIsOpen((current) => !current)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            className="rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
          >
            {isOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {visibleSections.map((section) => {
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
                    ? "bg-accent/15 text-accent-strong"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                } ${isOpen ? "" : "justify-center"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {isOpen ? (
                  <span className="flex-1 truncate">{section.label}</span>
                ) : null}

                {/*
                  Contador de sin leer, solo en el tab de Chats.

                  Se pinta tambien con el menu cerrado (encima del icono) porque
                  el aviso es justo para cuando no lo estas mirando.
                */}
                {section.key === "chats" && unread > 0 ? (
                  <span
                    data-unread-badge={unread}
                    className={`shrink-0 rounded-full bg-accent text-[10px] font-bold text-on-accent ${
                      isOpen
                        ? "px-1.5 py-0.5"
                        : "absolute right-1.5 top-1.5 h-2 w-2 p-0 text-transparent"
                    }`}
                  >
                    {isOpen ? unread : ""}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {isOpen ? (
          <div className="border-t border-line p-3">
            {/*
              Pie del drawer: la SALIDA.

              Para quien puede usar el canvas, es "volver al editor". Para el
              resto (recepcion), es "cerrar sesion": su unica pantalla es esta,
              asi que volver al editor no existe y necesitan poder salir.
            */}
            {showEditorLink ? (
              <Link
                href={`/site/${routeParams?.slug ?? ""}/editor`}
                data-admin-back-to-editor="true"
                className="mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al editor
              </Link>
            ) : (
              <button
                type="button"
                data-admin-logout="true"
                onClick={() => void logout()}
                className="mb-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </button>
            )}

            <p className="truncate text-[11px] font-semibold text-foreground">
              {tenant.name}
            </p>
            <p className="truncate text-[10px] text-text-subtle">{user.email}</p>
          </div>
        ) : (
          /*
            Con el drawer cerrado el boton se queda en icono: sin el, salir
            exigiria abrir el menu primero.

            Se cambia el icono y el destino segun el rol, igual que arriba: una
            flecha "atras" que lleva a una pantalla que rebota seria engañosa.
          */
          showEditorLink ? (
            <Link
              href={`/site/${routeParams?.slug ?? ""}/editor`}
              data-admin-back-to-editor="true"
              title="Volver al editor"
              className="flex items-center justify-center border-t border-line py-3 text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              data-admin-logout="true"
              onClick={() => void logout()}
              title="Cerrar sesión"
              className="flex items-center justify-center border-t border-line py-3 text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )
        )}
      </aside>

      {/* Contenido: cada pantalla aporta su propio scroll, como en Configuracion. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* El aviso de cobro va AQUI, sobre el contenido y bajo el drawer: es
            el unico sitio de la app donde tiene sentido, porque solo aqui se
            configura la agenda. */}
        <DepositNoticeBanner />

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
          {children}
        </div>
      </div>
    </div>
  );
}
