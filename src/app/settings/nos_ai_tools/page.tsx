"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** AI 工具 lives under 工作匯報設定 as a sub-tab. */
export default function NosAiToolsSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/task-reporting?tab=ai-tools");
  }, [router]);

  return null;
}
