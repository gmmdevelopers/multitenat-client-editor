import {
  componentRegistry,
  type ComponentRegistryEntry,
} from "@multitenant/design-system";

export const ORGANISMS_REGISTRY: ComponentRegistryEntry[] =
  componentRegistry.filter((entry) => entry.meta.category === "organisms");

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
