"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 4000;

const VARIANTS: Record<
  ToastVariant,
  { container: string; icon: string; Icon: typeof Info }
> = {
  success: {
    container: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    icon: "text-emerald-400",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-red-500/40 bg-red-500/10 text-red-300",
    icon: "text-red-400",
    Icon: AlertCircle,
  },
  info: {
    container: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    icon: "text-blue-400",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setToasts((current) => [...current, { id, message, variant }]);

      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const success = useCallback((message: string) => toast(message, "success"), [
    toast,
  ]);
  const error = useCallback((message: string) => toast(message, "error"), [
    toast,
  ]);
  const info = useCallback((message: string) => toast(message, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const { container, icon, Icon } = VARIANTS[item.variant];

          return (
            <div
              key={item.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-sm shadow-lg backdrop-blur ${container}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
              <p className="flex-1 leading-snug">{item.message}</p>
              <button
                onClick={() => dismiss(item.id)}
                className="shrink-0 opacity-60 transition hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error("useToast debe ser usado dentro de ToastProvider");
  return context;
};
