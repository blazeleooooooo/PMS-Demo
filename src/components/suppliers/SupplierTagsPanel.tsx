"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Check,
  X,
  Loader2,
  Save,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchSupplierTagsGrouped,
  saveSupplierTags,
  type SupplierTagOption,
  type SupplierTagEntry,
} from "@/lib/data-service";

// ─── TYPES ──────────────────────────────────────────────
interface SelectedTag {
  tagId: string; // nos_supplier_tags.id
  junctionRowId?: string; // supplier_supplier_tags.id (for existing rows)
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function SupplierTagsPanel({
  supplierId,
}: {
  supplierId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allTags, setAllTags] = useState<SupplierTagOption[]>([]);
  const [originalTags, setOriginalTags] = useState<SupplierTagEntry[]>([]);
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await fetchSupplierTagsGrouped(supplierId);
      setAllTags(result.allTags);
      setOriginalTags(result.supplierTags);

      // Initialize selected tags from current supplier tags
      const initial: SelectedTag[] = result.supplierTags.map((st) => ({
        tagId: st.supplier_tag_id,
        junctionRowId: st.id,
      }));
      setSelectedTags(initial);
      setLoading(false);
    }
    load();
  }, [supplierId]);

  // Check if tag is selected
  const isSelected = useCallback(
    (tagId: string) => selectedTags.some((t) => t.tagId === tagId),
    [selectedTags]
  );

  // Toggle tag selection (multi-select)
  const toggleTag = useCallback(
    (tagId: string) => {
      setSelectedTags((prev) => {
        const exists = prev.find((t) => t.tagId === tagId);
        if (exists) {
          // Deselect
          return prev.filter((t) => t.tagId !== tagId);
        } else {
          // Add
          return [...prev, { tagId }];
        }
      });
      setDirty(true);
      setSaveMessage(null);
    },
    []
  );

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    // Compute diff
    const originalTagIds = new Set(originalTags.map((t) => t.supplier_tag_id));
    const selectedTagIds = new Set(selectedTags.map((t) => t.tagId));

    // Tags to add: selected but not in original
    const toAdd = selectedTags
      .filter((t) => !originalTagIds.has(t.tagId))
      .map((t) => t.tagId);

    // Tags to remove: in original but not selected — get junction row IDs
    const toRemove = originalTags
      .filter((t) => !selectedTagIds.has(t.supplier_tag_id))
      .map((t) => t.id);

    if (toAdd.length === 0 && toRemove.length === 0) {
      setSaving(false);
      setDirty(false);
      setSaveMessage({ type: "success", text: "未有變更" });
      return;
    }

    const result = await saveSupplierTags(supplierId, toAdd, toRemove);

    if (result.success) {
      // Reload to get updated junction row IDs
      const refreshed = await fetchSupplierTagsGrouped(supplierId);
      setOriginalTags(refreshed.supplierTags);
      setSelectedTags(
        refreshed.supplierTags.map((st) => ({
          tagId: st.supplier_tag_id,
          junctionRowId: st.id,
        }))
      );
      setDirty(false);
      setEditMode(false);
      setSaveMessage({ type: "success", text: "標籤已更新" });
    } else {
      setSaveMessage({ type: "error", text: result.error || "儲存失敗" });
    }

    setSaving(false);
  };

  // Cancel changes
  const handleCancel = () => {
    const initial: SelectedTag[] = originalTags.map((st) => ({
      tagId: st.supplier_tag_id,
      junctionRowId: st.id,
    }));
    setSelectedTags(initial);
    setDirty(false);
    setEditMode(false);
    setSaveMessage(null);
  };

  // Enter edit mode
  const handleEnterEdit = () => {
    setEditMode(true);
  };

  // Helper: get display info for selected tags
  const getSelectedTagDisplays = () => {
    return selectedTags
      .map((st) => {
        const tag = allTags.find((t) => t.id === st.tagId);
        return { ...st, tag };
      })
      .filter((item) => item.tag);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">載入標籤中...</span>
        </div>
      </div>
    );
  }

  // ── COLLAPSED VIEW (default) ──────────────────────────
  if (!editMode) {
    const displayTags = getSelectedTagDisplays();
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-600" />
            供應商標籤 Supplier Tags
          </h2>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span
                className={`text-xs ${
                  saveMessage.type === "success"
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {saveMessage.text}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnterEdit}
              className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2"
            >
              <Pencil className="w-3 h-3 mr-1" />
              編輯
            </Button>
          </div>
        </div>

        {/* Selected Tags Summary */}
        <div className="px-5 py-3">
          {displayTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {displayTags.map((item) => (
                <Badge
                  key={item.tagId}
                  variant="outline"
                  className="text-[13px] bg-violet-50 text-violet-700 border-violet-200"
                >
                  {item.tag!.tag_name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">尚未設定標籤</p>
          )}
        </div>
      </div>
    );
  }

  // ── EXPANDED EDIT VIEW ────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-violet-200 overflow-hidden ring-1 ring-violet-100">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 bg-violet-50/30">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag className="w-4 h-4 text-violet-600" />
          供應商標籤 Supplier Tags
          <Badge variant="outline" className="text-[12px] px-1.5 py-0 h-4 border-violet-200 text-violet-600 bg-violet-50">
            編輯中
          </Badge>
        </h2>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span
              className={`text-xs ${
                saveMessage.type === "success"
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {saveMessage.text}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            取消
          </Button>
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-violet-600 hover:bg-violet-700 text-white h-7 px-3"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              儲存
            </Button>
          )}
        </div>
      </div>

      {/* Tags Grid */}
      <div className="px-5 py-4">
        <p className="text-xs text-gray-400 mb-2">
          點擊標籤以選擇/取消選擇（可多選）
        </p>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = isSelected(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-all duration-150 cursor-pointer
                  ${
                    active
                      ? "bg-violet-600 text-white border-transparent shadow-sm"
                      : "bg-violet-50 text-violet-700 border-violet-200 hover:shadow-sm"
                  }
                `}
              >
                {active && <Check className="w-3 h-3" />}
                {tag.tag_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      {selectedTags.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[12px] text-gray-400 mb-1">已選標籤 ({selectedTags.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((st) => {
              const tag = allTags.find((t) => t.id === st.tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={st.tagId}
                  variant="outline"
                  className="text-[13px] bg-violet-50 text-violet-700 border-violet-200"
                >
                  {tag.tag_name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
