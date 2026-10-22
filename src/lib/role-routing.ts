import type { AdminRole } from "@/types/enums";

/**
 * Que puede hacer cada rol en el PANEL WEB.
 *
 * ## Por que vive en un solo sitio
 *
 * La regla se necesita en tres lugares: el layout del sitio (a donde redirigir),
 * el layout del admin (que secciones mostrar) y la barra lateral (que boton de
 * salida ofrecer). Repartirla como condicionales sueltos daria **tres verdades**
 * que se desincronizan: al cambiar un permiso habria que acordarse de las tres, y
 * olvidar una deja una puerta abierta o un boton que no lleva a ningun lado.
 *
 * ## Los roles son una CASCADA de alcance, no de permisos distintos
 *
 * `owner > admin > receptionist > professional`. Cada nivel hacia abajo tiene
 * **menos** alcance, nunca otro. Ver `BACKLOG.md` §2.1.
 *
 * ## Esto es la mitad VISIBLE
 *
 * Ocultar un boton o redirigir **no protege nada**: el backend corta con
 * `@Roles(...)`. Aqui solo se evita ofrecer lo que va a dar 403, que es una
 * cuestion de UX, no de seguridad.
 */
export type AdminRoleName = AdminRole;

/**
 * La ruta del panel a la que debe ir un rol que SI tiene panel.
 *
 * Hoy todos los roles con panel entran por la **agenda**: es el trabajo del dia
 * a dia, y el `owner` o el `admin` llegan a cualquier otra seccion desde ahi en
 * un clic.
 *
 * ## Por que el `slug` es parametro y no se lee del contexto
 *
 * Este modulo es **puro** (no importa React): asi lo pueden usar layouts,
 * componentes y pruebas sin montar nada. El slug lo pasa quien lo llama, que es
 * quien tiene el contexto del tenant.
 *
 * ## Por que NO recibe el rol
 *
 * Recibirlo sugeriria que la ruta depende de el, y hoy no es asi: todos los que
 * tienen panel entran por el mismo sitio. Si algun dia un rol necesitara otra
 * entrada, es aqui donde se añade la condicion — no antes, para no fingir una
 * logica que no existe.
 */
export function adminHomePath(slug: string): string {
  return `/site/${slug}/admin/agenda`;
}

/**
 * Secciones del panel de administracion que puede VER cada rol.
 *
 * `null` = **todas**. Es el caso de `owner` y `admin`, que administran el
 * negocio entero.
 *
 * ## El `receptionist` VE todo lo operativo
 *
 * Necesita **ver** el negocio completo para atender: saber que servicios hay,
 * quien atiende y en que horario. Ocultarselo no lo protege de nada —son datos
 * que ya estan en la web publica— y le impide responder preguntas basicas
 * ("¿cuanto cuesta un masaje?", "¿atiende los sabados?").
 *
 * Lo que NO puede es **editarlo**. De eso se encarga `canEditSection`, y las
 * pantallas muestran un aviso en vez de los controles.
 */
export function allowedAdminSections(
  role: AdminRoleName,
): readonly string[] | null {
  if (role === "professional") {
    // El profesional NO entra al panel web (se le muestra el QR). Si por alguna
    // via llegara aqui, no ve ninguna seccion en vez de verlo todo por defecto:
    // el fallo seguro es el que no concede.
    return [];
  }

  /**
   * Equipo es SOLO del `owner`.
   *
   * Asignar roles decide **quien puede hacer que** en el negocio: es la llave
   * del negocio, y no se delega. El backend lo corta igual (`@Roles("owner")`
   * en todos los endpoints de `/auth/admin-users`), asi que mostrarselo a un
   * `admin` seria ofrecerle una pantalla que solo daria 403.
   */
  const sections = SECTIONS_FOR_ADMIN.filter(
    (key) => key !== "team" || role === "owner",
  );

  return sections;
}

/**
 * Secciones que existen en el panel, para los roles que ven casi todo.
 *
 * Se declara aqui y no se importa del layout porque `lib/` no debe depender de
 * `app/`: son capas distintas, y un import invertido ata la regla de permisos a
 * un componente de React.
 *
 * Si se añade una seccion al menu, hay que sumarla aqui. Es el precio de
 * mantener las capas separadas, y se paga una vez por seccion nueva.
 */
const SECTIONS_FOR_ADMIN = [
  "agenda",
  "services",
  "chats",
  /**
   * Pacientes: las fichas del negocio.
   *
   * Va DESPUES de Chats y antes de Profesionales: es informacion del dia a dia
   * (quien es esta persona que llama) y no configuracion.
   */
  "patients",
  "professionals",
  "hours",
  "time-off",
  "professional-hours",
  "deposit",
  "contact",
  "team",
] as const;

/**
 * Secciones que el rol puede EDITAR.
 *
 * `null` = todas (de nuevo `owner` y `admin`).
 *
 * ## Por que el `receptionist` edita solo estas
 *
 * El criterio es **operacion vs configuracion**:
 *
 * | Seccion | Edita | Por que |
 * |---|---|---|
 * | Agenda, Chats | ✅ | Su trabajo diario |
 * | Feriados y vacaciones | ✅ | Bloquear un dia es operacion pura |
 * | Horario por profesional | ✅ | "Ana hoy entra mas tarde" |
 * | Servicios | ❌ | Los precios son del negocio |
 * | Pacientes | ✅ | Crear y corregir una ficha es atender |
 * | Horario de atencion | ❌ | Cambia la regla semanal de todos |
 * | Profesionales | ❌ | Alta de equipo: es del dueno |
 * | Cobro al agendar | ❌ | Es dinero |
 * | Equipo | ❌ | Asignar roles es la llave del negocio |
 * | Formulario de contacto | ✅ | Solo lee y responde mensajes |
 *
 * > **Esto es la mitad VISIBLE.** El backend corta con `@Roles(...)`: las
 * > escrituras de servicios, profesionales y horario del negocio siguen siendo de
 * > `owner` y `admin`. Aqui solo se evita ofrecer controles que daran 403.
 */
export function editableAdminSections(
  role: AdminRoleName,
): readonly string[] | null {
  if (role === "receptionist") {
    return [
      "agenda",
      "chats",
      // Edita fichas —corregir un telefono, marcar a alguien inactivo— pero no
      // las da de alta masivamente: eso no es atender.
      "patients",
      "time-off",
      "professional-hours",
      "contact",
    ];
  }

  if (role === "professional") {
    return [];
  }

  /**
   * El `admin` edita todo **menos Equipo**.
   *
   * No puede devolver `null` (= todas): eso incluiria `team`, y asignar roles
   * es la llave del negocio, que se queda en el `owner`. Se listan las secciones
   * una a una en vez de usar `null` y luego restar, para que la excepcion sea
   * **explicita** y no un descuento facil de perder al añadir secciones.
   */
  if (role === "admin") {
    return SECTIONS_FOR_ADMIN.filter((key) => key !== "team");
  }

  // `owner`: todo, sin excepciones.
  return null;
}

/**
 * `true` si el rol puede EDITAR esa seccion del panel.
 *
 * Se usa en las pantallas para decidir entre mostrar los controles o un aviso de
 * "contacta al administrador". Sin esto, cada pantalla repetiria la lista de
 * roles permitidos, y olvidar una dejaria un boton que da 403.
 */
export function canEditSection(
  role: AdminRoleName,
  sectionKey: string,
): boolean {
  const editable = editableAdminSections(role);

  // `null` = todas.
  return editable === null || editable.includes(sectionKey);
}

/**
 * `true` si el rol puede usar el editor de canvas (sitios y paginas).
 *
 * Solo `owner` y `admin`. El `receptionist` y el `professional` no entran: su
 * trabajo es atender, no diseñar la web.
 */
export function canUseEditor(role: AdminRoleName): boolean {
  return role === "owner" || role === "admin";
}

/**
 * `true` si el rol debe ver la pantalla de descarga de la app en vez del panel.
 *
 * El `professional` trabaja **solo desde la app movil**: su agenda, sus
 * horarios y el chat. El panel web no le sirve, asi que en vez de un 403 seco se
 * le explica y se le da como llegar a la app.
 */
export function mustUseMobileApp(role: AdminRoleName): boolean {
  return role === "professional";
}