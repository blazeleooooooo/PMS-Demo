import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bw-bg">
          <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
