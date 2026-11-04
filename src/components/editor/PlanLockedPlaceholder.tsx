"use client";

import Link from "next/link";
import { Lock, Trash2 } from "lucide-react";

/**
 * Hueco que sustituye en el lienzo a un bloque que el plan no incluye.
 *
 * ## Por que vive en el EDITOR y no en el design system
 *
 * El design system es agnostico al tenant: no sabe que es un plan, ni cuanto
 * cuesta, ni quien lo paga. Meter facturacion en una libreria que hoy solo
 * describe pixeles contamina el catalogo de bloques.
 *
 * Y ademas no haria falta: `Canvas` decide que pintar por `block.metaName`. Un
 * organismo "bloqueado" solo apareceria si el cliente lo arrastrara, cuando
 * justo lo que queremos es que **no pueda**.
 *
 * ## No se ejecuta el componente real
 *
 * `Canvas` corta ANTES de resolver el componente. Si lo pintara, las props de
 * muestra (productos de ejemplo de la plantilla) se verian como si el cliente
 * las tuviera, venderia cosas que no existen y creeria que la seccion funciona.
 *
 * ## Colores explicitos, no `var(--site-*)`
 *
 * Este aviso vive dentro del lienzo, que aplica el tema del cliente. Con el
 * tema claro, el texto gris quedaba ilegible sobre el fondo del sitio: es
 * interfaz del editor, no de la web.
 */
export function PlanLockedPlaceholder({
  displayName,
  requiredPlanLabel,
  onRemove,
  plansHref,
}: {
  /** Nombre legible del bloque, para que el cliente lo reconozca. */
  displayName: string;
  /** "Pro", "Full"... */
  requiredPlanLabel: string;
  /** Quita el bloque del borrador. */
  onRemove: () => void;
  /** A donde ir para ver los planes. */
  plansHref: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 border-y-2 border-dashed border-amber-500/40 px-6 py-10 text-center"
      style={{ backgroundColor: "#292524" }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
        <Lock className="h-4 w-4" />
      </div>

      <div>
        <p className="text-sm font-medium text-white">
          {displayName} no está incluida en tu plan
        </p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-stone-300">
          Necesita el plan {requiredPlanLabel}. Quítala de esta página o sube de
          plan para usarla. Mientras siga aquí, no se publicará.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-900 transition hover:bg-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Quitar sección
        </button>

        <Link
          href={plansHref}
          className="rounded-md px-3 py-1 text-xs font-medium text-stone-300 transition hover:text-white"
        >
          Ver planes
        </Link>
      </div>
    </div>
  );
}
