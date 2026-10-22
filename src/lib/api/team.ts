import { api } from "./client";

/**
 * Usuarios del equipo del negocio.
 *
 * ## Quien puede usarlo
 *
 * **Solo el `owner`.** Todos los endpoints (`/auth/admin-users`) estan detras de
 * `@Roles("owner")`, asi que un `admin` recibe 403. No es un descuido: dar de
 * alta al equipo —y sobre todo asignar roles— es lo que decide **quien puede
 * hacer que** en el negocio, y esa es la llave del negocio.
 */

/** Los cuatro roles, en el orden en que se muestran (de mas a menos alcance). */
export const TEAM_ROLES = [
  "owner",
  "admin",
  "receptionist",
  "professional",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/** Etiqueta para mostrar. La clave es el valor del enum del backend. */
export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  receptionist: "Recepción",
  professional: "Profesional",
};

/**
 * Que hace cada rol, en una linea.
 *
 * Se muestra al elegirlo: un desplegable con cuatro palabras sueltas obliga a
 * adivinar la diferencia entre "Administrador" y "Propietario", que es
 * justamente la decision que se esta tomando.
 */
export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner:
    "Control total, incluido el cobro, el plan y el equipo. Solo puede haber uno por negocio.",
  admin:
    "Administra la agenda y la web, pero no toca el cobro, el plan ni el equipo.",
  receptionist: "Atiende la agenda y los chats. Ve el resto en modo lectura.",
  professional:
    "Solo ve su propia agenda y el chat. Trabaja desde la app del móvil.",
};

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: TeamRole;
  /**
   * La ficha de profesional, si el usuario atiende.
   *
   * `null` en los roles que no atienden. Es lo que distingue a la duena de un
   * negocio unipersonal (que tambien atiende) del que solo administra.
   */
  professionalId: string | null;
  /** Nombre de esa ficha, ya resuelto por el backend. */
  professionalName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TeamListResponse {
  items: TeamMember[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Usuarios del equipo del negocio. */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const { data } = await api.get<TeamListResponse>("/auth/admin-users", {
    // El equipo de un negocio pequeno no llega a la pagina por defecto, pero se
    // pide un tamaño generoso para no dejar gente fuera de la lista sin avisar.
    params: { pageSize: 100 },
  });

  return data.items;
}

export interface CreateTeamMemberRequest {
  fullName: string;
  email: string;
  password: string;
  role: TeamRole;
  /**
   * Ficha de profesional.
   *
   * **Obligatoria si el rol es `professional`** (el backend responde 400 sin
   * ella) y opcional en `owner` y `admin`, para el negocio donde la misma
   * persona administra y atiende.
   */
  professionalId?: string;
}

/** Da de alta un usuario del equipo. */
export async function createTeamMember(
  payload: CreateTeamMemberRequest,
): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>("/auth/register", payload);

  return data;
}

/**
 * Activa o desactiva un usuario.
 *
 * No hay borrado: un usuario con historial (citas, mensajes, sesiones) no debe
 * desaparecer. Desactivarlo le quita el acceso y conserva el registro.
 */
export async function setTeamMemberActive(
  id: string,
  isActive: boolean,
): Promise<TeamMember> {
  const { data } = await api.patch<TeamMember>(
    `/auth/admin-users/${id}/status`,
    { isActive },
  );

  return data;
}
