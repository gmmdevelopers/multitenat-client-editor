// src/lib/api/registration.ts
import { api } from "./client";

/**
 * Registro publico de un cliente.
 *
 * El plan que se envia es una INTENCION: el backend crea el tenant en `basic` y
 * guarda lo pedido en `requestedPlan`. El plan real solo se activa cuando el
 * webhook de Mercado Pago confirma el pago.
 */
export interface RegisterTenantPayload {
  name: string;
  legalName?: string;
  slug: string;
  taxId: string;
  phone: string;
  businessType: string;
  requestedPlan: string;
  admin: {
    fullName: string;
    email: string;
    password: string;
  };
  /** Token de Turnstile resuelto en el navegador. Es de un solo uso. */
  captchaToken: string;
  /**
   * Cupon opcional.
   *
   * Lo valida el backend dentro del propio registro; se envia tal cual, sin
   * normalizar aqui. Un `free_access` da el plan sin cobro y un `discount` baja
   * el precio, pero ambos son EXCLUYENTES con la prueba gratuita.
   */
  couponCode?: string;
}

/**
 * Respuesta del registro.
 *
 * ## Ya NO trae sesion ni tenant
 *
 * En este punto **no existe cuenta**: el registro solo crea un alta pendiente
 * (`PendingRegistration`). El tenant y el usuario nacen cuando el webhook de
 * Mercado Pago confirma el cobro, y entonces el cliente entra por el login de
 * siempre.
 *
 * Antes esta interfaz describia un `accessToken` + `tenant` + `user`, que era lo
 * que devolvia el backend con el flujo viejo. Mantenerla con esa forma hacia
 * que el frontend creyera tener sesion justo despues de registrarse, cuando el
 * backend ya respondia otra cosa.
 */
export interface RegisterTenantResponse {
  /**
   * Id del alta. Es lo que se pasa al checkout y con lo que se consulta el
   * estado despues de pagar.
   */
  pendingRegistrationId: string;
  email: string;
}

export async function registerTenant(
  payload: RegisterTenantPayload,
): Promise<RegisterTenantResponse> {
  const { data } = await api.post<RegisterTenantResponse>(
    "/tenants/register",
    payload,
  );
  return data;
}

export interface BusinessTypeOption {
  value: string;
  label: string;
}

/**
 * Rubros para el dropdown.
 *
 * Se piden al backend en vez de duplicarlos aqui: si se escribieran tambien en
 * el frontend, añadir un rubro exigiria dos despliegues y uno se olvidaria.
 */
export async function getBusinessTypes(): Promise<BusinessTypeOption[]> {
  const { data } = await api.get<{ businessTypes: BusinessTypeOption[] }>(
    "/tenants/business-types",
  );
  return data.businessTypes;
}

export interface PlanOption {
  key: string;
  displayName: string;
  amountInPesos: number;
  currency: string;
  description: string;
}

/** Planes con sus precios. Fuente unica: el frontend no los duplica. */
export async function getPlans(): Promise<PlanOption[]> {
  const { data } = await api.get<{ plans: PlanOption[] }>("/billing/plans");
  return data.plans;
}

export interface CheckoutSession {
  initPoint: string;
  providerSubscriptionId: string;
  status: string;
  amountInPesos: number;
  currency: string;
}

/**
 * Inicia el checkout del plan elegido.
 *
 * Requiere sesion: se llama DESPUES del registro, porque el tenant tiene que
 * existir para poder asociarle la suscripcion.
 */
export async function createCheckout(
  plan: string,
  payerEmail: string,
): Promise<CheckoutSession> {
  const { data } = await api.post<CheckoutSession>("/billing/checkout", {
    plan,
    payerEmail,
  });
  return data;
}

/**
 * Inicia el checkout de un alta PENDIENTE (el cliente aun no tiene cuenta).
 *
 * ## Por que no sirve `createCheckout`
 *
 * `createCheckout` exige sesion y asocia la suscripcion al tenant del token.
 * En este punto **no hay cuenta ni sesion**: el alta existe solo como
 * `PendingRegistration`, y la cuenta se crea cuando el webhook confirme el pago.
 *
 * ## El email NO se envia
 *
 * Lo toma el backend del alta pendiente. Si se aceptara desde aqui, cualquiera
 * podria iniciar el cobro a nombre de un email distinto del que se registro, y
 * la cuenta que se crearia al pagar quedaria a nombre de otra persona. Tampoco
 * se envia el monto: sale del catalogo en el servidor.
 *
 * ## `backUrl`
 *
 * A donde vuelve Mercado Pago al terminar. Va por query string (asi lo define el
 * controlador) y es la pantalla de «gracias», para que el cliente vea que el
 * pago se esta confirmando en vez de caer en el login sin explicacion.
 */
export async function createPendingCheckout(
  pendingRegistrationId: string,
  /** `PlanOption["key"]`, que ya es `string`; se tipa igual que arriba. */
  plan: PlanOption["key"],
  backUrl: string,
): Promise<CheckoutSession> {
  const { data } = await api.post<CheckoutSession>(
    "/billing/checkout/pending",
    { pendingRegistrationId, plan },
    { params: { backUrl } },
  );
  return data;
}

/**
 * Estado de un alta pendiente.
 *
 * La pantalla de vuelta del pago necesita saber si la cuenta YA se creo, sin
 * pedirle al cliente que lo intente iniciando sesion: el webhook de Mercado
 * Pago tarda unos segundos y un login prematuro le devolveria `PAYMENT_PENDING`,
 * que parece un error cuando solo esta tardando.
 *
 * Es publico (no lleva token): quien vuelve del pago aun no tiene sesion, y el
 * id del alta es un `cuid` que solo conoce esa persona.
 */
export interface PendingRegistrationStatus {
  email: string;
  /** `true` cuando el pago se confirmo y la cuenta ya existe. */
  provisioned: boolean;
  /** Slug pedido en el registro. Orientativo: puede haber cambiado al final. */
  slug: string | null;
}

export async function getPendingRegistrationStatus(
  pendingRegistrationId: string,
): Promise<PendingRegistrationStatus> {
  const { data } = await api.get<PendingRegistrationStatus>(
    `/tenants/register/${pendingRegistrationId}`,
  );
  return data;
}

/**
 * Intenta confirmar el pago por adelantado, sin esperar al webhook.
 *
 * Mercado Pago avisa al backend por webhook, pero puede tardar. Mientras el
 * cliente mira la pantalla de «gracias» se le pide al backend que consulte el
 * pago directamente (con los datos del preapproval) y, si ya esta aprobado,
 * cree la cuenta en ese momento.
 *
 * Es idempotente: si el webhook llego primero, responde lo mismo sin duplicar
 * nada. Por eso la pantalla puede llamarlo cada pocos segundos sin miedo.
 */
export async function syncPendingRegistration(
  pendingRegistrationId: string,
): Promise<PendingRegistrationStatus> {
  const { data } = await api.post<PendingRegistrationStatus>(
    `/tenants/register/${pendingRegistrationId}/sync`,
  );
  return data;
}
