"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarPlus } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import {
  createAppointment,
  type CalendarProfessional,
} from "@/lib/api/calendar";
import { listBoxes, createBox, type Box } from "@/lib/api/boxes";
import { listPatients, createPatient, type Patient } from "@/lib/api/patients";
import { listServices, type Service } from "@/lib/api/services";
import { formatTime } from "@/lib/calendar-dates";

interface NewAppointmentModalProps {
  /** Profesional preseleccionado: el de la columna donde se hizo clic. */
  professional: CalendarProfessional;
  /** Inicio sugerido, de la posicion del clic en la rejilla. */
  startsAt: Date;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Modal para agendar una cita desde el calendario.
 *
 * Se elige SERVICIO, no duracion: la duracion sale del servicio y la calcula el
 * backend. Asi el panel y la web publica reservan exactamente igual, y nadie
 * puede crear una cita de una duracion que el negocio no ofrece.
 *
 * El box es obligatorio en el modelo, asi que si el negocio aun no tiene
 * ninguno se ofrece crearlo aqui: obligar a salir a otra seccion romperia el
 * flujo de agendar.
 */
export function NewAppointmentModal({
  professional,
  startsAt,
  onClose,
  onCreated,
}: NewAppointmentModalProps) {
  const toast = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [serviceId, setServiceId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [boxId, setBoxId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Alta rapida: cuando el paciente o el box no existen todavia.
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newBoxName, setNewBoxName] = useState("");
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showNewBox, setShowNewBox] = useState(false);

  useEffect(() => {
    void Promise.all([
      // Solo los servicios que ESTE profesional ofrece: ofrecer los demas
      // llevaria a un rechazo del backend al guardar.
      listServices(),
      listPatients(),
      listBoxes(),
    ])
      .then(([svcs, pats, bxs]) => {
        setServices(svcs);
        setPatients(pats.items);
        setBoxes(bxs.items);
        setBoxId(bxs.items[0]?.id ?? "");
        setShowNewBox(bxs.items.length === 0);
        setShowNewPatient(pats.items.length === 0);
      })
      .catch((err) =>
        toast.error(getErrorMessage(err, "No se pudieron cargar los datos.")),
      )
      .finally(() => setIsLoading(false));
  }, [toast]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  /** Hora de termino, calculada con la duracion del servicio elegido. */
  const endsAt = useMemo(() => {
    if (!selectedService) return null;

    return new Date(
      startsAt.getTime() + selectedService.durationInMinutes * 60 * 1000,
    );
  }, [selectedService, startsAt]);

  /**
   * El telefono de la ficha nueva, solo con digitos y con el pais delante.
   *
   * Se acepta lo que el usuario escriba (`+56 9 1234 5678`, `912345678`) y se
   * normaliza a `+56XXXXXXXXX`, que es el mismo formato que guarda el resto del
   * sistema. Sin esto, la misma ficha tendria formas distintas segun por donde
   * se creara, y el boton de WhatsApp tendria que adivinar el pais otra vez.
   */
  function normalizedPhone(raw: string): string {
    let digits = raw.replace(/\D/g, "");

    if (digits.startsWith("56") && digits.length > 9) {
      digits = digits.slice(2);
    }

    return digits ? `+56${digits}` : "";
  }

  /** Cuantos digitos nacionales hay escritos. */
  const newPatientPhoneDigits = newPatientPhone.replace(/\D/g, "").replace(/^56(?=\d{9})/, "").length;

  /** El alta exige nombre y un telefono **completo** (9 digitos). */
  const canCreatePatient =
    newPatientName.trim().length > 0 && newPatientPhoneDigits === 9;

  async function handleCreatePatient() {
    const name = newPatientName.trim();
    if (!name) return null;

    // El modelo guarda nombre y apellido por separado; se parte por el primer
    // espacio y lo demas va al apellido.
    const [firstName, ...rest] = name.split(/\s+/);

    try {
      const created = await createPatient({
        tenantId: "",
        firstName,
        lastName: rest.join(" ") || "-",
        // Obligatorio desde el punto 5.2 del backlog: sin telefono el negocio
        // no puede avisar de un cambio, y es la via de las reservas por broma.
        phone: normalizedPhone(newPatientPhone),
      });

      setPatients((current) => [...current, created]);
      setPatientId(created.id);
      setShowNewPatient(false);
      setNewPatientName("");
      setNewPatientPhone("");
      toast.success("Paciente creado");

      return created.id;
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo crear el paciente."));
      return null;
    }
  }

  async function handleCreateBox() {
    const name = newBoxName.trim();
    if (!name) return null;

    try {
      const created = await createBox({ tenantId: "", name });
      setBoxes((current) => [...current, created]);
      setBoxId(created.id);
      setShowNewBox(false);
      setNewBoxName("");
      toast.success("Sala creada");

      return created.id;
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo crear la sala."));
      return null;
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const resolvedPatientId = patientId;
    if (!serviceId || !resolvedPatientId || !boxId) return;

    setIsSaving(true);
    try {
      await createAppointment({
        patientId: resolvedPatientId,
        professionalId: professional.id,
        boxId,
        serviceId,
        startsAt: startsAt.toISOString(),
      });

      toast.success(`Cita agendada para las ${formatTime(startsAt)}`);
      onCreated();
    } catch (err) {
      toast.error(
        getErrorMessage(err, "No se pudo agendar. Revisa el horario."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isValid = Boolean(serviceId && patientId && boxId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        data-new-appointment-modal="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-stone-800 bg-stone-900 p-6"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <CalendarPlus className="h-4 w-4 text-amber-300" />
          Nueva cita
        </h2>

        <p className="mt-1 text-xs text-stone-400">
          {professional.name} ·{" "}
          {startsAt.toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          a las{" "}
          <strong className="text-stone-300">{formatTime(startsAt)}</strong>
          {endsAt ? (
            <>
              {" → "}
              <strong className="text-stone-300">
                {formatTime(endsAt)}
              </strong>{" "}
              <span className="text-stone-500">
                ({selectedService?.durationInMinutes} min)
              </span>
            </>
          ) : null}
        </p>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-stone-400">
            Cargando...
          </p>
        ) : (
          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {/* Servicio */}
            <Field label="Servicio">
              {services.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-800 p-3 text-center text-[11px] text-stone-500">
                  No hay servicios. Créalos en la sección Servicios.
                </p>
              ) : (
                <select
                  data-appointment-service="true"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Elige un servicio…</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.durationInMinutes} min
                      {service.price !== null
                        ? ` · $${service.price.toLocaleString("es-CL")}`
                        : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {/* Paciente */}
            <Field label="Paciente">
              {showNewPatient ? (
                <div className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                  <p className="text-[11px] text-stone-400">
                    {patients.length === 0
                      ? "Todavía no hay pacientes. Crea el primero:"
                      : "Nuevo paciente:"}
                  </p>
                  <input
                    data-new-patient-name="true"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Nombre y apellido"
                    className={inputClass}
                  />
                  <input
                    data-new-patient-phone="true"
                    type="tel"
                    inputMode="numeric"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder="Teléfono (obligatorio) · 9 1234 5678"
                    required
                    className={inputClass}
                  />
                  <div className="flex justify-end gap-2">
                    {patients.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowNewPatient(false)}
                        className="rounded-md px-2 py-1 text-[11px] text-stone-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      data-create-patient="true"
                      onClick={() => void handleCreatePatient()}
                      disabled={!canCreatePatient}
                      className="rounded-md bg-amber-400 px-3 py-1 text-[11px] font-bold text-black disabled:opacity-40"
                    >
                      Crear paciente
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    data-appointment-patient="true"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige un paciente…</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowNewPatient(true)}
                    className="shrink-0 rounded-lg border border-stone-700 px-3 text-[11px] font-semibold text-stone-300 transition hover:bg-stone-800"
                  >
                    Nuevo
                  </button>
                </div>
              )}
            </Field>

            {/* Box */}
            <Field label="Sala">
              {showNewBox ? (
                <div className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
                  <p className="text-[11px] text-stone-400">
                    {boxes.length === 0
                      ? "Todavía no hay salas. Crea la primera:"
                      : "Nueva sala:"}
                  </p>
                  <input
                    data-new-box-name="true"
                    value={newBoxName}
                    onChange={(e) => setNewBoxName(e.target.value)}
                    placeholder="Sala 1"
                    className={inputClass}
                  />
                  <div className="flex justify-end gap-2">
                    {boxes.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowNewBox(false)}
                        className="rounded-md px-2 py-1 text-[11px] text-stone-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      data-create-box="true"
                      onClick={() => void handleCreateBox()}
                      disabled={!newBoxName.trim()}
                      className="rounded-md bg-amber-400 px-3 py-1 text-[11px] font-bold text-black disabled:opacity-40"
                    >
                      Crear sala
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    data-appointment-box="true"
                    value={boxId}
                    onChange={(e) => setBoxId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elige una sala…</option>
                    {boxes.map((box) => (
                      <option key={box.id} value={box.id}>
                        {box.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowNewBox(true)}
                    className="shrink-0 rounded-lg border border-stone-700 px-3 text-[11px] font-semibold text-stone-300 transition hover:bg-stone-800"
                  >
                    Nueva
                  </button>
                </div>
              )}
            </Field>

            {/* Aviso util: el backend rechaza si la cita no cabe en el horario
                o si ya hay otra. Decirlo antes evita el error. */}
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-stone-500">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              La cita debe caber dentro del horario del profesional y no
              solaparse con otra. Si no cabe, el sistema lo avisará.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-stone-800 pt-4">
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
            data-create-appointment="true"
            disabled={!isValid || isSaving || isLoading}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Agendando..." : "Agendar cita"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-200 outline-none focus:border-amber-400";

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
