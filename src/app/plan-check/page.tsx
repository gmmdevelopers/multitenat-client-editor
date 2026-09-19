"use client";

import { useEffect, useState } from "react";
import {
  getRegistryComponents,
  getLockedComponents,
  PLAN,
  SITE_TYPE,
  type Plan,
} from "@multitenant/design-system";

/**
 * Página temporal para verificar el filtrado por plan. Se elimina después.
 */
export default function PlanCheckPage() {
  const [out, setOut] = useState("");

  useEffect(() => {
    const lines: string[] = [];
    const plans: Plan[] = [PLAN.basic, PLAN.full, PLAN.pro];

    for (const plan of plans) {
      const orgs = getRegistryComponents({
        category: "organisms",
        siteType: SITE_TYPE.skincare,
        plan,
      });
      const pages = getRegistryComponents({
        category: "pages",
        siteType: SITE_TYPE.skincare,
        plan,
      });
      const locked = getLockedComponents({
        category: "organisms",
        siteType: SITE_TYPE.skincare,
        plan,
      });

      lines.push(
        `${plan.toUpperCase()} -> organisms: ${orgs.length} | pages: ${pages.length} | locked: ${locked.length}`,
      );
      lines.push(`  bloqueados: ${locked.map((l) => l.meta.name).join(", ") || "ninguno"}`);
    }

    setOut(lines.join("\n"));
  }, []);

  return (
    <pre data-testid="plan-out" className="min-h-screen whitespace-pre bg-white p-6 font-mono text-xs text-black">
      {out}
    </pre>
  );
}
