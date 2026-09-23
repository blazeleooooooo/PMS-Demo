"use client";

import React from "react";
import { AsanaIcon } from "@/components/ui/asana-icon";

interface AsanaLinkButtonProps {
  href?: string | null;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Compact Asana logo that opens the related task/project link in a new tab.
 * Renders nothing when the href is empty so list rows stay clean.
 */
export function AsanaLinkButton({
  href,
  size = 16,
  className = "",
  title = "開啟 Asana",
}: AsanaLinkButtonProps) {
  if (!href?.trim()) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`w-7 h-7 rounded-md inline-flex items-center justify-center hover:bg-gray-100 transition-colors ${className}`}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      <AsanaIcon size={size} />
    </a>
  );
}

export default AsanaLinkButton;
