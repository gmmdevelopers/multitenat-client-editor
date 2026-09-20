"use client";

import { useEffect, useState } from "react";
import { AppointmentScheduler } from "@multitenant/design-system";
import type { SchedulerProfessional } from "@multitenant/design-system";

import {
  bookPublicAppointment,
  getPublicAvailability,
  listPublicProfessionals,
} from "@/lib/api/scheduling";
import { getErrorMessage } from "@/lib/api/errors";

interface CurrentSchedulerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  serviceLabel?: string;
  durationInMinutes?: number;
  accentColor?: string;
}

/**
 * Conecta el `AppointmentScheduler` del design system con la API publica.
 *
 * El design system no hace HTTP, asi que este wrapper vive en el cliente y es
 * lo que se inyecta en las paginas de agenda via `schedulerSlot`.
 */
export function ConnectedScheduler({
  eyebrow,
  title,
  description,
  serviceLabel,
  durationInMinutes = 60,
  accentColor,
}: CurrentSchedulerProps) {
  const [professionals, setProfessionals] = useState<SchedulerProfessional[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPublicProfessionals()
      .then((items) =>
        setProfessionals(items.map((p) => ({ id: p.id, fullName: p.fullName }))),
      )
      .catch((err) =>
        setError(getErrorMessage(err, "No pudimos cargar los profesionales.")),
      );
  }, []);

  if (error) {
    return (
      <section className="bg-[#ECF5FB] px-6 py-16 text-center">
        <p className="text-sm text-[#566593]">{error}</p>
      </section>
    );
  }

  return (
    <AppointmentScheduler
      eyebrow={eyebrow}
      title={title}
      description={description}
      serviceLabel={serviceLabel}
      durationInMinutes={durationInMinutes}
      accentColor={accentColor}
      professionals={professionals}
      onLoadSlots={async ({ professionalId, day }) => {
        // La agenda publica trabaja por dia completo: 08:00 a 20:00.
        const windowStartsAt = new Date(`${day}T08:00:00`).toISOString();
        const windowEndsAt = new Date(`${day}T20:00:00`).toISOString();

        const result = await getPublicAvailability({
          professionalId,
          windowStartsAt,
          windowEndsAt,
          appointmentDurationInMinutes: durationInMinutes,
          stepInMinutes: 30,
        });

        return result.slots;
      }}
      onConfirm={async ({ professionalId, slot, patient }) => {
        // Sin `boxId`: el backend usa el primer consultorio activo.
        await bookPublicAppointment({
          professionalId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          patient,
        });
      }}
    />
  );
}
