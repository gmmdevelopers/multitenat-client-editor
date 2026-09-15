import {
  getRegistryComponents,
  SITE_TYPE,
  type ComponentRegistryEntry,
  type SiteType,
} from "@multitenant/design-system";

/**
 * Organismos que se pueden arrastrar al canvas.
 *
 * Se dejan sin filtrar por tipo de sitio a proposito: los organismos son
 * transversales y el editor hoy sirve a cualquier vertical. Cuando el sitio
 * tenga un `siteType` propio (medical, dental...) esta lista se acota con
 * `getOrganismsForSiteType`.
 */
export const ORGANISMS_REGISTRY: ComponentRegistryEntry[] = getRegistryComponents(
  { category: "organisms" },
);

/** Organismos aplicables a un vertical concreto, mas los transversales. */
export function getOrganismsForSiteType(
  siteType: SiteType,
): ComponentRegistryEntry[] {
  return getRegistryComponents({ category: "organisms", siteType });
}

/** Paginas compuestas listas para un vertical (ej: las Medical*). */
export function getPagesForSiteType(
  siteType: SiteType,
): ComponentRegistryEntry[] {
  return getRegistryComponents({ category: "pages", siteType });
}

/** Punto de entrada por defecto hasta que el sitio guarde su propio tipo. */
export const DEFAULT_SITE_TYPE: SiteType = SITE_TYPE.medical;

export const ORGANISMS_MAP = new Map<string, ComponentRegistryEntry>(
  ORGANISMS_REGISTRY.map((entry) => [entry.meta.name, entry]),
);

export function getDefaultPropsForOrganism(
  metaName: string,
): Record<string, any> {
  const entry = ORGANISMS_MAP.get(metaName);
  if (!entry) return {};

  return entry.meta.fields.reduce(
    (acc, field) => {
      acc[field.name] = field.defaultValue;
      return acc;
    },
    {} as Record<string, any>,
  );
}
