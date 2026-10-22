"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Pencil, Phone, Plus, Search, Users } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { canEditSection } from "@/lib/role-routing";
import { ReadOnlyNotice } from "@/components/ReadOnlySection";
import { getErrorMessage } from "@/lib/api/errors";
import {
  PHONE_PREFIX,
  formatPhoneMask,
  toNationalDigits,
} from "@/app/(auth)/register/registration-utils";
import {
  createPatient,
  listPatients,
  updatePatient,
  type Patient,
} from "@/lib/api/patients";

/** Cuantas fichas por pagina. El tope del backend es 100. */
const PAGE_SIZE = 20;

/**
 * Cuanto se espera antes de buscar.
 *
 * Sin esto, escribir "Gonzalez" serian **8 peticiones** y las respuestas podrian
 * llegar desordenadas: la de "G" —que trae cientos— pisaria a la de "Gonzalez".
 * Con una pausa, solo sale la busqueda que el usuario dejo de escribir.
 */
const SEARCH_DEBOUNCE_MS = 300;

/** El nombre completo de una ficha. */
function fullName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

/**
 * Pacientes del negocio.
 *
 * ## Que resuelve
 *
 * Antes, un paciente solo se veia **a traves de sus citas**: para corregir un
 * telefono habia que encontrarlo en la agenda o crear un duplicado. Esta
 * pantalla es la lista de fichas del negocio, con busqueda.
 *
 * ## La busqueda va al SERVIDOR
 *
 * Con cientos de fichas, filtrar en el navegador no escala y **falla en
 * silencio**: una pantalla que solo cargo la primera pagina no encuentra a quien
 * esta en la tercera, el cliente concluye que no existe y **crea un duplicado**.
 *
 * El backend busca en nombre, apellido, correo y telefono sin distinguir
 * mayusculas, asi que un solo campo cubre los cuatro casos.
 *
 * ## Que puede cada rol
 *
 * `owner`, `admin` y `receptionist` crean y editan: corregir un telefono o
 * marcar a alguien inactivo es atender, no administrar. El `professional` no
 * entra al panel web.
 */
export default function PatientsPage() {
  const toast = useToast();
  const { user, tenant } = useAuth();

  const canEdit = user ? canEditSection(user.role, "patients") : false;

  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /** Lo que se escribe y lo que ya se busco (separados por el debounce). */
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const [editing, setEditing] = useState<Patient | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carga una pagina.
   *
   * `append` acumula para el "ver mas"; sin el, reemplaza —que es lo correcto al
   * cambiar la busqueda o al recargar—.
   *
   * El `setState` va **despues del `await`**, dentro de la promesa: es lo que
   * evita el render en cascada que marca la regla `set-state-in-effect`. El
   * efecto dispara la peticion; el estado se actualiza cuando llega la
   * respuesta, no en el cuerpo del efecto.
   */
  const load = useCallback(
    (targetPage: number, append: boolean, search = "") => {
      return listPatients({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search,
      })
        .then((data) => {
          setPatients((current) =>
            append && current ? [...current, ...data.items] : data.items,
          );
          setTotal(data.meta.totalItems);
          setPage(data.meta.page);
          setError(null);
        })
        .catch((err) => {
          const message = getErrorMessage(
            err,
            "No se pudieron cargar los pacientes.",
          );
          setError(message);
          toast.error(message);
        });
    },
    [toast],
  );

  /**
   * La pausa del buscador, que ademas carga.
   *
   * Cuando el usuario deja de escribir se aplica lo escrito y se piden los
   * resultados. La carga va **dentro del `setTimeout`**, no en el cuerpo del
   * efecto: asi el estado se actualiza desde un callback y no hay render en
   * cascada al montar ni al cambiar el filtro.
   *
   * El texto sigue en `query` para que el campo responda a cada tecla.
   *
   * Se vuelve a la **pagina 1**: estar en la 3 con un filtro nuevo daria una
   * lista vacia sin explicacion.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query);
      setPage(1);
      void load(1, false, query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, load]);

  async function handleLoadMore() {
    if (isLoadingMore || patients === null) return;
    if (patients.length >= total) return;

    setIsLoadingMore(true);
    await load(page + 1, true);
    setIsLoadingMore(false);
  }

  if (error && !patients) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-danger/40 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  const hasMore = patients !== null && patients.length < total;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Users className="h-5 w-5 text-accent-strong" />
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-muted">
            Las fichas de quienes agendaron alguna vez. Búscalas por nombre,
            correo o teléfono.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            data-create-patient="true"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo paciente
          </button>
        ) : null}
      </header>

      {canEdit ? null : (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      {/* Buscador */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
        <input
          type="search"
          data-search-patients="true"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono..."
          className="w-full rounded-lg border border-line bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-text-subtle outline-none focus:border-accent"
        />
      </div>

      {/**
       * El contador solo al buscar.
       *
       * Con la lista completa no aporta, pero al filtrar dice si el paciente
       * existe o no — que es justo la duda que evita crear un duplicado.
       */}
      {appliedQuery.trim() ? (
        <p className="mb-4 text-[11px] text-text-subtle">
          {total === 0
            ? "Sin resultados"
            : `${total} ${total === 1 ? "resultado" : "resultados"}`}
        </p>
      ) : null}

      {patients === null ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-muted">
            Cargando pacientes...
          </span>
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          isSearching={Boolean(appliedQuery.trim())}
          onCreate={() => setEditing("new")}
          canEdit={canEdit}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {patients.map((patient) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              onEdit={() => setEditing(patient)}
              canEdit={canEdit}
            />
          ))}

          {/**
           * "Ver mas" y no scroll infinito.
           *
           * Con un boton, el cliente sabe que hay mas y decide; ademas el boton
           * desaparece cuando no queda nada, que es la senal de que llego al
           * final.
           */}
          {hasMore ? (
            <button
              type="button"
              data-load-more-patients="true"
              onClick={() => void handleLoadMore()}
              disabled={isLoadingMore}
              className="mt-3 self-center rounded-lg border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground disabled:opacity-40"
            >
              {isLoadingMore
                ? "Cargando..."
                : `Ver más (${total - patients.length})`}
            </button>
          ) : null}
        </div>
      )}

      {editing ? (
        <PatientModal
          patient={editing === "new" ? null : editing}
          tenantId={tenant?.id ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load(1, false);
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  isSearching,
  onCreate,
  canEdit,
}: {
  isSearching: boolean;
  onCreate: () => void;
  canEdit: boolean;
}) {
  if (isSearching) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <Search className="mx-auto h-6 w-6 text-text-subtle" />
        <p className="mt-3 text-sm font-medium text-foreground">Sin resultados</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">
          Prueba con otro nombre, correo o teléfono. Si la persona no aparece, es
          que todavía no tiene ficha.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <Users className="mx-auto h-6 w-6 text-text-subtle" />
      <p className="mt-3 text-sm font-medium text-foreground">
        Todavía no tienes pacientes
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">
        Las fichas se crean al agendar la primera cita, o aquí mismo si quieres
        tenerlas antes.
      </p>
      {canEdit ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
        >
          Crear el primero
        </button>
      ) : null}
    </div>
  );
}

/**
 * Una fila de la lista.
 *
 * Muestra el **contacto disponible** en una linea: es lo que se busca en esta
 * pantalla (el telefono para llamar, el correo para identificar a la persona).
 */
function PatientRow({
  patient,
  onEdit,
  canEdit,
}: {
  patient: Patient;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const hasContact = Boolean(patient.phone || patient.email);

  return (
    <article
      data-patient={patient.id}
      className={`flex items-center gap-3 rounded-xl border border-line bg-background/60 px-4 py-3 transition ${
        patient.isActive ? "" : "opacity-60"
      }`}
    >
      {/* Inicial, como avatar: la lista se recorre por nombre. */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-muted">
        {patient.firstName.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{fullName(patient)}</span>
          {!patient.isActive ? (
            <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[9px] uppercase text-muted">
              Inactivo
            </span>
          ) : null}
        </p>

        <p className="mt-0.5 flex items-center gap-3 truncate text-[11px] text-text-subtle">
          {patient.phone ? (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {patient.phone}
            </span>
          ) : null}

          {patient.email ? (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" />
              {patient.email}
            </span>
          ) : null}

          {!hasContact ? <span>Sin contacto</span> : null}
        </p>
      </div>

      {canEdit ? (
        <button
          type="button"
          data-edit-patient={patient.id}
          onClick={onEdit}
          title="Editar"
          className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </article>
  );
}

/**
 * Modal de crear/editar.
 *
 * Es el mismo para las dos acciones: los campos son identicos y duplicarlo
 * obligaria a mantener dos formularios sincronizados.
 */
function PatientModal({
  patient,
  tenantId,
  onClose,
  onSaved,
}: {
  patient: Patient | null;
  /** Hace falta solo al crear: el backend lo exige en el cuerpo. */
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEditing = Boolean(patient);

  const [firstName, setFirstName] = useState(patient?.firstName ?? "");
  const [lastName, setLastName] = useState(patient?.lastName ?? "");
  const [email, setEmail] = useState(patient?.email ?? "");
  /**
   * El telefono **nacional**, con la mascara `9 9999 9999`.
   *
   * Se guarda sin el `+56`: ese va fijo al lado del campo (ver el render) y se
   * añade al enviar. Guardarlo dentro obligaria a limpiarlo, y el mismo numero
   * llegaria como `+56912345678` o `912345678` segun como lo escribiera cada
   * uno.
   *
   * Al abrir una ficha existente se pasa por la mascara: el dato puede venir de
   * la web publica o de la app con otra forma (`+56 9 1234 5678`, `964048872`).
   */
  const [phone, setPhone] = useState(() => formatPhoneMask(patient?.phone ?? ""));
  const [isActive, setIsActive] = useState(patient?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * El correo, si se escribe, tiene que ser valido.
   *
   * Vacio es valido: no todos los pacientes usan la app, y exigirlo obligaria a
   * inventar uno. Pero uno mal escrito si se rechaza: es lo que identifica a la
   * persona en la app.
   */
  const emailIsValid =
    email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /**
   * El telefono es **obligatorio al CREAR**, y opcional al editar.
   *
   * ## Por que la diferencia
   *
   * Al crear una ficha nueva, el telefono es el dato que permite avisar de un
   * cambio y el que evita reservas por error o por broma. El backend lo exige
   * desde el punto 5.2 del backlog.
   *
   * Al **editar** no se exige: una ficha antigua puede no tenerlo, y bloquear el
   * guardado obligaria a inventar un numero para poder corregir el nombre. Se
   * pide, pero se puede dejar vacio.
   *
   * Tiene que estar **completo** (9 digitos), no solo empezado: con 2 digitos el
   * campo se valida y la ficha queda con un telefono inutil.
   */
  const phoneDigits = phone.replace(/\D/g, "");

  const phoneIsValid = isEditing
    ? phoneDigits.length === 0 || phoneDigits.length === 9
    : phoneDigits.length === 9;

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailIsValid &&
    phoneIsValid;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!isValid) return;

    setIsSaving(true);

    try {
      if (isEditing && patient) {
        await updatePatient(patient.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          // Vacio se manda como `null` para **borrarlo**; `undefined` lo dejaria
          // como estaba y no habria forma de quitar un telefono equivocado.
          email: email.trim() || null,
          // Se guarda con el pais por delante, para que el dato quede completo y
          // sirva para llamar o escribir sin tener que deducirlo despues.
          phone: phone.trim() ? `${PHONE_PREFIX}${toNationalDigits(phone)}` : null,
          isActive,
        });
        toast.success("Ficha actualizada");
      } else {
        await createPatient({
          tenantId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim()
            ? { phone: `${PHONE_PREFIX}${toNationalDigits(phone)}` }
            : {}),
        });
        toast.success(`${firstName.trim()} quedó registrado`);
      }

      onSaved();
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          isEditing ? "No se pudo actualizar." : "No se pudo crear el paciente.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        data-patient-modal="true"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6"
      >
        <h2 className="text-sm font-bold text-foreground">
          {isEditing ? "Editar paciente" : "Nuevo paciente"}
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                data-patient-first-name="true"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ana"
                autoFocus
                className={inputClass}
              />
            </Field>

            <Field label="Apellido">
              <input
                data-patient-last-name="true"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Correo electrónico (opcional)"
            help="Con este correo el paciente entra a la app a ver sus citas."
          >
            <input
              data-patient-email="true"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@ejemplo.cl"
              className={inputClass}
            />
          </Field>

          <Field
            label={isEditing ? "Teléfono (opcional)" : "Teléfono"}
            help={
              isEditing
                ? "El +56 va fijo. Escribe solo el número. Vacío = sin teléfono."
                : "Obligatorio. El +56 va fijo: escribe solo el número."
            }
          >
            {/**
             * El prefijo va FUERA del input y fijo.
             *
             * Mismo criterio que el registro (`StepBusiness`): si se deja
             * escribir a mano, unos ponen `+56` y otros no, y el dato queda
             * sucio. Aqui solo se escribe el numero nacional.
             */}
            <div className="flex items-stretch overflow-hidden rounded-lg border border-line bg-background focus-within:border-accent">
              <span
                aria-hidden
                data-patient-phone-prefix="true"
                className="flex select-none items-center border-r border-line px-3 text-sm text-text-subtle"
              >
                {PHONE_PREFIX}
              </span>

              <input
                data-patient-phone="true"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="9 6404 8872"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder-text-subtle outline-none"
              />
            </div>
          </Field>

          {/**
           * El interruptor de activo solo al editar.
           *
           * Al crear, un paciente nace activo; ofrecer la opcion ahi seria una
           * decision que nadie toma en el alta.
           */}
          {isEditing ? (
            <label className="flex w-fit items-center gap-2 text-[11px] text-muted">
              <input
                type="checkbox"
                data-patient-active="true"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line-strong bg-surface-raised"
              />
              Activo (puede agendársele una cita)
            </label>
          ) : null}

          {!emailIsValid ? (
            <p className="text-[11px] font-semibold text-danger">
              El correo no tiene un formato válido.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-raised disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="submit"
            data-patient-submit="true"
            disabled={!isValid || isSaving}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground placeholder-text-subtle outline-none focus:border-accent";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
      {help ? <span className="text-[10px] text-text-subtle">{help}</span> : null}
    </label>
  );
}
