import {
  getRegistryComponents,
  PAGE_KIND,
  PAGE_KINDS,
  PAGE_KIND_LABELS,
  planIncludes,
  SITE_TYPES,
  SITE_TYPE_LABELS,
  SITE_TYPE,
  type ComponentRegistryEntry,
  type PageKind,
  type Plan,
  type SiteType,
} from "@multitenant/design-system";
import type { BlockInstance } from "@/types/editor-state";

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

/**
 * Organismos aplicables a un vertical concreto.
 *
 * Un organismo transversal (sin `siteTypes`) aparece en todos los tabs, porque
 * el objetivo de los tabs es ORGANIZAR la lista, no prohibir combinaciones:
 * un cliente puede armar su barbería con organismos de un salón de masajes.
 */
export function getOrganismsForSiteType(
  siteType: SiteType,
): ComponentRegistryEntry[] {
  return getRegistryComponents({ category: "organisms", siteType });
}

/** Tabs disponibles en el sidebar, con su etiqueta legible. */
export const ORGANISM_TABS: Array<{ value: SiteType | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  ...SITE_TYPES.map((value) => ({ value, label: SITE_TYPE_LABELS[value] })),
];

/**
 * Organismos de un tab y, opcionalmente, solo los especificos del vertical
 * (excluyendo los transversales) para acortar la lista.
 *
 * - tab "all"                        -> todos
 * - tab "medical" + onlySpecific     -> solo los medical puros
 * - tab "medical" sin onlySpecific   -> medical + transversales
 */
export function getOrganismsForTab(
  tab: SiteType | "all",
  onlySpecific = false,
  plan?: Plan,
): ComponentRegistryEntry[] {
  const base =
    tab === "all" ? ORGANISMS_REGISTRY : getOrganismsForSiteType(tab);

  // El ecommerce es una capacidad premium: si el tenant no tiene plan pro,
  // sus organismos no deben aparecer en el sidebar.
  const allowed = plan
    ? base.filter(
        (entry) => !entry.meta.minPlan || planIncludes(plan, entry.meta.minPlan),
      )
    : base;

  if (!onlySpecific) return allowed;

  return allowed.filter((entry) => (entry.meta.siteTypes?.length ?? 0) > 0);
}

/** Organismos que el plan del tenant no incluye, para mostrarlos bloqueados. */
export function getLockedOrganismsForTab(
  tab: SiteType | "all",
  plan: Plan,
): ComponentRegistryEntry[] {
  const base =
    tab === "all" ? ORGANISMS_REGISTRY : getOrganismsForSiteType(tab);

  return base.filter(
    (entry) => entry.meta.minPlan && !planIncludes(plan, entry.meta.minPlan),
  );
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

  const props: Record<string, any> = {};

  const collect = (
    fields: readonly { name: string; defaultValue?: unknown }[] | undefined,
  ) => {
    for (const field of fields ?? []) {
      if (field.defaultValue !== undefined) {
        props[field.name] = field.defaultValue;
      }
    }
  };

  // Un meta puede declarar sus campos en `fields` o agrupados en `groups`.
  // Los organismos skincare usan `groups`, asi que leer solo `fields` dejaba
  // las props vacias y los componentes hacian `.length` sobre undefined.
  collect(entry.meta.fields);
  for (const group of entry.meta.groups ?? []) collect(group.fields);

  // Props que no vienen del meta pero sin las cuales el preview se ve roto.
  // La agenda, por ejemplo, recibe los profesionales por API; para la vista
  // previa basta un ejemplo para que no muestre "no hay profesionales".
  Object.assign(props, PREVIEW_PLACEHOLDER_PROPS[metaName] ?? {});

  return props;
}

/**
 * Datos de ejemplo para la vista previa del sidebar.
 *
 * Solo cubre props que el consumidor normalmente inyecta (API, estado), no las
 * que ya declara el meta.
 */
const PREVIEW_PLACEHOLDER_PROPS: Record<string, Record<string, unknown>> = {
  AppointmentScheduler: {
    professionals: [
      { id: "preview-1", fullName: "Dra. Camila Reyes" },
      { id: "preview-2", fullName: "Valentina Rios" },
    ],
    onLoadSlots: async () => [],
    onConfirm: async () => undefined,
  },
};
/** Un grupo de templates listo para pintar en el selector del editor. */
export interface TemplateGroup {
  kind: PageKind;
  label: string;
  templates: ComponentRegistryEntry[];
}

/**
 * Plantillas de pagina disponibles para el tenant, agrupadas por tipo.
 *
 * El tenant es AGNOSTICO al vertical: ve todos los templates (medical,
 * skincare, tienda...) y elige el que quiera. `siteTypes` solo categoriza,
 * no restringe. Lo unico que filtra es el plan contratado.
 */
export function getTemplateGroups(options: {
  plan: Plan;
}): TemplateGroup[] {
  const pages = getRegistryComponents({
    category: "pages",
    plan: options.plan,
  }).filter((entry) => (entry.meta.templateBlocks?.length ?? 0) > 0);

  const byKind = new Map<PageKind, ComponentRegistryEntry[]>();

  for (const entry of pages) {
    const kind = entry.meta.pageKind ?? PAGE_KIND.utility;
    const list = byKind.get(kind) ?? [];
    list.push(entry);
    byKind.set(kind, list);
  }

  // Respetamos el orden declarado en PAGE_KINDS, no el alfabetico.
  return PAGE_KINDS.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    label: PAGE_KIND_LABELS[kind],
    templates: byKind.get(kind) ?? [],
  }));
}

/** Convierte la plantilla de una pagina en bloques listos para el canvas. */
export function templateToBlocks(
  entry: ComponentRegistryEntry,
): BlockInstance[] {
  return (entry.meta.templateBlocks ?? []).map((block, index) => ({
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`,
    metaName: block.metaName,
    props: block.props ?? getDefaultPropsForOrganism(block.metaName),
  }));
}
