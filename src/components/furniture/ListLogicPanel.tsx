"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FURNITURE_LIST_LOGIC,
  type FurnitureListLogicPageId,
} from "@/lib/furniture-list-logic";

interface ListLogicPanelProps {
  pageId: FurnitureListLogicPageId;
}

export default function ListLogicPanel({ pageId }: ListLogicPanelProps) {
  const [open, setOpen] = useState(false);
  const logic = FURNITURE_LIST_LOGIC[pageId];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
          >
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-sm text-gray-700">
              {open ? logic.title : "查看此頁列表條件"}
            </span>
            {open ? (
              <ChevronUp className="w-4 h-4 ml-auto text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-auto text-gray-400 shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3.5 pt-0 space-y-1.5 border-t border-gray-100">
            <ul className="mt-2.5 space-y-1 text-sm text-gray-600 list-disc list-inside">
              {logic.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            {logic.note ? (
              <p className="text-xs text-gray-500 pt-1 pl-0.5">{logic.note}</p>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
