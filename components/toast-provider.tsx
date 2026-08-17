"use client";

import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastInput = {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, "type" | "title">> & {
  id: string;
  description?: string;
  durationMs: number | null;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number | null> = {
  success: 4500,
  info: 4500,
  warning: 7500,
  error: 12000
};

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle2; className: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-[#b7dcc4] bg-[#f0fbf3]",
    iconClassName: "text-[#2d7d46]"
  },
  error: {
    icon: AlertCircle,
    className: "border-coral/35 bg-[#fff0ed]",
    iconClassName: "text-coral"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-saffron/45 bg-[#fff7df]",
    iconClassName: "text-[#9a6500]"
  },
  info: {
    icon: Info,
    className: "border-[#b9d4e8] bg-[#eef7fd]",
    iconClassName: "text-[#246a99]"
  }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const type = input.type ?? "info";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nextToast: ToastItem = {
      id,
      type,
      title: input.title,
      description: input.description,
      durationMs: input.durationMs === undefined ? DEFAULT_DURATIONS[type] : input.durationMs
    };
    setToasts((current) => [nextToast, ...current].slice(0, 5));
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismissToast }), [dismissToast, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport fixed right-4 top-4 z-[1000] grid w-[min(420px,calc(100vw-2rem))] gap-3 sm:right-5 sm:top-5">
        {toasts.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;

  useEffect(() => {
    if (toast.durationMs === null) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <div
      className={clsx(
        "toast-card grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md border px-3 py-3 text-sm text-ink shadow-[0_16px_40px_rgba(23,32,27,0.16)]",
        style.className
      )}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", style.iconClassName)} aria-hidden="true" />
      <div className="min-w-0">
        <div className="font-semibold leading-5">{toast.title}</div>
        {toast.description ? <div className="mt-1 break-words text-sm leading-5 text-moss">{toast.description}</div> : null}
      </div>
      <button
        type="button"
        className="rounded p-1 text-moss transition hover:bg-white/70 hover:text-ink"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificacion"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }
  return context;
}
