"use client";

import React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  readOnly?: boolean;
}

// Lazy-load the actual editor to completely avoid SSR issues with TipTap
const RichTextEditorInner = dynamic(() => import("./rich-text-editor-inner"), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden" style={{ minHeight: "120px" }} />
  ),
});

export default function RichTextEditor(props: RichTextEditorProps) {
  return <RichTextEditorInner {...props} />;
}

// ─── TOOLBAR SUBCOMPONENTS (exported for inner component) ───────────────────

export function ToolbarButton({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}
