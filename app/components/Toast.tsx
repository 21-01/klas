import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
};

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  toast: {
    show: (message: string, type?: ToastType, options?: { title?: string; duration?: number; action?: ToastAction }) => void;
    success: (message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => void;
    error: (message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => void;
    info: (message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => void;
    warning: (message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", options?: { title?: string; duration?: number; action?: ToastAction }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, title: options?.title, duration: options?.duration, action: options?.action }]);
  }, []);

  const success = useCallback((message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => {
    show(message, "success", options);
  }, [show]);

  const error = useCallback((message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => {
    show(message, "error", options);
  }, [show]);

  const info = useCallback((message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => {
    show(message, "info", options);
  }, [show]);

  const warning = useCallback((message: string, options?: { title?: string; duration?: number; action?: ToastAction }) => {
    show(message, "warning", options);
  }, [show]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: { show, success, error, info, warning } }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-3 max-w-full sm:w-[420px] pointer-events-none">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { id, message, type, title, action } = item;
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const duration = item.duration ?? DEFAULT_DURATION[type];
    const timer = setTimeout(() => setExiting(true), duration);
    return () => clearTimeout(timer);
  }, [item.duration, type]);

  useEffect(() => {
    if (exiting) {
      const timer = setTimeout(() => onDismiss(id), 300);
      return () => clearTimeout(timer);
    }
  }, [exiting, id, onDismiss]);

  const config = {
    success: {
      icon: <CheckCircle className="size-[22px] text-status-success" />,
      border: "border-l-[5px] border-l-status-success",
      bg: "bg-white/95",
    },
    error: {
      icon: <XCircle className="size-[22px] text-status-error" />,
      border: "border-l-[5px] border-l-status-error",
      bg: "bg-white/95",
    },
    warning: {
      icon: <AlertTriangle className="size-[22px] text-amber-500" />,
      border: "border-l-[5px] border-l-amber-500",
      bg: "bg-white/95",
    },
    info: {
      icon: <Info className="size-[22px] text-brand-logo" />,
      border: "border-l-[5px] border-l-brand-logo",
      bg: "bg-white/95",
    },
  }[type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-4 p-5 rounded-xl border border-brand-border/40 shadow-[0_10px_35px_rgb(0,0,0,0.08)] backdrop-blur-md transition-all duration-300 transform",
        exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0 animate-toast-slide-in",
        config.bg,
        config.border
      )}
      role="alert"
      onMouseEnter={() => setExiting(false)}
      onMouseLeave={() => setExiting(true)}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        {title && (
          <div className="text-[13px] font-bold text-brand-text leading-tight mb-0.5">{title}</div>
        )}
        <div className="text-[14px] font-medium text-brand-text leading-snug">{message}</div>
        {action && (
          <button
            onClick={() => { action.onClick(); setExiting(true); }}
            className="mt-2 text-[12px] font-bold text-brand-secondary hover:text-brand-primary transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => setExiting(true)}
        className="shrink-0 text-brand-text-dim hover:text-brand-text p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
