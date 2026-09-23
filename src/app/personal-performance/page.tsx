"use client";

// Short alias → individual-scoped personal performance (staff-locked).
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PersonalPerformanceAliasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/individual-reports/personal-performance");
  }, [router]);
  return null;
}
