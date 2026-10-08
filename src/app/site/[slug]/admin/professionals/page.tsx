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
        <div className="max-w-md rounded-xl border-red-500/40 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <UserRound className="h-5 w-5 text-amber-300" />
            Profesionales
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Tu equipo y los servicios que ofrece cada uno. La agenda se organiza
            por profesional.
          </p>
        </div>

        <button
          type="button"
          data-create-professional="true"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo profesional
        </button>
      </header>

      {professionals === null ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-stone-400">
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
    <div className="rounded-2xl border border-dashed border-stone-800 p-10 text-center">
      <UserRound className="mx-auto h-6 w-6 text-stone-600" />
      <p className="mt-3 text-sm font-medium text-stone-300">
        Todavía no tienes profesionales
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-stone-500">
        La agenda muestra una columna por profesional. Crea el primero para
        empezar a agendar.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300"
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
}: {
  professional: Professional;
  onEdit: () => void;
  onAssign: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const hasServices = professional.services.length > 0;

  return (
    <article
      data-professional={professional.id}
      className={`rounded-2xl border p-5 transition ${
        professional.isActive
          ? "border-stone-800 bg-stone-950/60"
          : "border-stone-800/60 bg-stone-950/30 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="truncate">
              {professional.firstName} {professional.lastName}
            </span>
            {!professional.isActive ? (
              <span className="shrink-0 rounded bg-stone-800 px-1.5 py-0.5 text-[9px] uppercase text-stone-400">
                Inhabilitado
              </span>
            ) : null}
          </p>

          {professional.licenseNumber ? (
            <p className="mt-0.5 font-mono text-[11px] text-stone-500">
              {professional.licenseNumber}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-edit-professional={professional.id}
            onClick={onEdit}
            title="Editar datos"
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-toggle-professional={professional.id}
            onClick={onToggleActive}
            title={professional.isActive ? "Inhabilitar" : "Reactivar"}
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <Power className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-delete-professional={professional.id}
            onClick={onDelete}
            title="Eliminar"
            className="rounded-md p-1.5 text-stone-400 transition hover:bg-red-500/15 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-stone-800 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Servicios
          </p>

          <button
            type="button"
            data-assign-services={professional.id}
            onClick={onAssign}
            className="rounded-md border border-stone-700 px-2.5 py-1 text-[10px] font-semibold text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            {hasServices ? "Cambiar" : "Asignar servicios"}
          </button>
        </div>

        {hasServices ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {professional.services.map((service) => (
              <span
                key={service.id}
                data-professional-service={service.id}
                className="flex items-center gap-1.5 rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-[10px] text-stone-300"
              >
                <Check className="h-2.5 w-2.5 text-emerald-400" />
                {service.name}
                <span className="text-stone-500">
                  {service.durationInMinutes} min
                </span>
              </span>
            ))}
          </div>
        ) : (
          /* Sin servicios no se le puede agendar nada: el calendario no sabe
             cuanto dura su trabajo. Se avisa aqui, no al intentar reservar. */
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
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
        // El `tenantId` lo exige el DTO del backend; el interceptor ya resuelve
        // el tenant, asi que aqui se manda vacio y lo completa el contexto.
        await createProfessional({
          tenantId: "",
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
        className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-6"
      >
        <h2 className="text-sm font-bold text-white">
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
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="submit"
            data-professional-submit="true"
            disabled={!isValid || isSaving}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
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
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-stone-800 bg-stone-900 p-6"
      >
        <h2 className="text-sm font-bold text-white">
          Servicios de {professional.firstName} {professional.lastName}
        </h2>
        <p className="mt-1 text-xs text-stone-400">
          Marca lo que esta persona puede realizar. Solo se podrá agendar lo que
          esté marcado.
        </p>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {services.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-800 p-4 text-center text-xs text-stone-500">
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
                      ? "border-amber-400/60 bg-amber-400/10"
                      : "border-stone-800 bg-stone-950/60 hover:border-stone-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(service.id)}
                    className="h-4 w-4 shrink-0 rounded border-stone-700 bg-stone-800"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-stone-200">
                      {service.name}
                    </span>
                    <span className="block text-[10px] text-stone-500">
                      {service.durationInMinutes} min
                      {service.price !== null
                        ? ` · $${service.price.toLocaleString("es-CL")}`
                        : " · a convenir"}
                    </span>
                  </span>

                  {isChecked ? (
                    <Check className="h-4 w-4 shrink-0 text-amber-300" />
                  ) : null}
                </label>
              );
            })
          )}
        </div>

        {selected.size === 0 && services.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            Sin servicios no se le puede agendar nada.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-assign-submit="true"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-40"
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
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-6">
        <h2 className="text-sm font-bold text-white">
          Eliminar a {professional.firstName} {professional.lastName}
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-stone-400">
          Esto <strong>borra</strong> al profesional. Si tiene citas agendadas,
          el sistema lo rechazará: en ese caso, usa <strong>inhabilitar</strong>{" "}
          para retirarlo sin perder el historial.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-confirm-delete="true"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder-stone-600 outline-none focus:border-amber-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}
