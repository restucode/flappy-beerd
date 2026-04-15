"use client";

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  txHash?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId++;
      const duration = t.duration ?? (t.type === "loading" ? 0 : 4000);
      setToasts((prev) => [...prev, { ...t, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50);
    return () => clearTimeout(t);
  }, []);

  const colors = {
    success: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.4)", color: "#34D399", icon: "✓" },
    error: { bg: "rgba(255,107,107,0.12)", border: "rgba(255,107,107,0.4)", color: "#FF6B6B", icon: "✕" },
    info: { bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.4)", color: "#22D3EE", icon: "ⓘ" },
    loading: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.4)", color: "#8B5CF6", icon: "" },
  };
  const c = colors[toast.type];

  return (
    <div
      className="pointer-events-auto rounded-2xl px-4 py-3 backdrop-blur-md transition-all duration-300 flex items-start gap-3 min-w-[280px]"
      style={{
        background: `linear-gradient(135deg, ${c.bg}, rgba(10,15,31,0.85))`,
        border: `1px solid ${c.border}`,
        boxShadow: `0 12px 32px rgba(0,0,0,0.5), 0 0 24px ${c.bg}`,
        opacity: entering ? 0 : 1,
        transform: entering ? "translateX(20px)" : "translateX(0)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black"
        style={{
          background: c.color,
          color: "#0a0f1f",
          fontFamily: "var(--font-display)",
          fontSize: 14,
        }}
      >
        {toast.type === "loading" ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1f]/30 border-t-[#0a0f1f] animate-spin" />
        ) : (
          c.icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {toast.description}
          </p>
        )}
        {toast.txHash && (
          <a
            href={`https://basescan.org/tx/${toast.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold mt-1 inline-block transition-opacity hover:opacity-70"
            style={{ color: c.color, fontFamily: "var(--font-mono)" }}
          >
            {toast.txHash.slice(0, 10)}...{toast.txHash.slice(-6)} →
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-xs flex-shrink-0 transition-opacity hover:opacity-100 opacity-50"
        style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}
