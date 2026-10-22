"use client";

import { Suspense } from "react";
import {
  DentistAppointmentSection,
  SkincareAppointmentSection,
} from "@multitenant/design-system";

import { ConnectedScheduler } from "@/components/site/ConnectedScheduler";

/**
 * La agenda, envuelta en `Suspense`.
 *
 * ## Por que hace falta
 *
 * `ConnectedScheduler` usa `useSearchParams` para saber si el sitio se abre
 * dentro de la app (`embed=app`). Next **exige** un limite de `Suspense` para ese
 * hook: sin el, la pagina no se puede prerenderizar y el build falla.
 *
 * El `fallback` es `null` a proposito: la agenda ya tarda en cargar sus listas y
 * un esqueleto parpadeando encima del bloque se veria peor que el hueco de un
 * instante.
 */
function withSuspense(scheduler: React.ReactNode) {
  return <Suspense fallback={null}>{scheduler}</Suspense>;
}

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
      schedulerSlot={withSuspense(
        <ConnectedScheduler
          title={props.title ?? "Reserva tu hora en línea"}
          description={props.description}
          accentColor="#FF6B3D"
        />,
      )}
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
      schedulerSlot={withSuspense(
        <ConnectedScheduler
          title={props.title ?? "Reserva tu hora en línea"}
          description={props.description}
          accentColor="#00BDE0"
        />,
      )}
    />
  );
}
