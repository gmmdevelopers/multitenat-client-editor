"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserRound,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { canEditSection } from "@/lib/role-routing";
import { ReadOnlyNotice } from "@/components/ReadOnlySection";
import { getErrorMessage } from "@/lib/api/errors";
import {
  createProfessional,
  deleteProfessional,
  listProfessionals,
  setProfessionalServices,
  updateProfessional,
  type Professional,
} from "@/lib/api/professionals";
import { listServices, type Service } from "@/lib/api/services";

/**
 * Profesionales del negocio y los servicios que ofrece cada uno.
 *
 * La asignacion de servicios es lo que hace que un profesional sea agendable:
 * sin servicios, el calendario no puede calcularle huecos porque no sabe cuanto
 * dura nada de lo que haria.
 */
export default function ProfessionalsPage() {
  const toast = useToast();
  const { user } = useAuth();

  /**
   * El equipo lo administra el dueno, no recepcion.
   *
   * Crear o borrar un profesional es **alta de equipo**: cambia quien aparece en
   * la agenda y a quien se le pueden asignar citas. Recepcion necesita **verlo**
   * (para saber quien atiende y agendar), pero no darlo de alta ni quitarlo.
   */
  const canEdit = user ? canEditSection(user.role, "professionals") : false;

  const [professionals, setProfessionals] = useState<Professional[] | null>(
    null,
  );
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const [assigning, setAssigning] = useState<Professional | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Professional | null>(null);

  async function load() {
    try {
      const [pros, svcs] = await Promise.all([
        listProfessionals(),
        listServices(),
      ]);
      setProfessionals(pros.items);
      setServices(svcs);
      setError(null);
    } catch (err) {
      const message = getErrorMessage(
        err,
        "No se pudieron cargar los profesionales.",
      );
      setError(message);
      toast.error(message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /**
   * Inhabilita o reactiva.
   *
   * Es la alternativa a borrar: un profesional con citas no se puede eliminar
   * sin romper el historial, pero si dejar de ofrecerlo.
   */
  async function handleToggleActive(professional: Professional) {
    try {
      await updateProfessional(professional.id, {
        isActive: !professional.isActive,
      });
      toast.success(
        professional.isActive
          ? `${professional.firstName} quedó inhabilitado`
          : `${professional.firstName} volvió a estar disponible`,
      );
      void load();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el estado."));
    }
  }

  async function handleDelete(professional: Professional) {
    try {
      await deleteProfessional(professional.id);
      toast.success(`${professional.firstName} fue eliminado`);
      setPendingDelete(null);
      void load();
    } catch (err) {
      // El backend rechaza borrar a alguien con citas: se explica la salida en
      // vez de dejar un error tecnico sin alternativa.
      toast.error(
        getErrorMessage(
          err,
          "No se pudo eliminar. Si tiene citas, inhabilítalo en vez de borrarlo.",
        ),
      );
      setPendingDelete(null);
    }
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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <UserRound className="h-5 w-5 text-accent-strong" />
            Profesionales
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tu equipo y los servicios que ofrece cada uno. La agenda se organiza
            por profesional.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            data-create-professional="true"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo profesional
          </button>
        ) : null}
      </header>

      {/* Aviso de solo lectura: ve el equipo, no lo administra. */}
      {canEdit ? null : (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      {professionals === null ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-muted">
            Cargando profesionales...
          </span>
        </div>
      ) : professionals.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} />
      ) : (
        <div className="flex flex-col gap-3">
          {professionals.map((professional) => (
            <ProfessionalCard
              key={professional.id}
              professional={professional}
              canEdit={canEdit}
              onEdit={() => setEditing(professional)}
              onAssign={() => setAssigning(professional)}
              onToggleActive={() => void handleToggleActive(professional)}
              onDelete={() => setPendingDelete(professional)}
            />
          ))}
        </div>
      )}

      {editing ? (
        <ProfessionalModal
          professional={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}

      {assigning ? (
        <AssignServicesModal
          professional={assigning}
          services={services}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            void load();
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          professional={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete(pendingDelete)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <UserRound className="mx-auto h-6 w-6 text-text-subtle" />
      <p className="mt-3 text-sm font-medium text-foreground">
        Todavía no tienes profesionales
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">
        La agenda muestra una columna por profesional. Crea el primero para
        empezar a agendar.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
      >
        Crear el primero
      </button>
    </div>
  );
}

function ProfessionalCard({
  professional,
  onEdit,
  onAssign,
  onToggleActive,
  onDelete,
  canEdit,
}: {
  professional: Professional;
  onEdit: () => void;
  onAssign: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  /** `false` = solo lectura: se ve la ficha, sin las acciones del equipo. */
  canEdit: boolean;
}) {
  const hasServices = professional.services.length > 0;

  return (
    <article
      data-professional={professional.id}
      className={`rounded-2xl border p-5 transition ${
        professional.isActive
          ? "border-line bg-background/60"
          : "border-line/60 bg-background/30 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="truncate">
              {professional.firstName} {professional.lastName}
            </span>
            {!professional.isActive ? (
              <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[9px] uppercase text-muted">
                Inhabilitado
              </span>
            ) : null}
          </p>

          {professional.licenseNumber ? (
            <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
              {professional.licenseNumber}
            </p>
          ) : null}
        </div>

        {/* Las tres acciones van juntas y solo si el rol administra el equipo. */}
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-edit-professional={professional.id}
              onClick={onEdit}
              title="Editar datos"
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              data-toggle-professional={professional.id}
              onClick={onToggleActive}
              title={professional.isActive ? "Inhabilitar" : "Reactivar"}
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              <Power className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              data-delete-professional={professional.id}
              onClick={onDelete}
              title="Eliminar"
              className="rounded-md p-1.5 text-muted transition hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            Servicios
          </p>

          {/*
            Asignar servicios es editar el equipo, no operarlo.

            Quien atiende no decide que ofrece: eso lo administra el negocio. El
            recepcionista ve los servicios de cada profesional (para saber que se
            le puede agendar) pero no los cambia. Ademas el endpoint es
            `@Roles("owner", "admin")`, asi que el boton solo daria 403.
          */}
          {canEdit ? (
            <button
              type="button"
              data-assign-services={professional.id}
              onClick={onAssign}
              className="rounded-md border border-line-strong px-2.5 py-1 text-[10px] font-semibold text-foreground transition hover:bg-surface-raised hover:text-foreground"
            >
              {hasServices ? "Cambiar" : "Asignar servicios"}
            </button>
          ) : null}
        </div>

        {hasServices ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {professional.services.map((service) => (
              <span
                key={service.id}
                data-professional-service={service.id}
                className="flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[10px] text-foreground"
              >
                <Check className="h-2.5 w-2.5 text-success" />
                {service.name}
                <span className="text-text-subtle">
                  {service.durationInMinutes} min
                </span>
              </span>
            ))}
          </div>
        ) : (
          /* Sin servicios no se le puede agendar nada: el calendario no sabe
             cuanto dura su trabajo. Se avisa aqui, no al intentar reservar. */
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-accent-strong">
            <AlertCircle className="h-3.5 w-3.5" />
            Sin servicios asignados: no se le puede agendar todavía
          </p>
        )}
      </div>
    </article>
  );
}

function ProfessionalModal({
  professional,
  onClose,
  onSaved,
}: {
  professional: Professional | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  /**
   * El id del tenant, para el cuerpo de la peticion.
   *
   * El backend lo compara con el de la sesion (`assertTenantBodyContext`), asi
   * que tiene que ser el real: mandarlo vacio hacia fallar la creacion.
   */
  const { tenant } = useAuth();
  const isEditing = Boolean(professional);
  const [firstName, setFirstName] = useState(professional?.firstName ?? "");
  const [lastName, setLastName] = useState(professional?.lastName ?? "");
  const [licenseNumber, setLicenseNumber] = useState(
    professional?.licenseNumber ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    setIsSaving(true);
    try {
      if (isEditing && professional) {
        await updateProfessional(professional.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          licenseNumber: licenseNumber.trim() || undefined,
        });
        toast.success("Profesional actualizado");
      } else {
        /**
         * `tenantId` va el **id real** del tenant.
         *
         * ## El bug que arregla
         *
         * Aqui se mandaba `""` con un comentario que decia que "el interceptor
         * ya resuelve el tenant". **Era falso**: el interceptor reenvia la
         * cookie `x-tenant-slug` (para que el backend sepa QUE tenant), pero no
         * rellena el cuerpo de la peticion.
         *
         * Y el backend compara los dos (`assertTenantBodyContext`): si el del
         * cuerpo no coincide con el de la sesion, responde 400. Con `""`
         * **siempre** fallaba, asi que crear un profesional desde el panel
         * estaba roto.
         */
        await createProfessional({
          // `tenant` viene del contexto de sesion; el modal solo se monta con
          // sesion activa, asi que el fallback no deberia alcanzarse.
          tenantId: tenant?.id ?? "",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          licenseNumber: licenseNumber.trim() || undefined,
        });
        toast.success("Profesional creado");
      }

      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo guardar el profesional."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        data-professional-modal="true"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6"
      >
        <h2 className="text-sm font-bold text-foreground">
          {isEditing ? "Editar profesional" : "Nuevo profesional"}
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                data-professional-first-name="true"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ana"
                autoFocus
                className={inputClass}
              />
            </Field>

            <Field label="Apellido">
              <input
                data-professional-last-name="true"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Número de licencia (opcional)">
            <input
              data-professional-license="true"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="LIC-001"
              className={inputClass}
            />
          </Field>
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
            data-professional-submit="true"
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

/**
 * Asignacion de servicios.
 *
 * Casillas y no una lista con botones de añadir: son pocos servicios y el
 * cliente ve de un vistazo que ofrece y que no. El backend reemplaza la lista
 * completa, asi que desmarcar quita de verdad.
 */
function AssignServicesModal({
  professional,
  services,
  onClose,
  onSaved,
}: {
  professional: Professional;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();

  const [selected, setSelected] = useState<Set<string>>(
    new Set(professional.services.map((s) => s.id)),
  );
  const [isSaving, setIsSaving] = useState(false);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await setProfessionalServices(professional.id, [...selected]);
      toast.success(
        selected.size === 0
          ? "Sin servicios: no se le podrá agendar"
          : `${selected.size} servicio${selected.size === 1 ? "" : "s"} asignado${selected.size === 1 ? "" : "s"}`,
      );
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo asignar los servicios."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-assign-modal="true"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-line bg-surface p-6"
      >
        <h2 className="text-sm font-bold text-foreground">
          Servicios de {professional.firstName} {professional.lastName}
        </h2>
        <p className="mt-1 text-xs text-muted">
          Marca lo que esta persona puede realizar. Solo se podrá agendar lo que
          esté marcado.
        </p>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {services.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-text-subtle">
              Todavía no tienes servicios. Créalos primero en la sección
              Servicios.
            </p>
          ) : (
            services.map((service) => {
              const isChecked = selected.has(service.id);

              return (
                <label
                  key={service.id}
                  data-assign-option={service.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    isChecked
                      ? "border-accent/60 bg-accent/10"
                      : "border-line bg-background/60 hover:border-line-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(service.id)}
                    className="h-4 w-4 shrink-0 rounded border-line-strong bg-surface-raised"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {service.name}
                    </span>
                    <span className="block text-[10px] text-text-subtle">
                      {service.durationInMinutes} min
                      {service.price !== null
                        ? ` · $${service.price.toLocaleString("es-CL")}`
                        : " · a convenir"}
                    </span>
                  </span>

                  {isChecked ? (
                    <Check className="h-4 w-4 shrink-0 text-accent-strong" />
                  ) : null}
                </label>
              );
            })
          )}
        </div>

        {selected.size === 0 && services.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-accent-strong">
            <AlertCircle className="h-3.5 w-3.5" />
            Sin servicios no se le puede agendar nada.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-raised disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-assign-submit="true"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong disabled:opacity-40"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  professional,
  onCancel,
  onConfirm,
}: {
  professional: Professional;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-bold text-foreground">
          Eliminar a {professional.firstName} {professional.lastName}
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          Esto <strong>borra</strong> al profesional. Si tiene citas agendadas,
          el sistema lo rechazará: en ese caso, usa <strong>inhabilitar</strong>{" "}
          para retirarlo sin perder el historial.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-raised"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-confirm-delete="true"
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-foreground transition hover:bg-danger"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground placeholder-text-subtle outline-none focus:border-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
