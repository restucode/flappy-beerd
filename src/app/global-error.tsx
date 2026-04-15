"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#080E1A", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 380 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💥</div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#FCA5A5" }}>Something broke</h1>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 16px", fontFamily: "monospace" }}>
            {error.message}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#4DC9F6,#1A8FE3)",
              color: "white",
              border: "none",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
