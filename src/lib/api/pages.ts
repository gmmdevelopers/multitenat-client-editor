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
import type { CustomPalette } from "@multitenant/design-system";

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
  /**
   * Paleta elegida por el cliente, o `null` si usa la del vertical.
   *
   * Llega en la misma respuesta que los bloques para que la web no pinte un
   * frame con los colores por defecto y cambie despues.
   */
  palette?: Partial<CustomPalette> | null;
  /**
   * URL del icono del sitio, o `null` si el cliente no subio uno.
   *
   * Lo usa la web publica para el favicon. Llega aqui y no por una peticion
   * aparte porque es un dato del SITIO y ya se esta pidiendo la pagina: un
   * segundo viaje solo para el icono retrasaria el favicon sin motivo.
   */
  iconUrl?: string | null;
  /**
   * Nombre del sitio (`Site.title`), para el titulo de la pestana.
   *
   * Distinto de `seoTitle`: aquel es de la PAGINA (para buscadores) y este es
   * la MARCA del negocio, la misma en todas las paginas.
   */
  siteName?: string | null;
}

/** Resuelve una página publicada por su ruta. Endpoint público, sin sesión. */
export async function getPublicPageByPath(
  path: string,
): Promise<PublicPageResponse> {
  const { data } = await api.get<PublicPageResponse>("/pages/public/by-path", {
    params: { path },
    /**
     * El slug se manda en la CABECERA, leido de la URL.
     *
     * ## Por que de la URL y no de la cookie
     *
     * La cookie puede ser de una visita ANTERIOR y quedar obsoleta. En la app
     * movil paso exactamente eso: `x-tenant-slug=192` (de cuando el host era una
     * IP) **anulaba el `?slug=clinica`** de la URL, y la WebView daba 404 con la
     * MISMA url que el navegador cargaba bien.
     *
     * La URL es una **intencion explicita** de quien navega: si trae `slug`, ese
     * manda. La cookie queda como respaldo (el cliente ya la pone si no hay
     * cabecera).
     */
    headers: buildSlugHeaders(),
  });
  return data;
}

/**
 * Cabecera `x-tenant-slug` a partir del `?slug=` de la URL, si existe.
 *
 * Devuelve `{}` cuando no hay query: asi el cliente de la API usa la cookie, que
 * es el comportamiento de siempre en la web publica normal (subdominio, sin
 * query).
 */
function buildSlugHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const slug = new URLSearchParams(window.location.search).get("slug");

  return slug ? { "x-tenant-slug": slug } : {};
}
