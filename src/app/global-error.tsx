"use client";

import { useEffect } from "react";

// Global error boundary — catches errors thrown in the root layout itself.
// Must render its own <html>/<body> because it replaces the root layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              textAlign: "center",
              background: "#fff",
              border: "1px solid #f1f5f9",
              borderRadius: "16px",
              padding: "32px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              系統發生錯誤
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", marginTop: "6px" }}>
              A critical error occurred. Please try again.
            </p>
            <div style={{ marginTop: "24px", display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => {
                  // Soft reset() often rethrows immediately with no visible change.
                  // Hard reload is what users expect from Retry on a critical error.
                  reset();
                  window.location.reload();
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                重試
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "#fff",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
