"use client";

import { useEffect, useState } from "react";

import {
  getBusinessTypes,
  type BusinessTypeOption,
} from "@/lib/api/registration";
import {
  Field,
  hintClass,
  inputClass,
  inputErrorClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./fields";
import {
  formatPhoneMask,
  isPhoneComplete,
  isValidRut,
  PHONE_PREFIX,
  slugify,
  type RegistrationDraft,
} from "./registration-utils";

interface StepBusinessProps {
  draft: RegistrationDraft;
  onChange: (patch: Partial<RegistrationDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Paso 2: el negocio.
 *
 * El rubro se pregunta como "a que se dedica tu negocio", NO como "tipo de
 * negocio": si el cliente viera valores como `skincare` creeria que esta
 * eligiendo el diseño de su web, cuando en realidad es un dato interno.
 */
export function StepBusiness({
  draft,
  onChange,
  onNext,
  onBack,
}: StepBusinessProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeOption[]>([]);
  const [typesError, setTypesError] = useState<string | null>(null);

  // Los rubros vienen del backend para no duplicar la lista aqui.
  useEffect(() => {
    let cancelled = false;

    void getBusinessTypes()
      .then((options) => {
        if (!cancelled) setBusinessTypes(options);
      })
      .catch(() => {
        if (!cancelled) {
          setTypesError(
            "No pudimos cargar los rubros. Recarga la pagina e intenta de nuevo.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    errors.name = "El nombre de tu negocio es obligatorio.";
  }

  if (!draft.businessType) {
    errors.businessType = "Elige a que se dedica tu negocio.";
  }

  if (!draft.taxId.trim()) {
    errors.taxId = "El RUT es obligatorio.";
  } else if (!isValidRut(draft.taxId)) {
    errors.taxId = "Ese RUT no es valido. Revisa el digito verificador.";
  }

  if (!draft.phone.trim()) {
    errors.phone = "Necesitamos un telefono de contacto.";
  } else if (!isPhoneComplete(draft.phone)) {
    // El mensaje dice cuantos digitos faltan en vez de un "invalido" generico:
    // con una mascara, lo util es saber que esta incompleto.
    errors.phone = "El telefono debe tener 9 digitos (ej: 9 9999 9999).";
  }

  if (!draft.slug) {
    errors.slug = "Elige la direccion de tu sitio.";
  }

  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (name: string) =>
    touched[name] ? errors[name] : undefined;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({
      name: true,
      businessType: true,
      taxId: true,
      phone: true,
      slug: true,
    });

    if (!hasErrors) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-white">Tu negocio</h2>
        <p className="mt-1 text-xs text-gray-400">
          Estos datos apareceran en tu sitio y en la boleta.
        </p>
      </div>

      <Field
        label="Nombre del negocio"
        htmlFor="name"
        error={fieldError("name")}
      >
        <input
          id="name"
          data-testid="register-name"
          type="text"
          value={draft.name}
          onChange={(e) => {
            const name = e.target.value;
            // El identificador se propone a partir del nombre, pero SOLO si el
            // usuario no lo ha tocado: si ya lo escribio a mano, sobreescribirlo
            // mientras teclea el nombre seria desconcertante.
            const shouldSyncSlug =
              !touched.slug || draft.slug === slugify(draft.name);
            onChange(shouldSyncSlug ? { name, slug: slugify(name) } : { name });
          }}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="Clinica Los Andes"
          className={fieldError("name") ? inputErrorClass : inputClass}
        />
      </Field>

      <Field
        label="A que se dedica tu negocio"
        htmlFor="businessType"
        error={fieldError("businessType")}
        hint="Nos ayuda a entender que tipo de negocios usan la plataforma."
      >
        <select
          id="businessType"
          data-testid="register-businessType"
          value={draft.businessType}
          onChange={(e) => onChange({ businessType: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, businessType: true }))}
          disabled={businessTypes.length === 0}
          className={fieldError("businessType") ? inputErrorClass : inputClass}
        >
          <option value="">
            {typesError ? "No se pudieron cargar" : "Selecciona una opcion"}
          </option>
          {businessTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {typesError ? (
          <p className="mt-1 text-[11px] text-red-400">{typesError}</p>
        ) : null}
      </Field>

      <Field
        label="Razon social"
        htmlFor="legalName"
        hint="Opcional. Si la omites, usamos el nombre del negocio."
      >
        <input
          id="legalName"
          data-testid="register-legalName"
          type="text"
          value={draft.legalName}
          onChange={(e) => onChange({ legalName: e.target.value })}
          placeholder="Clinica Los Andes SpA"
          className={inputClass}
        />
      </Field>

      <Field
        label="RUT"
        htmlFor="taxId"
        error={fieldError("taxId")}
        hint="Con digito verificador. Ej: 12.345.678-5"
      >
        <input
          id="taxId"
          data-testid="register-taxId"
          type="text"
          value={draft.taxId}
          onChange={(e) => onChange({ taxId: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, taxId: true }))}
          placeholder="12.345.678-5"
          className={fieldError("taxId") ? inputErrorClass : inputClass}
        />
      </Field>

      <Field
        label="Telefono"
        htmlFor="phone"
        error={fieldError("phone")}
        hint="Celular de contacto para coordinar la configuracion."
      >
        <div
          className={`flex items-stretch overflow-hidden rounded-lg border bg-gray-950 focus-within:border-blue-500 ${
            fieldError("phone") ? "border-red-500" : "border-gray-800"
          }`}
        >
          {/* El prefijo es fijo y no editable: el producto es solo para Chile,
              y dejarlo escribir a mano invita a que unos pongan +56 y otros no,
              ensuciando el dato. */}
          <span
            aria-hidden
            className="flex select-none items-center border-r border-gray-800 px-3 text-sm text-gray-500"
          >
            {PHONE_PREFIX}
          </span>
          <input
            id="phone"
            data-testid="register-phone"
            type="tel"
            inputMode="numeric"
            value={draft.phone}
            onChange={(e) =>
              onChange({ phone: formatPhoneMask(e.target.value) })
            }
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            placeholder="9 9999 9999"
            className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
          />
        </div>
      </Field>

      <div>
        <label htmlFor="slug" className={labelClass}>
          Direccion de tu sitio
        </label>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-800 bg-gray-950 focus-within:border-blue-500">
          <input
            id="slug"
            data-testid="register-slug"
            type="text"
            value={draft.slug}
            onChange={(e) => onChange({ slug: slugify(e.target.value) })}
            onBlur={() => setTouched((t) => ({ ...t, slug: true }))}
            placeholder="mi-negocio"
            className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
          />
        </div>
        {fieldError("slug") ? (
          <p className="mt-1 text-[11px] font-medium text-red-400">
            {fieldError("slug")}
          </p>
        ) : (
          <p className={hintClass} data-testid="register-slug-preview">
            Tu sitio sera{" "}
            <span className="font-mono text-gray-300">
              {draft.slug || "mi-negocio"}.multitenant.cl
            </span>
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Atras
        </button>
        <button
          type="submit"
          data-testid="register-next-2"
          className={primaryButtonClass}
        >
          Continuar
        </button>
      </div>
    </form>
  );
}
