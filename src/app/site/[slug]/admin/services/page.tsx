"use client";

import { useEffect, useState } from "react";
import { Clock, DollarSign, Pencil, Plus, Power, Tag, Users } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { canEditSection } from "@/lib/role-routing";
import { ReadOnlyNotice } from "@/components/ReadOnlySection";
import { getErrorMessage } from "@/lib/api/errors";
import {
  createService,
  deactivateService,
  listServices,
  updateService,
  type Service,
} from "@/lib/api/services";

/** Formato de precio en pesos, sin decimales. */
function formatPrice(value: number | null): string {
  if (value === null) return "A convenir";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

/** `90` -> `1 h 30 min`. Es como se lee una duracion en la practica. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Catalogo de servicios del negocio.
 *
 * Un servicio define CUANTO DURA una cita y CUANTO CUESTA: es lo que el cliente
 * elige al agendar, y de donde sale el termino. Por eso la duracion es lo
 * primero que se ve en cada tarjeta.
 */
export default function ServicesPage() {
  const toast = useToast();
  const { user } = useAuth();

  /**
   * El rol decide entre mostrar los controles o el aviso de solo lectura.
   *
   * `owner` y `admin` editan; el `receptionist` solo consulta. Se calcula una
   * vez aqui y no en cada boton, para que la regla viva en un solo sitio.
   */
  const canEdit = user ? canEditSection(user.role, "services") : false;

  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<Service | null>(
    null,
  );

  async function load(includeInactive: boolean) {
    try {
      setServices(await listServices({ includeInactive }));
      setError(null);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudieron cargar los servicios.");
      setError(message);
      toast.error(message);
    }
  }

  useEffect(() => {
    void load(showInactive);
  }, [showInactive]);

  async function handleDeactivate(service: Service) {
    try {
      await deactivateService(service.id);
      toast.success(`"${service.name}" quedó inhabilitado`);
      setPendingDeactivate(null);
      void load(showInactive);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo inhabilitar el servicio."));
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
            <Tag className="h-5 w-5 text-accent-strong" />
            Servicios
          </h1>
          <p className="mt-1 text-sm text-muted">
            Lo que ofreces, cuánto dura y cuánto cuesta. Cada cita se agenda con
            un servicio.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            data-create-service="true"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-on-accent transition hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo servicio
          </button>
        ) : null}
      </header>

      {/*
        Aviso de solo lectura para quien no administra el negocio.

        El recepcionista VE los servicios (los necesita para responder precios y
        duraciones) pero no los edita: son del negocio. El aviso sustituye a los
        botones de creacion, que le daran 403 en el backend.
      */}
      {canEdit ? null : (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      {/* Interruptor de inactivos: por defecto no se ven, porque un servicio
          inhabilitado solo interesa para entender citas pasadas. */}
      <label className="mb-4 flex w-fit items-center gap-2 text-[11px] text-muted">
        <input
          type="checkbox"
          data-show-inactive="true"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line-strong bg-surface-raised"
        />
        Mostrar servicios inhabilitados
      </label>

      {services === null ? (
        <div className="flex justify-center py-16">
          <span className="animate-pulse text-sm text-muted">
            Cargando servicios...
          </span>
        </div>
      ) : services.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} />
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => setEditing(service)}
              onDeactivate={() => setPendingDeactivate(service)}
              // El recepcionista ve la tarjeta sin las acciones: son del negocio.
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {editing ? (
        <ServiceModal
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load(showInactive);
          }}
        />
      ) : null}

      {pendingDeactivate ? (
        <ConfirmDeactivateModal
          service={pendingDeactivate}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => void handleDeactivate(pendingDeactivate)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <Tag className="mx-auto h-6 w-6 text-text-subtle" />
      <p className="mt-3 text-sm font-medium text-foreground">
        Todavía no tienes servicios
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">
        Un servicio define cuánto dura una cita. Sin servicios, la agenda no sabe
        cuándo termina cada reserva.
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

function ServiceCard({
  service,
  onEdit,
  onDeactivate,
  canEdit,
}: {
  service: Service;
  onEdit: () => void;
  onDeactivate: () => void;
  /** `false` = solo lectura: se ve la tarjeta, sin los botones de accion. */
  canEdit: boolean;
}) {
  const professionalCount = service._count?.professionals ?? 0;
  const isOrphan = professionalCount === 0;

  return (
    <article
      data-service={service.id}
      className={`rounded-2xl border p-5 transition ${
        service.isActive
          ? "border-line bg-background/60"
          : "border-line/60 bg-background/30 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* El color es el del calendario: verlo aqui conecta las dos vistas. */}
          <span
            className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: service.color ?? "#78716C" }}
          />

          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="truncate">{service.name}</span>
              {!service.isActive ? (
                <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[9px] uppercase text-muted">
                  Inhabilitado
                </span>
              ) : null}
            </p>

            {service.description ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                {service.description}
              </p>
            ) : null}
          </div>
        </div>

        {/*
          Las acciones van JUNTAS y solo si el rol puede editar.

          Se oculta el bloque entero y no cada boton: con uno solo escondido, el
          contenedor quedaria con su `gap` y se veria un hueco raro.
        */}
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-edit-service={service.id}
              onClick={onEdit}
              title="Editar"
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {service.isActive ? (
              <button
                type="button"
                data-deactivate-service={service.id}
                onClick={onDeactivate}
                title="Inhabilitar"
                className="rounded-md p-1.5 text-muted transition hover:bg-danger/15 hover:text-danger"
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[11px]">
        <span className="flex items-center gap-1.5 text-foreground">
          <Clock className="h-3.5 w-3.5 text-text-subtle" />
          {formatDuration(service.durationInMinutes)}
        </span>

        <span className="flex items-center gap-1.5 text-foreground">
          <DollarSign className="h-3.5 w-3.5 text-text-subtle" />
          {formatPrice(service.price)}
        </span>

        {/* Sin profesionales el servicio no se puede agendar: se avisa aqui y no
            se descubre al intentar reservar. */}
        <span
          className={`flex items-center gap-1.5 ${
            isOrphan ? "text-accent-strong" : "text-muted"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          {isOrphan
            ? "Sin profesionales asignados"
            : `${professionalCount} profesional${professionalCount === 1 ? "" : "es"}`}
        </span>
      </div>
    </article>
  );
}

/**
 * Modal de crear/editar.
 *
 * Es el mismo para las dos acciones: los campos son identicos y duplicarlo
 * obligaria a mantener dos formularios sincronizados.
 */
function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEditing = Boolean(service);

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(
    service ? String(service.durationInMinutes) : "",
  );
  const [price, setPrice] = useState(
    service?.price !== null && service?.price !== undefined
      ? String(service.price)
      : "",
  );
  const [color, setColor] = useState(service?.color ?? "#6366F1");
  const [isSaving, setIsSaving] = useState(false);

  const durationNumber = Number(duration);
  const isValid =
    name.trim().length >= 2 &&
    Number.isInteger(durationNumber) &&
    durationNumber >= 5 &&
    durationNumber <= 720;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!isValid) return;

    setIsSaving(true);
    try {
      // El precio vacio se manda como `null` y no como 0: "a convenir" no es
      // "gratis", y un 0 guardado se mostraria como $0.
      const priceValue = price.trim() === "" ? null : Number(price);

      if (isEditing && service) {
        await updateService(service.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          durationInMinutes: durationNumber,
          price: priceValue,
          color,
        });
        toast.success("Servicio actualizado");
      } else {
        await createService({
          name: name.trim(),
          description: description.trim() || undefined,
          durationInMinutes: durationNumber,
          // En creacion se omite en vez de mandar `null`: el DTO lo tipa como
          // `number | undefined`, y un servicio sin precio es simplemente uno
          // que no lo declara.
          ...(priceValue !== null ? { price: priceValue } : {}),
          color,
        });
        toast.success("Servicio creado");
      }

      onSaved();
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          isEditing ? "No se pudo actualizar." : "No se pudo crear el servicio.",
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
        data-service-modal="true"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6"
      >
        <h2 className="text-sm font-bold text-foreground">
          {isEditing ? "Editar servicio" : "Nuevo servicio"}
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <Field label="Nombre">
            <input
              data-service-name="true"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masaje cuerpo completo"
              autoFocus
              className={inputClass}
            />
          </Field>

          <Field label="Descripción (opcional)">
            <textarea
              data-service-description="true"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Masaje relajante de cuerpo entero."
              className={`${inputClass} resize-y`}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Duración (minutos)"
              help="Define cuándo termina cada cita."
            >
              <input
                data-service-duration="true"
                type="number"
                min={5}
                max={720}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="50"
                className={inputClass}
              />
            </Field>

            <Field label="Precio en CLP (opcional)" help="Vacío = a convenir.">
              <input
                data-service-price="true"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25000"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Color en el calendario">
            <span className="flex items-center gap-3">
              <input
                data-service-color="true"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-background"
              />
              <span className="font-mono text-[11px] text-text-subtle">
                {color}
              </span>
            </span>
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
            data-service-submit="true"
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

function ConfirmDeactivateModal({
  service,
  onCancel,
  onConfirm,
}: {
  service: Service;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-bold text-foreground">
          Inhabilitar «{service.name}»
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          Dejará de ofrecerse en la agenda, pero <strong>no se borra</strong>: las
          citas que ya se agendaron con él conservan su historial. Puedes
          reactivarlo cuando quieras editándolo.
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
            data-confirm-deactivate="true"
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-xs font-bold text-foreground transition hover:bg-danger"
          >
            Sí, inhabilitar
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
