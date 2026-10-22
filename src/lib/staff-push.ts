import {
  getStaffPushConfig,
  subscribeStaffPush,
  unsubscribeStaffPush,
  type StaffPushConfig,
} from "@/lib/api/staff-push";

/**
 * Registro del service worker.
 *
 * El archivo NO es un modulo (ver `public/sw-push.js`), asi que se registra por
 * URL y con scope raiz: el aviso puede abrir cualquier ruta del panel, no solo
 * la de ajustes donde se activa.
 */
const SERVICE_WORKER_URL = "/sw-push.js";

/** Lo que puede pasar cuando el usuario toca "Activar". */
export type PushActivationResult =
  | { status: "active" }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "error"; reason: string };

/**
 * Convierte la clave VAPID en el `Uint8Array` que pide `subscribe()`.
 *
 * La clave viaja como base64url (sin `+`, `/` ni `=`, que no se pueden usar en
 * una URL). `atob` solo entiende base64 normal, asi que hay que reponer los
 * caracteres y el relleno antes de decodificar. Sin esta conversion el navegador
 * rechaza la suscripcion con `InvalidAccessError` y el motivo no es evidente.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");

  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

/**
 * Si este navegador puede recibir notificaciones.
 *
 * Devuelve el motivo cuando no puede: en la UI un simple "no disponible" deja
 * al cliente sin saber que hacer, y casi siempre el motivo si tiene solucion
 * (iOS exige instalar el panel como app).
 */
function unsupportedReason(): string | null {
  if (typeof window === "undefined") return "No es un navegador.";

  /**
   * `isSecureContext`: el service worker solo existe en HTTPS (o `localhost`).
   *
   * Es el fallo menos evidente de todos: en la red local, abriendo el panel por
   * IP, todo parece bien y la suscripcion falla sin decir por que.
   */
  if (!window.isSecureContext) {
    return "Las notificaciones necesitan HTTPS (o localhost).";
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    /**
     * En iPhone, Safari **solo** habilita web push con el sitio instalado en la
     * pantalla de inicio. No es configuracion de la plataforma: es una regla de
     * Apple, y hay que decirlo, porque el cliente probaria en Safari y creeria
     * que esta roto.
     */
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    return isIOS
      ? "En iPhone, agrega el panel a la pantalla de inicio y ábrelo desde ahí."
      : "Este navegador no soporta notificaciones push.";
  }

  return null;
}

/** La suscripcion actual de este navegador, si la hay. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (unsupportedReason()) return null;

  const registration =
    await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);

  return (await registration?.pushManager.getSubscription()) ?? null;
}

export interface StaffPushState {
  config: StaffPushConfig;
  /** Este navegador tiene una suscripcion activa. */
  isSubscribed: boolean;
  /** Motivo por el que no se puede usar, o `null` si se puede. */
  unsupported: string | null;
  /** `Notification.permission` del navegador. */
  permission: NotificationPermission | "unsupported";
}

/**
 * Lee el estado completo para pintar el bloque.
 *
 * ## Por que consulta el servidor Y el navegador
 *
 * Son dos cosas distintas y pueden discrepar:
 *
 *   | Fuente | Que dice |
 *   |---|---|
 *   | `config.subscriptions` | cuantos navegadores tiene este usuario |
 *   | `currentSubscription()` | si **este** esta suscrito |
 *
 * Si solo se mirara el servidor, un usuario con el telefono suscrito veria
 * "activo" en el computador, donde en realidad no llega nada.
 */
export async function loadStaffPushState(): Promise<StaffPushState> {
  const unsupported = unsupportedReason();
  const permission =
    typeof Notification === "undefined"
      ? ("unsupported" as const)
      : Notification.permission;

  const [config, subscription] = await Promise.all([
    getStaffPushConfig(),
    currentSubscription(),
  ]);

  return {
    config,
    isSubscribed: Boolean(subscription),
    unsupported,
    permission,
  };
}

/**
 * Activa las notificaciones en ESTE navegador.
 *
 * ## El orden importa
 *
 * 1. `requestPermission()` **primero**: el navegador exige que la peticion de
 *    permiso salga de un gesto del usuario, y un `await` largo antes (como
 *    registrar el service worker) puede consumir esa "activacion" en Safari.
 * 2. Registrar el service worker.
 * 3. Suscribir.
 * 4. Guardar en el servidor.
 *
 * Si se guardara antes de suscribir, quedaria una fila apuntando a un navegador
 * que no acepta nada. Y si el paso 4 falla, se **desuscribe localmente**: dejar
 * el navegador suscrito sin que el servidor lo sepa daria una UI que dice
 * "activo" sin que llegue nunca un aviso.
 */
export async function activateStaffPush(
  publicKey: string,
): Promise<PushActivationResult> {
  const unsupported = unsupportedReason();
  if (unsupported) return { status: "unsupported", reason: unsupported };

  const permission = await Notification.requestPermission();

  if (permission !== "granted") return { status: "denied" };

  const registration = await navigator.serviceWorker.register(
    SERVICE_WORKER_URL,
    { scope: "/" },
  );

  /**
   * `ready` espera a que haya un worker ACTIVO.
   *
   * Tras un primer registro, el worker pasa por `installing` y `waiting`; una
   * suscripcion antes de eso falla. En el segundo arranque ya esta listo y no
   * bloquea.
   */
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        /**
         * `userVisibleOnly: true` es OBLIGATORIO en Chrome.
         *
         * Declara que cada push muestra una notificacion. Usarlo para otra cosa
         * (sincronizar en segundo plano) es justo lo que Chrome quiere impedir.
         */
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (error) {
      return {
        status: "error",
        reason:
          error instanceof Error
            ? error.message
            : "El navegador rechazó la suscripción.",
      };
    }
  }

  try {
    await subscribeStaffPush(subscription);
  } catch (error) {
    // El servidor no la guardo: se deshace en el navegador para que la UI no
    // diga "activo" cuando no va a llegar nada.
    await subscription.unsubscribe().catch(() => undefined);

    throw error;
  }

  return { status: "active" };
}

/** Desactiva las notificaciones en ESTE navegador. */
export async function deactivateStaffPush(): Promise<void> {
  const subscription = await currentSubscription();

  if (!subscription) return;

  /**
   * Se borra PRIMERO en el servidor.
   *
   * Si se desuscribiera antes, el `endpoint` se perderia y la fila quedaria
   * huerfana: el servidor seguiria enviando a un destino que ya no existe hasta
   * que un envio fallara con 410.
   */
  await unsubscribeStaffPush(subscription.endpoint);

  await subscription.unsubscribe();
}
