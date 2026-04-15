"use client";

import React from "react";

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Hook for monitoring (Sentry, LogRocket, etc.)
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, { extra: info });
    } else {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-deep, #080E1A)" }}
    >
      <div
        className="max-w-sm w-full rounded-3xl p-6 text-center"
        style={{
          background: "linear-gradient(180deg, #1B2542 0%, #0A0F1F 100%)",
          border: "1px solid rgba(239,68,68,0.3)",
          boxShadow: "0 30px 80px rgba(239,68,68,0.2)",
        }}
      >
        <div className="text-5xl mb-3">💥</div>
        <h1
          className="text-xl font-black mb-2"
          style={{ color: "#FCA5A5", fontFamily: "var(--font-display)" }}
        >
          Something broke
        </h1>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--text-muted, #94A3B8)", fontFamily: "var(--font-mono)" }}
        >
          {error.message || "Unknown error"}
        </p>
        <button
          onClick={reset}
          className="px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
          style={{
            background: "var(--grad-quota, linear-gradient(135deg,#4DC9F6,#1A8FE3))",
            color: "white",
            fontFamily: "var(--font-display)",
            boxShadow: "0 6px 20px rgba(77,201,246,0.3)",
          }}
        >
          Try again
        </button>
        <a
          href="/"
          className="block mt-3 text-xs"
          style={{ color: "var(--cyan, #22D3EE)", fontFamily: "var(--font-display)" }}
        >
          ← Back to home
        </a>
      </div>
    </div>
  );
}
