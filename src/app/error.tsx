"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Route-level error boundary. App Router requires this to recover from render
// errors during navigation; without it Next.js shows "missing required error
// components, refreshing..." and hard-reloads in a loop.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">頁面發生錯誤</h2>
        <p className="text-sm text-gray-500 mt-1">Something went wrong loading this page.</p>
        {error?.message && (
          <p className="text-xs text-gray-400 mt-3 break-words font-mono bg-gray-50 rounded-lg px-3 py-2">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => {
              // Soft reset often rethrows immediately with no visible change.
              // Hard reload recovers when the underlying fault was transient.
              reset();
              window.location.reload();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bw-blue text-white text-sm font-medium hover:bg-bw-blue/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重試
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}
