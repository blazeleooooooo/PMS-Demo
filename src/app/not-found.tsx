import Link from "next/link";
import { FileQuestion } from "lucide-react";

// Root not-found boundary. App Router needs this; without it a 404 during
// navigation can trigger the "missing required error components" fallback.
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-4">
          <FileQuestion className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">找不到頁面</h2>
        <p className="text-sm text-gray-500 mt-1">404 — Page not found.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-bw-blue text-white text-sm font-medium hover:bg-bw-blue/90 transition-colors"
        >
          返回首頁
        </Link>
      </div>
    </div>
  );
}
