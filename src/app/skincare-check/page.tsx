"use client";

import { Suspense, useEffect, useState } from "react";
import {
  getRegistryComponents,
  SITE_TYPE,
  type ComponentMeta,
} from "@multitenant/design-system";

function defaults(meta: ComponentMeta<any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const collect = (
    fs: readonly { name: string; defaultValue?: unknown }[] | undefined,
  ) => {
    for (const f of fs ?? [])
      if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
  };
  collect(meta.fields);
  for (const g of meta.groups ?? []) collect(g.fields);
  return out;
}

function R() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div />;

  const pages = getRegistryComponents({
    category: "pages",
    siteType: SITE_TYPE.skincare,
  });

  return (
    <div className="bg-white">
      <div className="border-b-4 border-black p-4 font-mono text-xs">
        PAGES SKINCARE: {pages.length}
      </div>
      {pages.map((e) => (
        <div key={e.meta.name} className="border-b-8 border-red-600">
          <div
            data-label={e.meta.name}
            className="bg-black px-4 py-2 font-mono text-sm font-bold text-lime-400"
          >
            {e.meta.name}
          </div>
          <div data-render={e.meta.name}>
            <e.component {...defaults(e.meta)} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <R />
    </Suspense>
  );
}
