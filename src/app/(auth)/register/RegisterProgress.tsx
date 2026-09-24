"use client";

import { Check } from "lucide-react";

interface RegisterProgressProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, label: "Tu cuenta" },
  { id: 2, label: "Tu negocio" },
  { id: 3, label: "Tu plan" },
];

/**
 * Indicador de progreso del registro.
 *
 * Va en una lista ordenada con `aria-current` en el paso activo: un lector de
 * pantalla anuncia "paso 2 de 3" sin depender de los colores.
 */
export function RegisterProgress({ currentStep }: RegisterProgressProps) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const isDone = step.id < currentStep;
        const isCurrent = step.id === currentStep;

        return (
          <li key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  isDone
                    ? "bg-blue-600 text-white"
                    : isCurrent
                      ? "border-2 border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border border-gray-700 text-gray-500"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : step.id}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:block ${
                  isCurrent ? "text-white" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={`h-px w-6 sm:w-10 ${
                  isDone ? "bg-blue-600" : "bg-gray-800"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
