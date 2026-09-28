import { api } from "./client";

/**
 * Imagen de la galeria del tenant.
 *
 * `url` es la publica y directa (sin transformaciones): el editor muestra la
 * imagen tal cual. La optimizacion (WebP, redimensionado) se aplica solo en la
 * web publica, donde el trafico lo justifica.
 */
export interface TenantImage {
  id: string;
  url: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  size: number;
  alt: string | null;
  createdAt: string;
}

/** Respuesta de la firma: lo que el navegador necesita para subir a R2. */
export interface SignedUpload {
  /** URL de R2 a la que se hace el PUT. */
  uploadUrl: string;
  storageKey: string;
  /** URL publica que tendra la imagen una vez subida. */
  url: string;
  /** Cabeceras que hay que repetir en el PUT, o la firma no cuadra. */
  headers: Record<string, string>;
  /** El nombre original, que viaja a `confirm`. */
  fileName: string;
}

/** Galeria del tenant, la mas reciente primero. */
export async function listUploads(): Promise<TenantImage[]> {
  const { data } = await api.get<TenantImage[]>("/uploads");
  return data;
}

/**
 * Firmar una subida directa a R2.
 *
 * El archivo NO pasa por el backend: se manda su tipo y tamano para que la
 * firma los incluya, y luego el navegador hace el PUT contra R2.
 */
export async function signUpload(payload: {
  fileName: string;
  contentType: string;
  size: number;
}): Promise<SignedUpload> {
  const { data } = await api.post<SignedUpload>("/uploads/sign", payload);
  return data;
}

/** Registrar en la galeria una imagen ya subida a R2. */
export async function confirmUpload(payload: {
  storageKey: string;
  fileName?: string;
  alt?: string;
}): Promise<TenantImage> {
  const { data } = await api.post<TenantImage>("/uploads/confirm", payload);
  return data;
}

/** Quitar una imagen de la galeria (borra tambien el objeto del bucket). */
export async function deleteUpload(id: string): Promise<void> {
  await api.delete(`/uploads/${id}`);
}

/**
 * Sube un archivo siguiendo el flujo de tres pasos.
 *
 *   1. pedir la firma
 *   2. PUT del archivo contra R2
 *   3. confirmar en la galeria
 *
 * El PUT se hace con `fetch` y no con `axios` a proposito: la URL de R2 es
 * externa, y el interceptor de `axios` le anadiria el token de sesion y el
 * header del tenant, que R2 rechazaria por no estar en la firma.
 */
export async function uploadImageFile(file: File): Promise<TenantImage> {
  const signed = await signUpload({
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });

  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: signed.headers,
    body: file,
  });

  if (!put.ok) {
    // El detalle de R2 no es util para el cliente (habla de firmas y checksums),
    // pero se registra para poder diagnosticarlo.
    console.error("Fallo el PUT contra R2:", put.status, await put.text());
    throw new Error(
      "No pudimos subir la imagen. Revisa tu conexion e intenta de nuevo.",
    );
  }

  // Solo se registra si el archivo llego a subirse: si el PUT falla, no debe
  // quedar una entrada en la galeria apuntando a un objeto inexistente.
  return confirmUpload({
    storageKey: signed.storageKey,
    fileName: signed.fileName,
  });
}