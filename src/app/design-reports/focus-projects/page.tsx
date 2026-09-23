"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL → /design-reports/3d-output */
export default function FocusProjectsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/design-reports/3d-output");
  }, [router]);
  return null;
}
