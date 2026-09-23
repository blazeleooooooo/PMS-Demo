"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useFinancialFormat } from "@/hooks/use-financial-format";

export interface NosItem {
  id: string;
  chinese_name: string | null;
  english_name: string | null;
  unit_price: number | null;
  cost: number | null;
  section_id: string | null;
  unit_id: string | null;
  unit_name?: string | null;
}

export interface NosSection {
  id: string;
  chinese_name: string | null;
  english_name: string | null;
  order: number | null;
}

interface NosItemPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: NosItem) => void;
  language: "Chi" | "Eng";
  defaultSectionId?: string;
}

export default function NosItemPicker({ open, onClose, onSelect, language, defaultSectionId }: NosItemPickerProps) {
  const { formatMoney } = useFinancialFormat();
  const supabase = createClient();
  const [sections, setSections] = useState<NosSection[]>([]);
  const [items, setItems] = useState<NosItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      const initialFilter = defaultSectionId || "";
      setSectionFilter(initialFilter);
      setSearchQuery("");
      loadSections();
      searchItems("", initialFilter);
    }
  }, [open, defaultSectionId]);

  async function loadSections() {
    const { data } = await supabase
      .from("nos_sections")
      .select("id, chinese_name, english_name, order")
      .order("order", { ascending: true });
    setSections(data || []);
  }

  async function searchItems(query: string, sectionId: string) {
    setLoading(true);
    try {
      let q = supabase
        .from("nos_items")
        .select("id, chinese_name, english_name, unit_price, cost, section_id, unit_id")
        .limit(50);

      if (query.trim()) {
        q = q.or(`chinese_name.ilike.%${query.trim()}%,english_name.ilike.%${query.trim()}%`);
      }

      if (sectionId) {
        q = q.eq("section_id", sectionId);
      }

      q = q.order("english_name", { ascending: true });

      const { data } = await q;
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchItems(value, sectionFilter);
    }, 300);
  }

  function handleSectionChange(value: string) {
    const val = value === "all" ? "" : value;
    setSectionFilter(val);
    searchItems(searchQuery, val);
  }

  function getItemName(item: NosItem) {
    if (language === "Eng") return item.english_name || item.chinese_name || "Unnamed Item";
    return item.chinese_name || item.english_name || "未命名項目";
  }

  function getSectionName(section: NosSection) {
    if (language === "Eng") return section.english_name || section.chinese_name || "";
    return section.chinese_name || section.english_name || "";
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-violet-600" />
            <h3 className="text-base font-semibold text-gray-800">
              {language === "Eng" ? "Select Item from Library" : "從項目庫選擇"}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b bg-gray-50 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={language === "Eng" ? "Search items..." : "搜尋項目..."}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={sectionFilter || "all"} onValueChange={handleSectionChange}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder={language === "Eng" ? "All Sections" : "所有分區"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "Eng" ? "All Sections" : "所有分區"}</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {getSectionName(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                {language === "Eng" ? "No items found" : "找不到項目"}
              </div>
            ) : (
              items.map((item) => {
                const section = sections.find((s) => s.id === item.section_id);
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-violet-50 transition-colors group flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-violet-700">
                        {getItemName(item)}
                      </p>
                      {section && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {getSectionName(section)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {item.unit_price != null && (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {formatMoney(item.unit_price)}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            {items.length} {language === "Eng" ? "items shown" : "個項目"}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            {language === "Eng" ? "Cancel" : "取消"}
          </Button>
        </div>
      </div>
    </div>
  );
}
