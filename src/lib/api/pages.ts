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
import type { PageSummary } from "@/types/site";

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

/**
 * Paginas de un sitio.
 *
 * El backend responde un ARRAY plano (no `{ pages }`), asi que el tipo refleja
 * eso: tiparlo como `{ pages }` hacia que el consumidor leyera `undefined`.
 */
export async function listPages(siteId: string): Promise<PageSummary[]> {
  const { data } = await api.get<PageSummary[]>(`/sites/${siteId}/pages`);
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
 * Resolver una pagina publicada por su ruta **NO vive aqui**.
 *
 * Esa llamada alimenta el render de la web publica, que desde el backlog §9 se
 * sirve desde `web-viewer`. El panel ya no renderiza sitios, asi que mantenia
 * este codigo (y su `PublicPageResponse`) sin ningun consumidor.
 */
