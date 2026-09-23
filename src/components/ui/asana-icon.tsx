"use client";

import React from "react";

interface AsanaIconProps {
  className?: string;
  size?: number;
}

/**
 * Inline SVG Asana logo (coral three-dot triangle mark).
 * Avoids broken image issues from <img> tags in different environments.
 */
export function AsanaIcon({ className = "", size = 20 }: AsanaIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
    >
      <circle cx="24" cy="10.5" r="7.5" fill="#F06A6A" />
      <circle cx="10.5" cy="31.5" r="7.5" fill="#F06A6A" />
      <circle cx="37.5" cy="31.5" r="7.5" fill="#F06A6A" />
    </svg>
  );
}

export default AsanaIcon;
