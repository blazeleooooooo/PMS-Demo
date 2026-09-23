"use client";

import { useSearchParams } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Suspense } from "react";
import { AccessDenied } from "@/components/ui/access-denied";

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const module = searchParams.get("module") || undefined;

  return <AccessDenied module={module} fullPage />;
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f1117]">
        <ShieldX className="w-10 h-10 text-red-500 animate-pulse" />
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
