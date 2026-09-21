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
  /** Subdominio del tenant, editable desde Configuración. */
  domain?: string;
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
  // El backend devuelve el site directamente (no `{ site }`).
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

export interface RequestCustomDomainPayload {
  /** Dominio ya comprado por el cliente, sin protocolo ni `www.`. */
  domain: string;
  registrar?: string;
  contactEmail?: string;
  notes?: string;
}

/**
 * Registra la solicitud de dominio propio.
 *
 * No configura nada por si sola: el dominio lo compra el cliente y la
 * redirección se coordina aparte. Deja la petición guardada y visible.
 */
export async function requestCustomDomain(
  siteId: string,
  payload: RequestCustomDomainPayload,
): Promise<Site> {
  const { data } = await api.post<Site>(
    `/sites/${siteId}/custom-domain`,
    payload,
  );
  return data;
}

export interface PublicationSummary {
  totalPages: number;
  publishedPages: number;
  pendingPages: number;
  pendingPaths: string[];
}

export interface PublishSiteResult {
  ok: true;
  isPublished: boolean;
  publishedPages: number;
}

/** Contadores de publicación del sitio, para mostrarlos en Configuración. */
export async function getPublicationSummary(
  siteId: string,
): Promise<PublicationSummary> {
  const { data } = await api.get<PublicationSummary>(
    `/sites/${siteId}/publication`,
  );
  return data;
}

/**
 * Publica o despublica el sitio completo.
 *
 * Al publicar también sube las páginas con cambios pendientes. Al despublicar,
 * la web entera responde 404 y las páginas conservan su estado.
 */
export async function setSitePublished(
  siteId: string,
  isPublished: boolean,
): Promise<PublishSiteResult> {
  const { data } = await api.post<PublishSiteResult>(
    `/sites/${siteId}/publish`,
    { isPublished },
  );
  return data;
}
