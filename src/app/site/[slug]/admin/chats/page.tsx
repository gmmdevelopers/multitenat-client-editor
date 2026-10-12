"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, Send, Wifi, WifiOff } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/api/errors";
import { getCurrentSite, updateSite } from "@/lib/api/sites";
import { fetchStaffTicket, useLiveChat } from "@/lib/api/live-chat";
import {
  getConversation,
  listConversations,
  replyToConversation,
  type InboxConversation,
  type InboxMessage,
} from "@/lib/api/inbox";

/**
 * Bandeja de entrada: las conversaciones con los pacientes.
 *
 * ## Dos columnas en escritorio, una en movil
 *
 * La lista a la izquierda y el hilo a la derecha, como cualquier cliente de
 * mensajeria: permite saltar entre conversaciones sin perder la que estabas
 * leyendo. En pantallas estrechas se muestra una u otra, porque dos columnas no
 * caben.
 *
 * ## Solo las conversaciones con mensajes tienen sentido aqui
 *
 * Un chat se crea al primer mensaje, no al reservar, asi que lo que aparece es
 * siempre una conversacion real. Los pacientes que no han escrito no ocupan
 * sitio.
 */
export default function ChatsPage() {
  const toast = useToast();

  const [conversations, setConversations] = useState<InboxConversation[] | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [patientName, setPatientName] = useState("");
  const [draft, setDraft] = useState("");
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Si el negocio tiene el chat activado.
   *
   * `null` mientras carga. El interruptor vive AQUI y no en "Cobro al agendar":
   * alli el cliente no lo encontraria (buscaria el chat en un sitio de pagos), y
   * aqui es donde se usa.
   */
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [isTogglingChat, setIsTogglingChat] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      // El sitio trae `chatEnabled`, que decide que se muestra si no hay
      // conversaciones: "chat apagado" o "sin mensajes".
      const [site, list] = await Promise.all([
        getCurrentSite(),
        listConversations(),
      ]);

      setChatEnabled(site?.settings?.chatEnabled ?? false);
      setConversations(list);
      setError(null);
    } catch (err) {
      setError(
        getErrorMessage(err, "No se pudieron cargar las conversaciones."),
      );
    }
  }, []);

  /** Activa o desactiva el chat. Se guarda al instante: es un interruptor. */
  async function handleToggleChat(next: boolean) {
    setIsTogglingChat(true);
    try {
      const site = await getCurrentSite();
      if (!site) return;

      const updated = await updateSite(site.id, { chatEnabled: next });
      setChatEnabled(updated.site?.settings?.chatEnabled ?? next);
      toast.success(
        next
          ? "Chat activado. Tus pacientes ya pueden escribirte."
          : "Chat desactivado",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo cambiar el chat."));
    } finally {
      setIsTogglingChat(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  /** Abre una conversacion. El backend la marca como leida al responder esto. */
  const openConversation = useCallback(
    async (chatId: string) => {
      setSelectedId(chatId);
      setIsLoadingThread(true);

      try {
        const data = await getConversation(chatId);
        setMessages(data.messages);
        setPatientName(data.patient.fullName);

        // Se recarga la lista: el `unread` de esa conversacion acaba de bajar.
        void loadConversations();
      } catch (err) {
        toast.error(getErrorMessage(err, "No se pudo abrir la conversación."));
      } finally {
        setIsLoadingThread(false);
      }
    },
    [loadConversations, toast],
  );

  // Se baja al ultimo mensaje al abrir y al recibir uno nuevo.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  /**
   * Mensajes en vivo.
   *
   * ## Por que un `useCallback` con dependencias vacias
   *
   * El hook guarda el manejador en una `ref`, asi que **no reconecta** aunque
   * esta funcion cambie de identidad en cada render. Y como solo usa setters de
   * estado y un `ref`, no necesita dependencias: el `selectedId` vivo se lee del
   * `ref` y no del cierre.
   */
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const handleLiveEvent = useCallback(
    (event: string, payload: unknown) => {
      const data = payload as {
        chatId?: string;
        message?: InboxMessage;
        /** Presente en el `read` del paciente: quien leyo. */
        reader?: string;
        readAt?: string;
      };

      if (event === "message:new" && data.message) {
        /**
         * Si el mensaje es de la conversacion ABIERTA, se añade al hilo.
         *
         * El `sender` importa: el mensaje que acaba de enviar el propio staff
         * tambien llega por el socket, y sin este filtro apareceria **duplicado**
         * (ya se añadio al enviarlo). El servidor emite a la sala del tenant, y
         * el staff esta en ella.
         */
        if (data.message.sender === "staff") return;

        if (data.chatId && data.chatId === selectedIdRef.current) {
          setMessages((current) => [...current, data.message as InboxMessage]);
        }

        // La lista se recarga en cualquier caso: cambia el ultimo mensaje y el
        // contador de sin leer de esa conversacion.
        void loadConversations();
      }

      if (event === "conversation:new") {
        /**
         * Un paciente escribio por PRIMERA vez.
         *
         * Este es el caso que motiva el socket: el panel tenia la lista vacia y
         * sin este evento no se enteraria hasta recargar. El contador del nav
         * subia, pero la conversacion no aparecia.
         */
        void loadConversations();
      }

      if (event === "read") {
        /**
         * `read` viaja en las DOS direcciones y hay que distinguirlas.
         *
         *  - `reader: "patient"` -> el paciente abrio el hilo y vio las
         *    respuestas del negocio. Es NUEVO, y lo que el panel tiene que
         *    pintar: marca las burbujas del staff como leidas.
         *  - sin ese campo -> el staff acaba de abrir la conversacion y sus
         *    mensajes del paciente pasan a leidos; aqui solo cambia el contador.
         *
         * Sin la distincion, el `read` del paciente no pintaria nada (antes se
         * limitaba a recargar la lista) y el "Leido" del staff no se veria.
         */
        if (data.reader === "patient") {
          const readAt = data.readAt ?? new Date().toISOString();

          // Solo la conversacion abierta: el estado de las demas no se esta
          // mirando, y al abrirlas se recargan de la base con el `readAt` real.
          if (data.chatId && data.chatId === selectedIdRef.current) {
            setMessages((current) =>
              current.map((m) =>
                m.sender === "staff" && !m.readAt ? { ...m, readAt } : m,
              ),
            );
          }

          return;
        }

        // El staff marco leido; el `unread` de esa conversacion cambia.
        void loadConversations();
      }
    },
    [loadConversations],
  );

  /**
   * Conexion en vivo.
   *
   * Se activa siempre: esta pagina solo existe para atender el chat, asi que no
   * hay un caso en que el staff la tenga abierta y no quiera recibir.
   */
  const { connected } = useLiveChat({
    fetchTicket: fetchStaffTicket,
    onEvent: handleLiveEvent,
  });

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId) return;

    setIsSending(true);
    try {
      const sent = await replyToConversation(selectedId, text);
      // Se limpia solo si el envio funciono: si falla, no se pierde lo escrito.
      setDraft("");
      setMessages((current) => [...current, sent]);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo enviar el mensaje."));
    } finally {
      setIsSending(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border-red-500/40 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* --- Lista de conversaciones --- */}
      <aside
        className={`flex w-full shrink-0 flex-col border-r border-stone-800 md:w-80 ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <header className="border-b border-stone-800 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 text-sm font-bold text-white">
              <MessageSquare className="h-4 w-4 text-amber-300" />
              Conversaciones
            </h1>

            {/*
              Indicador de conexion en vivo.

              Sin el, un socket caido es **invisible**: el staff veria una lista
              quieta y creeria que no hay mensajes, cuando en realidad no esta
              recibiendo nada. Preferible un aviso honesto a un silencio que
              parece calma.

              La reconexion es automatica (socket.io), asi que cuando vuelve se
              pone en verde sola.
            */}
            {connected ? (
              <span
                data-socket="connected"
                title="Recibiendo mensajes en vivo"
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400"
              >
                <Wifi className="h-3 w-3" />
                En vivo
              </span>
            ) : (
              <span
                data-socket="disconnected"
                title="Sin conexion en vivo: los mensajes nuevos aparecen al recargar"
                className="flex items-center gap-1 text-[10px] font-semibold text-amber-300"
              >
                <WifiOff className="h-3 w-3" />
                Reconectando
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] text-stone-400">
            Mensajes de tus pacientes desde la app.
          </p>

          {/*
            Interruptor del chat, aqui y no en "Cobro al agendar".

            En la pantalla de pagos el cliente no lo encontraria, y ademas
            activarlo tiene una consecuencia que conviene tener delante cuando
            se decide: hay que responderlo.
          */}
          <label className="mt-3 flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-white">
                {chatEnabled ? "Chat activado" : "Chat desactivado"}
              </span>
              {/* Aviso honesto: activarlo implica atenderlo. */}
              <span className="mt-0.5 block text-[10px] leading-relaxed text-stone-400">
                {chatEnabled
                  ? "Tus pacientes pueden escribirte hasta 24 h después de cada visita."
                  : "Al activarlo, alguien de tu equipo debe responder los mensajes."}
              </span>
            </span>

            <input
              type="checkbox"
              data-toggle-chat="true"
              checked={chatEnabled ?? false}
              disabled={isTogglingChat || chatEnabled === null}
              onChange={(e) => void handleToggleChat(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-700 bg-stone-800"
            />
          </label>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="animate-pulse px-4 py-6 text-sm text-stone-400">
              Cargando...
            </p>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8">
              {/*
                DOS estados vacios, y son distintos.

                Antes solo habia uno ("sin mensajes") y el cliente no podia
                saber si era que nadie escribio o que el chat esta APAGADO. Son
                dos cosas con soluciones opuestas: esperar, o activarlo.
              */}
              {chatEnabled === false ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-xs font-semibold text-amber-200">
                    El chat está desactivado
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-200/80">
                    Tus pacientes no pueden escribirte desde la app. Actívalo
                    para recibir sus mensajes.
                  </p>

                  <button
                    type="button"
                    data-enable-chat="true"
                    onClick={() => void handleToggleChat(true)}
                    disabled={isTogglingChat}
                    className="mt-3 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {isTogglingChat ? "Activando..." : "Activar el chat"}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-3 h-5 w-5 text-stone-600" />
                  <p className="text-sm text-stone-400">
                    Sin mensajes todavía.
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Aquí aparecen las conversaciones que abran tus pacientes
                    desde la app.
                  </p>
                </div>
              )}
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                data-conversation={conversation.id}
                onClick={() => void openConversation(conversation.id)}
                className={`flex w-full items-start gap-3 border-b border-stone-800/60 px-4 py-3 text-left transition hover:bg-stone-900/60 ${
                  selectedId === conversation.id ? "bg-stone-900/80" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white">
                      {conversation.patient.fullName}
                    </span>

                    {/* Contador de sin leer: es lo que permite ver de un vistazo
                        cual necesita respuesta, sin abrirlas todas. */}
                    {conversation.unread > 0 ? (
                      <span
                        data-unread={conversation.unread}
                        className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black"
                      >
                        {conversation.unread}
                      </span>
                    ) : null}
                  </div>

                  {conversation.lastMessage ? (
                    <p className="mt-0.5 truncate text-[11px] text-stone-400">
                      {conversation.lastMessage.sender === "staff" ? "Tú: " : ""}
                      {conversation.lastMessage.body}
                    </p>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* --- Hilo de la conversacion --- */}
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col ${
          selectedId ? "flex" : "hidden md:flex"
        }`}
      >
        {!selectedId ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-stone-500">
              Elige una conversación para leerla.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-stone-800 px-4 py-3">
              {/* Volver a la lista: solo en movil, donde la lista esta oculta. */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-white md:hidden"
                aria-label="Volver a la lista"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <span className="truncate text-sm font-semibold text-white">
                {patientName}
              </span>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {isLoadingThread ? (
                <p className="animate-pulse text-sm text-stone-400">
                  Cargando conversación...
                </p>
              ) : (
                messages.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))
              )}
            </div>

            <div className="border-t border-stone-800 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  data-reply-input="true"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia y Shift+Enter hace salto de linea: lo que
                    // espera quien escribe mensajes.
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe una respuesta..."
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-stone-800 bg-stone-950 px-3 py-3 text-sm text-white placeholder-stone-600 outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  data-send-reply="true"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || isSending}
                  className="flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSending ? "Enviando..." : "Enviar"}
                </button>
              </div>

              {/*
                Aviso de la ventana, al lado opuesto del paciente.
                El negocio SI puede responder fuera de plazo, pero conviene
                saber que el paciente podria no leerlo si su ventana cerro.
              */}
              <p className="mt-2 text-[11px] text-stone-500">
                Puedes responder siempre. El paciente puede escribirte hasta 24
                horas después de su visita.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Una burbuja del hilo.
 *
 * El negocio a la DERECHA y el paciente a la izquierda: es la convencion de
 * todas las apps de mensajeria, y aqui ademas hace evidente cual es la respuesta
 * del staff.
 */
function Bubble({ message }: { message: InboxMessage }) {
  const isStaff = message.sender === "staff";

  const time = new Date(message.createdAt).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  /**
   * Solo en los mensajes PROPIOS: el "Leido" dice que el paciente los vio, que
   * es lo que al staff le sirve. En los del paciente, `readAt` seria que el
   * mismo los leyo, y no aporta nada.
   *
   * Mismo formato que el lado del paciente ("· Leído" tras la hora): los dos
   * lados del chat dicen lo mismo de la misma forma.
   */
  const isRead = isStaff && Boolean(message.readAt);

  return (
    <div className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
          isStaff
            ? "bg-amber-400 text-black"
            : "border border-stone-800 bg-stone-900 text-stone-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.body}
        </p>
        <p
          className={`mt-1 text-[10px] ${
            isStaff ? "text-black/60" : "text-stone-500"
          }`}
        >
          {time}
          {isRead ? "  ·  Leído" : ""}
        </p>
      </div>
    </div>
  );
}