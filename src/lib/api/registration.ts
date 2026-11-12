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
 * ## Normalmente NO trae sesion ni tenant
 *
 * En este punto **no existe cuenta**: el registro solo crea un alta pendiente
 * (`PendingRegistration`). El tenant y el usuario nacen cuando Transbank
 * confirma la inscripcion, y entonces el cliente entra por el login de siempre.
 *
 * ## La excepcion: cupon `free_access`
 *
 * Ese cupon otorga el plan sin cobro, asi que el backend provisiona el alta en
 * el acto y devuelve `provisioned: true` con la sesion. En ese caso el frontend
 * NO debe abrir el checkout: el backend responde 409 ("Esta cuenta ya esta
 * creada") porque ya no hay nada que pagar.
 */
export interface RegisterTenantResponse {
  /**
   * Id del alta. Es lo que se pasa al checkout y con lo que se consulta el
   * estado despues de pagar.
   */
  pendingRegistrationId: string;
  email: string;
  /** `true` cuando el alta ya se convirtio en cuenta (cupon `free_access`). */
  provisioned: boolean;
  /** Token de sesion, solo cuando `provisioned` es `true`. */
  accessToken: string | null;
  /** Slug del tenant creado, solo cuando `provisioned` es `true`. */
  slug: string | null;
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
 * Desglose de un cupón, tal como lo devuelve el backend.
 *
 * `summary` viene generada por el servidor: la misma frase se usa en la
 * pantalla de registro y en el banner del panel, así no se desincronizan.
 */
export interface CouponDescription {
  valid: true;
  code: string;
  type: "discount" | "free_trial" | "free_access";
  plan: string;
  planDisplayName: string;
  planAmount: number;
  /** Lo que paga hoy al suscribirse. `0` en `free_trial` y `free_access`. */
  firstPayment: number;
  /** Lo que se cobra cada mes mientras dura la promoción. */
  recurringAmount: number;
  /** Lo que se cobrará al terminar la promoción. `null` = el monto es definitivo. */
  fullPriceAfter: number | null;
  durationMonths: number | null;
  promoEndsAt: string | null;
  grantsPlan: string | null;
  percentOff: number | null;
  freeTrialMonths: number | null;
  summary: string;
}

/**
 * Valida un cupón y devuelve su desglose.
 *
 * Requiere el token de Turnstile: el endpoint es público y devolvería qué
 * códigos existen, así que cada intento cuesta un captcha resuelto.
 */
export async function validateCoupon(input: {
  code: string;
  plan: string;
  captchaToken: string;
}): Promise<CouponDescription> {
  const { data } = await api.post<CouponDescription>(
    "/tenants/coupons/validate",
    input,
  );
  return data;
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


