import type { BlockInstance } from "@/types/editor-state";
import type { CustomPalette } from "@multitenant/design-system";

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
  /**
   * Cuanto se le pide al paciente al agendar.
   *
   * `undefined` = sin configurar, que se trata como `none`.
   */
  depositPolicy?: "none" | "25" | "50" | "75" | "100";
  /**
   * Si el cliente cerro el aviso de "configura el cobro".
   *
   * Persistente (vive en el servidor): una vez cerrado no vuelve, ni al
   * recargar ni en otro dispositivo.
   */
  depositNoticeDismissedAt?: string;
}

export interface SiteSettings {
  theme?: "light" | "dark";
  primaryColor?: string;
  /**
   * @deprecated Sin uso. Se conserva solo para no romper sitios ya guardados.
   *
   * El icono del sitio vive en `Site.iconImageId` (referencia a la galeria, no
   * una URL suelta). Ver el mismo campo en `SiteSettingsShape` del backend.
   */
  logoUrl?: string;
  /**
   * Si el negocio atiende el chat de la app con sus pacientes.
   *
   * **Apagado por defecto**: activarlo implica que alguien contesta. Un chat
   * activo sin nadie detras es peor que no tenerlo.
   */
  chatEnabled?: boolean;
  /** Vertical del sitio, que decide los colores por defecto. */
  siteType?: string;
  /** Paleta elegida por el cliente; sobreescribe los colores del vertical. */
  palette?: Partial<CustomPalette> | null;
  /**
   * Correo al que llegan los mensajes de los formularios de contacto.
   *
   * Sin el, los mensajes SE GUARDAN pero no se avisa a nadie: el cliente los ve
   * en su panel. Es distinto de `domainRequest.contactEmail`, que es para
   * coordinar la configuracion del dominio propio.
   */
  contactEmail?: string;
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
  /**
   * ID de la imagen de la galeria usada como banner (app movil).
   *
   * Se guarda el ID y no la URL a proposito: si el cliente borra la imagen de
   * su galeria, la referencia se desasigna sola (`onDelete: SetNull`) y el
   * banner cae a su placeholder, en vez de quedar una imagen rota.
   */
  bannerImageId: string | null;
  /**
   * Imagen del banner ya resuelta, con su URL.
   *
   * El backend la incluye para que el editor pueda pintar la miniatura sin
   * una segunda peticion a `/uploads`.
   */
  bannerImage?: TenantImageSummary | null;
  /** ID de la imagen usada como icono del sitio (favicon y cabecera). */
  iconImageId: string | null;
  /** Icono ya resuelto, con su URL. */
  iconImage?: TenantImageSummary | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Imagen de la galeria, en la forma reducida que devuelve el `Site`.
 *
 * No es `TenantImage` completo: al incluir la relacion, el backend manda la
 * fila entera y aqui solo se declara lo que la UI usa. Lo que no este aqui no
 * se debe leer por accidente.
 */
export interface TenantImageSummary {
  id: string;
  url: string;
  fileName: string;
  alt: string | null;
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
