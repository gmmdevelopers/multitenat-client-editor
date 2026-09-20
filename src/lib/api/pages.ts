// src/lib/api/pages.ts
import { api } from "./client";
import type {
  CreatePageRequest,
  CreatePageResponse,
  GetPageForEditorResponse,
  GetPageResponse,
  ListPagesResponse,
  PublishPageResponse,
  SaveDraftBlocksRequest,
  SaveDraftBlocksResponse,
  UpdatePageRequest,
  UpdatePageResponse,
} from "@/types/api/pages";
import { BlockInstance } from "@/types/editor-state";

export async function getPage(pageId: string) {
  const { data } = await api.get<GetPageResponse>(`/pages/${pageId}`);
  return data;
}

export async function createPage(payload: CreatePageRequest) {
  const { data } = await api.post<CreatePageResponse>("/pages", payload);
  return data;
}

export async function deletePage(pageId: string) {
  await api.delete(`/pages/${pageId}`);
}

export async function listPages(siteId: string) {
  const { data } = await api.get<ListPagesResponse>(`/sites/${siteId}/pages`);
  return data;
}

export async function updatePage(pageId: string, payload: UpdatePageRequest) {
  const { data } = await api.patch<UpdatePageResponse>(
    `/pages/${pageId}`,
    payload,
  );
  return data;
}

export async function getPageForEditor(pageId: string) {
  const { data } = await api.get<GetPageForEditorResponse>(
    `/pages/${pageId}/editor`,
  );
  return data;
}

export async function saveDraftBlocks(
  pageId: string,
  blocks: BlockInstance[],
): Promise<SaveDraftBlocksResponse> {
  const payload: SaveDraftBlocksRequest = { blocks };
  const { data } = await api.put<SaveDraftBlocksResponse>(
    `/pages/${pageId}/blocks`,
    payload,
  );
  return data;
}

export async function publishPage(
  pageId: string,
): Promise<PublishPageResponse> {
  const { data } = await api.post<PublishPageResponse>(
    `/pages/${pageId}/publish`,
  );
  return data;
}

/**
 * Página publicada, resuelta por PATH dentro del tenant.
 * Es lo que alimenta el render público de la web del cliente.
 */
export interface PublicPageResponse {
  id: string;
  path: string;
  title: string;
  seoTitle: string;
  seoDescripcion: string;
  publishedBlocks: BlockInstance[];
  publishedAt: string | null;
}

/** Resuelve una página publicada por su ruta. Endpoint público, sin sesión. */
export async function getPublicPageByPath(
  path: string,
): Promise<PublicPageResponse> {
  const { data } = await api.get<PublicPageResponse>("/pages/public/by-path", {
    params: { path },
  });
  return data;
}
