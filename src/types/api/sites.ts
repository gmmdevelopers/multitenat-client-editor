// src/types/api/sites.ts
import type { Site, SiteSettings } from "@/types/site";

/** GET /sites/by-slug/:slug (o by tenant) */
export interface GetSiteResponse {
  site: Site;
}

export interface ListSitesResponse {
  sites: Site[];
}

export interface CreateSiteRequest {
  title: string;
  domain: string;
  customDomain?: string | null;
  settings?: SiteSettings;
}

export interface CreateSiteResponse {
  site: Site;
}

export interface UpdateSiteRequest {
  title?: string;
  customDomain?: string | null;
  isPublished?: boolean;
  settings?: Partial<SiteSettings>;
}

export interface UpdateSiteResponse {
  site: Site;
}

export interface PublishSiteRequest {
  isPublished: boolean;
}

export interface PublishSiteResponse {
  site: Site;
}
