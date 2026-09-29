import type { Page, PageSummary } from "@/types/site";
import { BlockInstance } from "../editor-state";

export interface ListPagesResponse {
  pages: PageSummary[];
}

export interface GetPageResponse {
  page: Page;
}

export interface GetPageByPathResponse {
  page: Page;
}

export interface CreatePageRequest {
  siteId: string;
  path: string;
  title: string;
  seoTitle?: string;
  seoDescripcion?: string;
  blocks?: BlockInstance[];
}

export interface CreatePageResponse {
  page: Page;
}

export interface UpdatePageRequest {
  path?: string;
  title?: string;
  seoTitle?: string;
  seoDescripcion?: string;
  blocks?: BlockInstance[];
}

export interface UpdatePageResponse {
  page: Page;
}

export interface SavePageBlocksRequest {
  blocks: BlockInstance[];
}

export interface SavePageBlocksResponse {
  page: Page;
}

export type DeletePageResponse = void;

export interface GetPageForEditorResponse {
  id: string;
  /** Necesario para crear paginas nuevas desde el selector de templates. */
  siteId: string | null;
  path: string;
  title: string;
  blocks: BlockInstance[];
  publishedBlocks: BlockInstance[];
  publishedAt: string | null;
  seoTitle: string;
  seoDescripcion: string;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
  /**
   * Estado del SITIO, que es distinto del estado de la pagina.
   *
   * `isPublished` es un interruptor maestro: en `false`, la web entera responde
   * 404 aunque sus paginas esten publicadas. La toolbar lo necesita para
   * distinguir "nunca lo he puesto en linea" de "tengo cambios sin publicar".
   *
   * `null` si la pagina no pertenece a ningun sitio (caso raro, no deberia
   * ocurrir con los datos actuales).
   */
  site: {
    isPublished: boolean;
    /** Subdominio (`mi-clinica`), sin el dominio de la plataforma. */
    domain: string;
    /** Dominio propio conectado, si el cliente lo tiene. */
    customDomain: string | null;
  } | null;
}

export interface SaveDraftBlocksRequest {
  blocks: BlockInstance[];
}

export interface SaveDraftBlocksResponse {
  ok: true;
  updatedAt: string;
  blocks: BlockInstance[];
  hasUnpublishedChanges: boolean;
}

export interface PublishPageResponse {
  ok: true;
  publishedAt: string;
  blocks: BlockInstance[];
}
