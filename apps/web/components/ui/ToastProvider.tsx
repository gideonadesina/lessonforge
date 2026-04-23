"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = {
  id: number;
  message: string;
  subtext: string | null;
  action: ToastAction | null;
  color: ToastColor;
  duration: ToastDuration;
};

type ToastColor = "default" | "rose" | "amber";
type ToastDuration = number | "persistent";

type ToastAction = {
  label: string;
  href: string;
};

type ToastInput =
  | string
  | {
      message: string;
      subtext?: string;
      action?: ToastAction | null;
      duration?: ToastDuration;
      color?: ToastColor;
    };

type ToastContextType = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const normalized: Toast =
      typeof input === "string"
        ? {
            id,
            message: input,
            subtext: null,
            action: null,
            color: "default",
            duration: 4000,
          }
        : {
            id,
            message: input.message,
            subtext: input.subtext?.trim() || null,
            action: input.action ?? null,
            color: input.color ?? "default",
            duration: input.duration ?? 4000,
          };

    setToasts((prev) => [...prev, normalized]);

    if (normalized.duration !== "persistent") {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, normalized.duration);
      timersRef.current.set(id, timer);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast UI */}
      <div className="fixed right-5 top-5 z-50 w-full max-w-sm space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "rounded-xl border px-4 py-3 animate-in fade-in slide-in-from-top-2",
              toast.color === "rose"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : toast.color === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-900",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.message}</p>
                {toast.subtext ? (
                  <p className="mt-1 text-xs text-current/80">{toast.subtext}</p>
                ) : null}
                {toast.action ? (
                  <Link
                    href={toast.action.href}
                    className="mt-2 inline-flex rounded-lg border border-current px-2 py-1 text-xs font-semibold text-current"
                  >
                    {toast.action.label}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold text-current"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}