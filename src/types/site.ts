import type { BlockInstance } from "@/types/editor-state";

export interface SiteSettings {
  theme?: "light" | "dark";
  primaryColor?: string;
  logoUrl?: string;
}

export interface Site {
  id: string;
  tenantId: string;
  title: string;
  domain: string;
  customDomain: string | null;
  isPublished: boolean;
  settings: SiteSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  siteId: string | null;
  path: string;
  title: string;
  blocks: BlockInstance[];
  seoTitle: string;
  /** El backend expone este campo como seoDescripcion. */
  seoDescripcion: string;
  createdAt: string;
  updatedAt: string;
}

export type PageSummary = Omit<Page, "blocks">;
