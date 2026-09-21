"use client";

import {
  DentistAppointmentSection,
  SkincareAppointmentSection,
} from "@multitenant/design-system";

import { ConnectedScheduler } from "@/components/site/ConnectedScheduler";

interface AppointmentSectionBlockProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  imageSrc?: string;
  highlights?: string[];
  contactDetails?: { label: string; value: string; href?: string; icon?: string }[];
  accentColor?: string;
  surfaceColor?: string;
}

/**
 * Secciones de agenda por vertical, ya cableadas a la API.
 *
 * El design system expone `DentistAppointmentSection` y
 * `SkincareAppointmentSection` como bloques presentacionales que admiten un
 * `schedulerSlot`. Aqui les inyectamos la agenda conectada, para que funcionen
 * igual en el editor y en la web publica.
 */
export function DentistAppointmentSectionConnected(
  props: AppointmentSectionBlockProps,
) {
  return (
    <DentistAppointmentSection
      {...(props as any)}
      highlights={props.highlights ?? []}
      contactDetails={props.contactDetails ?? []}
      schedulerSlot={
        <ConnectedScheduler
          title={props.title ?? "Reserva tu hora en línea"}
          description={props.description}
          accentColor="#FF6B3D"
        />
      }
    />
  );
}

export function SkincareAppointmentSectionConnected(
  props: AppointmentSectionBlockProps,
) {
  return (
    <SkincareAppointmentSection
      {...(props as any)}
      highlights={props.highlights ?? []}
      contactDetails={props.contactDetails ?? []}
      schedulerSlot={
        <ConnectedScheduler
          title={props.title ?? "Reserva tu hora en línea"}
          description={props.description}
          accentColor="#00BDE0"
        />
      }
    />
  );
}
