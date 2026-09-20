"use client";

import { ConnectedScheduler } from "@/components/site/ConnectedScheduler";

interface ConnectedSchedulerBlockProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  serviceLabel?: string;
  durationInMinutes?: number;
  accentColor?: string;
}

/**
 * Adaptador del bloque de agenda para el editor.
 *
 * El `AppointmentScheduler` del design system no recibe props serializables
 * (`onLoadSlots` y `onConfirm` son funciones), asi que el editor no puede
 * guardarlas. Este adaptador recibe solo las props que si se persisten y
 * cablea internamente la API publica.
 */
export function ConnectedSchedulerBlock({
  eyebrow,
  title,
  description,
  serviceLabel,
  durationInMinutes = 60,
  accentColor,
}: ConnectedSchedulerBlockProps) {
  return (
    <ConnectedScheduler
      eyebrow={eyebrow}
      title={title ?? "Reserva tu hora en línea"}
      description={description}
      serviceLabel={serviceLabel}
      durationInMinutes={durationInMinutes}
      accentColor={accentColor ?? "#00BDE0"}
    />
  );
}
