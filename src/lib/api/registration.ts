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
}

export interface RegisterTenantResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    /** Plan efectivo: siempre `basic` al registrarse. */
    plan: string;
    /** Plan que el cliente pidio, pendiente de pago. */
    requestedPlan: string | null;
  };
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
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
