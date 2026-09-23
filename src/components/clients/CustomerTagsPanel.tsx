"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Check,
  X,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchCustomerTagsGrouped,
  saveCustomerTags,
  type TagCollection,
  type CustomerTagEntry,
} from "@/lib/data-service";
import { usePermission } from "@/hooks/use-permission";

// ─── COLLECTION COLORS ─────────────────────────────────
const COLLECTION_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  "3ec5145d-19dd-45d0-b0cf-8ffed5114e81": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    activeBg: "bg-blue-600",
    activeText: "text-white",
  },
  "4f5de598-2dcb-45a6-a106-9d933e9a8007": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    activeBg: "bg-amber-500",
    activeText: "text-white",
  },
  "eb5a7764-9ebf-4829-9991-db09538aab76": {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    activeBg: "bg-violet-600",
    activeText: "text-white",
  },
};

const DEFAULT_COLORS = {
  bg: "bg-gray-50",
  text: "text-gray-700",
  border: "border-gray-200",
  activeBg: "bg-gray-700",
  activeText: "text-white",
};

function getCollectionColor(collectionId: string) {
  return COLLECTION_COLORS[collectionId] ?? DEFAULT_COLORS;
}

// ─── TYPES ──────────────────────────────────────────────
interface SelectedTag {
  tagId: string;
  collectionId: string;
  // From existing customer_tags row (for removal tracking)
  customerTagRowId?: string;
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function CustomerTagsPanel({
  customerId,
  permissionModule = "clients",
}: {
  customerId: string;
  permissionModule?: string;
}) {
  const { canEdit: canEditPerm } = usePermission();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<TagCollection[]>([]);
  const [originalTags, setOriginalTags] = useState<CustomerTagEntry[]>([]);
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await fetchCustomerTagsGrouped(customerId);
      setCollections(result.collections);
      setOriginalTags(result.customerTags);

      // Initialize selected tags from current customer tags
      const initial: SelectedTag[] = result.customerTags.map((ct) => ({
        tagId: ct.tag_uuid,
        collectionId: ct.collection_uuid,
        customerTagRowId: ct.id,
      }));
      setSelectedTags(initial);

      // Expand all collections when in edit mode
      const expanded = new Set<string>();
      result.collections.forEach((c) => expanded.add(c.id));
      setExpandedCollections(expanded);

      setLoading(false);
    }
    load();
  }, [customerId]);

  // Check if tag is selected
  const isSelected = useCallback(
    (tagId: string) => selectedTags.some((t) => t.tagId === tagId),
    [selectedTags]
  );

  // Toggle tag selection
  const toggleTag = useCallback(
    (tagId: string, collectionId: string, isSingleSelect: boolean) => {
      setSelectedTags((prev) => {
        const exists = prev.find((t) => t.tagId === tagId);
        if (exists) {
          // Deselect
          return prev.filter((t) => t.tagId !== tagId);
        } else {
          if (isSingleSelect) {
            // For single select: replace existing tag in this collection
            const filtered = prev.filter((t) => t.collectionId !== collectionId);
            return [...filtered, { tagId, collectionId }];
          } else {
            // For multi select: add
            return [...prev, { tagId, collectionId }];
          }
        }
      });
      setDirty(true);
      setSaveMessage(null);
    },
    []
  );

  // Toggle collection expand/collapse
  const toggleCollection = useCallback((collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }, []);

  // Count selected in a collection
  const countSelected = useCallback(
    (collectionId: string) =>
      selectedTags.filter((t) => t.collectionId === collectionId).length,
    [selectedTags]
  );

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    // Compute diff
    const originalTagIds = new Set(originalTags.map((t) => t.tag_uuid));
    const selectedTagIds = new Set(selectedTags.map((t) => t.tagId));

    // Tags to add: selected but not in original
    const toAdd = selectedTags
      .filter((t) => !originalTagIds.has(t.tagId))
      .map((t) => ({ tag_uuid: t.tagId, collection_uuid: t.collectionId }));

    // Tags to remove: in original but not selected
    const toRemove = originalTags
      .filter((t) => !selectedTagIds.has(t.tag_uuid))
      .map((t) => t.id);

    if (toAdd.length === 0 && toRemove.length === 0) {
      setSaving(false);
      setDirty(false);
      setSaveMessage({ type: "success", text: "未有變更" });
      return;
    }

    const result = await saveCustomerTags(customerId, toAdd, toRemove);

    if (result.success) {
      // Reload to get updated row IDs
      const refreshed = await fetchCustomerTagsGrouped(customerId);
      setOriginalTags(refreshed.customerTags);
      setSelectedTags(
        refreshed.customerTags.map((ct) => ({
          tagId: ct.tag_uuid,
          collectionId: ct.collection_uuid,
          customerTagRowId: ct.id,
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
    const initial: SelectedTag[] = originalTags.map((ct) => ({
      tagId: ct.tag_uuid,
      collectionId: ct.collection_uuid,
      customerTagRowId: ct.id,
    }));
    setSelectedTags(initial);
    setDirty(false);
    setEditMode(false);
    setSaveMessage(null);
  };

  // Enter edit mode
  const handleEnterEdit = () => {
    setEditMode(true);
    // Expand all collections on entering edit mode
    const expanded = new Set<string>();
    collections.forEach((c) => expanded.add(c.id));
    setExpandedCollections(expanded);
  };

  // Helper: get display info for selected tags
  const getSelectedTagDisplays = () => {
    return selectedTags.map((st) => {
      const collection = collections.find((c) => c.id === st.collectionId);
      const tag = collection?.tags.find((t) => t.id === st.tagId);
      const colors = getCollectionColor(st.collectionId);
      return { ...st, tag, colors, collectionDisplay: collection?.display };
    }).filter((item) => item.tag);
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
            <Tag className="w-4 h-4 text-bw-violet" />
            客戶標籤 Customer Tags
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
            {canEditPerm(permissionModule) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnterEdit}
              className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2"
            >
              <Pencil className="w-3 h-3 mr-1" />
              編輯
            </Button>
            )}
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
                  className={`text-[13px] ${item.colors.bg} ${item.colors.text} ${item.colors.border}`}
                >
                  {item.tag!.display}
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
    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden ring-1 ring-blue-100">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 bg-blue-50/30">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Tag className="w-4 h-4 text-bw-violet" />
          客戶標籤 Customer Tags
          <Badge variant="outline" className="text-[12px] px-1.5 py-0 h-4 border-blue-200 text-blue-600 bg-blue-50">
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
              className="text-xs bg-bw-blue hover:bg-bw-blue/90 text-white h-7 px-3"
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

      {/* Collections */}
      <div className="divide-y divide-gray-50">
        {collections.map((collection) => {
          const colors = getCollectionColor(collection.id);
          const isExpanded = expandedCollections.has(collection.id);
          const selectedCount = countSelected(collection.id);

          return (
            <div key={collection.id}>
              {/* Collection Header */}
              <button
                onClick={() => toggleCollection(collection.id)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2 h-2 rounded-full ${colors.activeBg}`}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {collection.display}
                  </span>
                  {collection.isSingleSelect && (
                    <Badge
                      variant="outline"
                      className="text-[12px] px-1.5 py-0 h-4 border-amber-200 text-amber-600 bg-amber-50"
                    >
                      單選
                    </Badge>
                  )}
                  {selectedCount > 0 && (
                    <Badge className={`text-[12px] px-1.5 py-0 h-4 ${colors.activeBg} ${colors.activeText} border-0`}>
                      {selectedCount}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span className="text-xs">
                    {collection.tags.length} 標籤
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Tags Grid */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {collection.tags.map((tag) => {
                      const active = isSelected(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            toggleTag(
                              tag.id,
                              collection.id,
                              collection.isSingleSelect
                            )
                          }
                          className={`
                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                            border transition-all duration-150 cursor-pointer
                            ${
                              active
                                ? `${colors.activeBg} ${colors.activeText} border-transparent shadow-sm`
                                : `${colors.bg} ${colors.text} ${colors.border} hover:shadow-sm`
                            }
                          `}
                        >
                          {active && <Check className="w-3 h-3" />}
                          {tag.display}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {selectedTags.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((st) => {
              const collection = collections.find((c) => c.id === st.collectionId);
              const tag = collection?.tags.find((t) => t.id === st.tagId);
              const colors = getCollectionColor(st.collectionId);
              if (!tag) return null;
              return (
                <Badge
                  key={st.tagId}
                  variant="outline"
                  className={`text-[13px] ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {tag.display}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
