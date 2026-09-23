"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Daily Task Report is for AI/backend reporting only — not exposed in the UI.
// Redirect to home if someone navigates here.
export default function DailyReportsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}

