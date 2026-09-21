import type { BlockInstance } from "@/types/editor-state";

/**
 * Estado de una solicitud de dominio propio.
 *
 * El cliente COMPRA su dominio por su cuenta; desde aqui solo deja los datos
 * para que la plataforma configure la redireccion.
 */
export type DomainRequestStatus =
  | "none"
  | "requested"
  | "configuring"
  | "active"
  | "rejected";

export interface DomainRequestSettings {
  status: DomainRequestStatus;
  requestedDomain?: string;
  registrar?: string;
  contactEmail?: string;
  notes?: string;
  requestedAt?: string;
  updatedAt?: string;
}

/**
 * Estado de pagos del sitio tal como lo devuelve la API.
 *
 * Nunca incluye `accessToken`: el backend lo guarda pero no lo expone.
 * `connected` es la bandera que el frontend puede mostrar.
 */
export interface SitePaymentSettings {
  enabled: boolean;
  provider?: "mercadopago";
  connected?: boolean;
  connectedAt?: string;
  publicKey?: string;
}

export interface SiteSettings {
  theme?: "light" | "dark";
  primaryColor?: string;
  logoUrl?: string;
  payments?: SitePaymentSettings;
  domainRequest?: DomainRequestSettings;
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
