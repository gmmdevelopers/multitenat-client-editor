// src/lib/api/sites.ts
import { api } from "./client";
import type { Site } from "@/types/site";

export interface CreateSiteRequest {
  title: string;
  domain: string;
}

/** El backend devuelve el site y el home creado en la misma transacción. */
export interface CreateSiteResponse {
  site: Site;
  homePage: {
    id: string;
    path: string;
    title: string;
  };
}

export interface UpdateSiteRequest {
  title?: string;
  customDomain?: string | null;
  isPublished?: boolean;
}

export interface UpdateSiteResponse {
  site: Site;
}

export interface SiteEditorEntryPointResponse {
  siteId: string;
  pageId: string;
  path: string;
}

/** GET /sites/current — el site del tenant (o null si aún no existe). */
export async function getCurrentSite(): Promise<Site | null> {
  const { data } = await api.get<Site | null>("/sites/current");
  return data ?? null;
}

export async function listSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>("/sites");
  return data;
}

export async function createSite(
  payload: CreateSiteRequest,
): Promise<CreateSiteResponse> {
  const { data } = await api.post<CreateSiteResponse>("/sites", payload);
  return data;
}

export async function updateSite(
  siteId: string,
  payload: UpdateSiteRequest,
): Promise<UpdateSiteResponse> {
  const { data } = await api.patch<UpdateSiteResponse>(
    `/sites/${siteId}`,
    payload,
  );
  return data;
}

/** GET /sites/:siteId/home — resuelve el pageId de la página home ("/"). */
export async function getSiteHomePage(
  siteId: string,
): Promise<SiteEditorEntryPointResponse> {
  const { data } = await api.get<SiteEditorEntryPointResponse>(
    `/sites/${siteId}/home`,
  );
  return data;
}
