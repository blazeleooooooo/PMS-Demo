"use client";

import { Pencil } from "lucide-react";

export function BWFOrderEditButton({
  onClick,
  visible = true,
}: {
  onClick: () => void;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
      title="編輯訂單"
    >
      <Pencil className="w-4 h-4 text-gray-500" />
    </button>
  );
}
