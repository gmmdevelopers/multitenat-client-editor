"use client";

import { useEffect, useState } from "react";
import {
  componentRegistry,
  getRegistryComponents,
  getRegistrySiteTypes,
  SITE_TYPE,
  SITE_TYPES,
  SITE_TYPE_LABELS,
  type SiteType,
} from "@multitenant/design-system";

/**
 * Página temporal para validar el filtrado del registry por tipo de sitio.
 * Se elimina después de la verificación.
 */
export default function RegistryProbePage() {
  const [output, setOutput] = useState<string>("");

  useEffect(() => {
    const lines: string[] = [];
    lines.push(`total componentes: ${componentRegistry.length}`);
    lines.push(`tipos definidos: ${SITE_TYPES.join(", ")}`);
    lines.push(`labels: ${JSON.stringify(SITE_TYPE_LABELS)}`);
    lines.push("");

    for (const type of Object.values(SITE_TYPE) as SiteType[]) {
      const pages = getRegistryComponents({
        category: "pages",
        siteType: type,
      });
      const orgs = getRegistryComponents({
        category: "organisms",
        siteType: type,
      });
      lines.push(`${type}: ${pages.length} pages, ${orgs.length} organisms`);
      pages.forEach((p) => lines.push(`    - ${p.meta.name}`));
    }

    lines.push("");
    lines.push(`tipos presentes: ${getRegistrySiteTypes().join(", ")}`);
    setOutput(lines.join("\n"));
  }, []);

  return (
    <pre
      data-testid="probe-output"
      className="min-h-screen whitespace-pre bg-white p-6 font-mono text-xs text-black"
    >
      {output}
    </pre>
  );
}
