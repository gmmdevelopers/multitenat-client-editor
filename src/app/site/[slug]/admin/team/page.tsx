"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Mail,
  Plus,
  Power,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  createProfessional,
  listProfessionals,
  type Professional,
} from "@/lib/api/professionals";
import {
  createTeamMember,
  listTeamMembers,
  setTeamMemberActive,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  TEAM_ROLES,
  type TeamMember,
  type TeamRole,
} from "@/lib/api/team";

/**
 * Equipo del negocio: quien entra al sistema y con que rol.
 *
 * ## Solo el `owner`
 *
 * Todos los endpoints son `@Roles("owner")`. Asignar roles decide **quien puede
 * hacer que** en el negocio, y esa es la llave del negocio: no se delega en un
 * `admin`.
 *
 * ## Los roles son una cascada
 *
 * `owner > admin > receptionist > professional`. Cada nivel hacia abajo tiene
 * **menos** alcance, nunca otro. El `professional` es el unico que ademas
 * necesita una **ficha**: sin ella no tiene agenda que mostrar.
 *
 * ## Por que no hay "borrar"
 *
 * Un usuario tiene historial (citas, mensajes, sesiones). Se **desactiva**, que
 * le quita el acceso y conserva el registro. Igual que los tenants.
 */
export default function TeamPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<TeamMember | null>(null);

  /**
   * El backend corta con `@Roles("owner")`. Aqui se comprueba para no mostrar
   * una pantalla que solo daria 403.
   */
  const canManage = user?.role === "owner";

  /**
   * Fichas que AUN NO tienen cuenta.
   *
   * ## Por que se filtra aqui y no en el backend
   *
   * El endpoint de profesionales lo comparten otras pantallas (la de
   * Profesionales, la agenda), y añadirle un campo "tiene cuenta" obligaria a
   * que todas lo entendieran para ganar nada.
   *
   * Ademas, esta pantalla **ya tiene los dos lados**: la lista de equipo trae
   * `professionalId` de cada usuario. Cruzarlos aqui es gratis y no toca un
   * contrato compartido.
   *
   * ## Por que importa
   *
   * Ofrecer una ficha ya vinculada llevaria a crear un SEGUNDO usuario para la
   * misma persona, con dos correos y dos accesos a la misma agenda. Es un error
   * silencioso: no falla, crea un duplicado.
   */
  const availableProfessionals = useMemo(() => {
    if (!members) return professionals;

    const linked = new Set(
      members
        .map((member) => member.professionalId)
        .filter((id): id is string => id !== null),
    );

    return professionals.filter((professional) => !linked.has(professional.id));
  }, [members, professionals]);

  async function load() {
    try {
      // Los profesionales se piden de una vez: hacen falta para el selector de
      // ficha, y sin ellos el formulario no podria ofrecer ninguna opcion.
      const [team, profs] = await Promise.all([
        listTeamMembers(),
        listProfessionals(),
      ]);

      setMembers(team);
      setProfessionals(profs.items);
      setError(null);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo cargar el equipo.");
      setError(message);
      toast.error(message);
    }
  }

  useEffect(() => {
    if (!canManage) return;
    void load();
    // `canManage` cambia con el rol, y el rol no cambia durante la sesion: se
    // ejecuta una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  async function handleToggle(member: TeamMember) {
    try {
      await setTeamMemberActive(member.id, !member.isActive);

      toast.success(
        member.isActive
          ? `Acceso de ${member.fullName} desactivado`
          : `Acceso de ${member.fullName} reactivado`,
      );

      setPendingToggle(null);
      void load();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el acceso."));
    }
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised/50 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Solo el propietario
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              La gestión del equipo decide quién puede hacer qué en el negocio.
              Si necesitas un cambio, contáctale al propietario.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Users className="h-5 w-5 text-accent-strong" />
            Equipo
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Quién puede entrar al panel y qué puede hacer. Los profesionales
            también ven su agenda en la app del móvil.
          </p>
        </div>

        <button
          type="button"
          data-create-member="true"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo usuario
        </button>
      </header>

      {members === null ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-muted">
            Cargando equipo...
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isSelf={member.id === user?.id}
              onToggle={() => setPendingToggle(member)}
            />
          ))}
        </div>
      )}

      {isCreating ? (
        <CreateMemberModal
          professionals={availableProfessionals}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            void load();
          }}
        />
      ) : null}

      {pendingToggle ? (
        <ConfirmToggleModal
          member={pendingToggle}
          onCancel={() => setPendingToggle(null)}
          onConfirm={() => void handleToggle(pendingToggle)}
        />
      ) : null}
    </div>
  );
}

/** Una fila del equipo. */
function MemberCard({
  member,
  isSelf,
  onToggle,
}: {
  member: TeamMember;
  isSelf: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      data-team-member={member.id}
      className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-surface/50 p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-muted">
          <UserRound className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {member.fullName}

            {/* El usuario de la sesion: sin la marca, uno podria desactivarse a
                si mismo sin darse cuenta. */}
            {isSelf ? (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-strong">
                Tú
              </span>
            ) : null}

            {!member.isActive ? (
              <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] uppercase text-muted">
                Sin acceso
              </span>
            ) : null}
          </p>

          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-text-subtle">
            <Mail className="h-3 w-3 shrink-0" />
            {member.email}
          </p>

          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-line-strong px-2 py-0.5 font-semibold text-foreground">
              {ROLE_LABELS[member.role]}
            </span>

            {/* Si ademas atiende, se dice: es lo que explica por que aparece en
                la agenda del negocio. */}
            {member.professionalName ? (
              <span className="text-text-subtle">
                También atiende como {member.professionalName}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* No se puede desactivar al propio usuario: quedaria fuera del negocio sin
          poder volver a entrar a reactivarse. */}
      {isSelf ? (
        <span className="text-[11px] text-text-subtle">
          No puedes cambiar tu propio acceso
        </span>
      ) : (
        <button
          type="button"
          data-toggle-member={member.id}
          onClick={onToggle}
          title={member.isActive ? "Quitar acceso" : "Dar acceso"}
          className={`flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-[11px] font-semibold transition hover:bg-surface-raised ${
            member.isActive ? "text-foreground" : "text-success"
          }`}
        >
          <Power className="h-3 w-3" />
          {member.isActive ? "Quitar acceso" : "Dar acceso"}
        </button>
      )}
    </article>
  );
}

/** Alta de un usuario del equipo. */
function CreateMemberModal({
  professionals,
  onClose,
  onCreated,
}: {
  professionals: Professional[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { tenant } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamRole>("receptionist");
  const [professionalId, setProfessionalId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fichas disponibles, con las que se crean desde aqui dentro.
   *
   * Empieza con las que llegan por props y se le SUMAN las que se creen en el
   * modal: sin esto, una ficha recien creada no aparecia en el desplegable hasta
   * cerrar y volver a abrir, y el dueno pensaria que no se guardo.
   */
  const [localProfessionals, setLocalProfessionals] = useState(professionals);

  /**
   * Alta de una ficha sin salir de esta pantalla.
   *
   * ## Por que existe
   *
   * El caso real: el dueno va a dar acceso a alguien que **todavia no esta** en
   * la lista de profesionales. Sin esto tendria que salir a Profesionales,
   * crearlo, y volver aqui — tres pasos para una tarea que es una sola.
   */
  const [isCreatingProfessional, setIsCreatingProfessional] = useState(false);
  const [newProfessionalFirst, setNewProfessionalFirst] = useState("");
  const [newProfessionalLast, setNewProfessionalLast] = useState("");
  const [isSavingProfessional, setIsSavingProfessional] = useState(false);

  /**
   * El profesional NECESITA ficha; el resto puede tenerla o no.
   *
   * Se exige aqui y no solo en el backend para que el boton no quede habilitado
   * y luego falle: el backend responde 400 si falta, asi que el formulario debe
   * pedirla antes.
   */
  const needsProfessional = role === "professional";

  /** `owner` y `admin` pueden ademas atender (el negocio de una sola persona). */
  const canHaveProfessional = role === "owner" || role === "admin";

  const isValid =
    fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 8 &&
    (!needsProfessional || professionalId !== "");

  /**
   * Crea la ficha y la deja seleccionada.
   *
   * Se **auto-selecciona** porque es lo que el dueno quiere: creo la ficha para
   * este usuario. Obligarle a elegirla despues en el desplegable seria un paso
   * de mas justo despues de haberla creado.
   */
  async function handleCreateProfessional() {
    const first = newProfessionalFirst.trim();
    const last = newProfessionalLast.trim();

    if (!tenant || first.length === 0 || last.length === 0) return;

    setIsSavingProfessional(true);

    try {
      /**
       * `tenantId` va el **id real** del tenant, no vacio.
       *
       * ## Por que
       *
       * El backend lo usa para **verificar** que el cuerpo coincide con el
       * tenant de la sesion (`assertTenantBodyContext`). Si no coinciden, lanza
       * 400 — y con un valor vacio, siempre falla.
       *
       * El id se toma del contexto de sesion (`useAuth`), que es el mismo que
       * el backend resuelve. Mandar `""` (como hacia la pantalla de
       * Profesionales) rompia la creacion con "tenantId should not be empty".
       */
      const created = await createProfessional({
        tenantId: tenant.id,
        firstName: first,
        lastName: last,
      });

      setLocalProfessionals((current) => [...current, created]);
      setProfessionalId(created.id);

      // Se limpia y se cierra el mini-formulario: la ficha ya esta elegida.
      setNewProfessionalFirst("");
      setNewProfessionalLast("");
      setIsCreatingProfessional(false);

      toast.success(`${first} ${last} agregado como profesional`);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo crear el profesional."));
    } finally {
      setIsSavingProfessional(false);
    }
  }

  async function handleSubmit() {
    if (!isValid) return;

    setIsSaving(true);
    setError(null);

    try {
      await createTeamMember({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        // Se manda solo si aplica: en `receptionist` no tiene sentido y en los
        // demas es opcional.
        ...(professionalId ? { professionalId } : {}),
      });

      toast.success(`${fullName.trim()} puede entrar al panel`);
      onCreated();
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo crear el usuario.");
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-create-member-modal="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-background p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Nuevo usuario</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Entra al panel con su correo y la contraseña que le asignes.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <Field label="Nombre completo">
              <input
                data-new-member-name="true"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ana Pérez"
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </Field>

            <Field label="Correo electrónico">
              <input
                data-new-member-email="true"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@minegocio.cl"
                autoComplete="off"
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              <p className="mt-1 text-[10px] text-text-subtle">
                El correo es único en toda la plataforma: no puede repetirse en
                otro negocio.
              </p>
            </Field>

            <Field label="Contraseña">
              <input
                data-new-member-password="true"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                autoComplete="new-password"
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              <p className="mt-1 text-[10px] text-text-subtle">
                Compártela con la persona: podrá cambiarla después.
              </p>
            </Field>

            {/* --- Rol --- */}
            <Field label="Rol">
              <div className="flex flex-col gap-1.5">
                {TEAM_ROLES.map((option) => (
                  <label
                    key={option}
                    data-role-option={option}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      role === option
                        ? "border-accent bg-accent/10"
                        : "border-line hover:bg-surface-raised"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={role === option}
                      onChange={() => {
                        setRole(option);
                        // Al cambiar de rol, la ficha puede dejar de aplicar. Se
                        // limpia para no mandar una que ya no corresponde.
                        setProfessionalId("");
                      }}
                      className="mt-0.5 h-3.5 w-3.5 accent-amber-500"
                    />

                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground">
                        {ROLE_LABELS[option]}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                        {ROLE_DESCRIPTIONS[option]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            {/* --- Ficha de profesional --- */}
            {needsProfessional || canHaveProfessional ? (
              <Field
                label={
                  needsProfessional
                    ? "Ficha de profesional (obligatoria)"
                    : "También atiende (opcional)"
                }
              >
                <select
                  data-member-professional="true"
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="">
                    {needsProfessional
                      ? "Selecciona la ficha"
                      : "No atiende"}
                  </option>

                  {localProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.firstName} {professional.lastName}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-[10px] text-text-subtle">
                  {needsProfessional
                    ? "Sin ficha, este usuario no tendría agenda que mostrar en la app."
                    : "Elige una ficha si esta persona también atiende citas."}
                </p>

                {/*
                  Alta de la ficha sin salir de esta pantalla.

                  **Siempre visible** cuando el rol puede tener ficha, no solo
                  si la lista esta vacia: el dueno decide. Puede que la persona
                  que quiere dar de alta **no sea** ninguna de las fichas sin
                  cuenta, y obligarle a elegir una que no corresponde —o a
                  salir de la pantalla— seria peor que ofrecerle crearla.
                */}
                {!isCreatingProfessional ? (
                  <button
                    type="button"
                    data-create-professional-inline="true"
                    onClick={() => setIsCreatingProfessional(true)}
                    className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-accent-strong transition hover:text-accent"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar un profesional nuevo
                  </button>
                ) : null}

                {/* Mini-formulario: solo nombre y apellido, lo minimo para crear
                    la ficha. El resto de sus datos se completan en su seccion. */}
                {isCreatingProfessional ? (
                  <div className="mt-2 rounded-lg border border-line bg-surface-raised/50 p-3">
                    <p className="mb-2 text-[11px] font-semibold text-foreground">
                      Nuevo profesional
                    </p>

                    <div className="flex gap-2">
                      <input
                        data-new-professional-first="true"
                        type="text"
                        value={newProfessionalFirst}
                        onChange={(e) => setNewProfessionalFirst(e.target.value)}
                        placeholder="Nombre"
                        className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                      />

                      <input
                        data-new-professional-last="true"
                        type="text"
                        value={newProfessionalLast}
                        onChange={(e) => setNewProfessionalLast(e.target.value)}
                        placeholder="Apellido"
                        className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingProfessional(false);
                          setNewProfessionalFirst("");
                          setNewProfessionalLast("");
                        }}
                        className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:text-foreground"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        data-save-professional-inline="true"
                        onClick={() => void handleCreateProfessional()}
                        disabled={
                          isSavingProfessional ||
                          newProfessionalFirst.trim().length === 0 ||
                          newProfessionalLast.trim().length === 0
                        }
                        className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-on-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSavingProfessional ? "Creando..." : "Crear"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </Field>
            ) : null}

            {error ? (
              <p className="text-xs font-semibold text-danger">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-submit-member="true"
            onClick={() => void handleSubmit()}
            disabled={!isValid || isSaving}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmacion de quitar/dar acceso. */
function ConfirmToggleModal({
  member,
  onCancel,
  onConfirm,
}: {
  member: TeamMember;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isRemoving = member.isActive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-confirm-toggle="true"
        className="w-full max-w-sm rounded-2xl border border-line bg-background p-6"
      >
        <h2 className="text-sm font-bold text-foreground">
          {isRemoving ? "Quitar acceso" : "Dar acceso"}
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          {isRemoving ? (
            <>
              <strong className="text-foreground">{member.fullName}</strong> no
              podrá entrar al panel. Su historial (citas y mensajes) se conserva,
              y puedes reactivarlo cuando quieras.
            </>
          ) : (
            <>
              <strong className="text-foreground">{member.fullName}</strong>{" "}
              podrá volver a entrar con su correo y contraseña.
            </>
          )}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-confirm-toggle-action="true"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              isRemoving
                ? "bg-danger text-white hover:opacity-90"
                : "bg-accent text-on-accent hover:bg-accent-strong"
            }`}
          >
            {isRemoving ? "Quitar acceso" : "Dar acceso"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Etiqueta + control, para no repetir el mismo bloque en cada campo. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </label>
      {children}
    </div>
  );
}