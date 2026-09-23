"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ImageIcon, X, Pencil, Save, Loader2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  parseBubbleImageUrls,
  serializeImageUrls,
  itemsFromUrls,
  MultiImageUploader,
} from "@/components/ui/multi-image-uploader";
import { Button } from "@/components/ui/button";
import { updateBWAPitching } from "@/lib/data-service";
import { useToast } from "@/components/ui/use-toast";

export type PersistPhotoUrls = (
  serialized: string
) => Promise<{ success: boolean; error?: string }>;

function SortablePhotoThumb({
  id,
  url,
  index,
  sortable,
  onOpen,
}: {
  id: string;
  url: string;
  index: number;
  sortable: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.7 : 1,
      }}
      {...attributes}
      {...(sortable ? listeners : {})}
      onClick={onOpen}
      className={`group relative aspect-square rounded-md overflow-hidden border border-gray-100 bg-gray-50 hover:ring-2 hover:ring-bw-blue/40 transition ${
        sortable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Site photo ${index + 1}`}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        draggable={false}
      />
      {sortable && (
        <span className="absolute top-1 left-1 rounded bg-black/45 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" />
        </span>
      )}
    </button>
  );
}

// Gallery for a project / pitching's 現場相片 Site Photos
// (or BWF 完工相片 when persistPhotos / bucket are overridden).
//
// Site photos always live on the linked pitching (bwa_pitchings.site_photos),
// so editing saves there — for a project detail, pass the project's pitching_id.
// When `pitchingId` + `editable` are provided the gallery shows an Edit mode
// (MultiImageUploader → save). Otherwise it's a read-only thumbnail grid.
export default function SitePhotosGallery({
  rawPhotos,
  pitchingId,
  persistPhotos,
  bucket = "site-photos",
  pathPrefix,
  editable = false,
  onSaved,
  title = "現場相片 Site Photos",
  photoLabel = "現場相片",
}: {
  rawPhotos: string | null | undefined;
  /** Pitching that owns site_photos. Required for editing unless persistPhotos is set. */
  pitchingId?: string | null;
  /** Override the default updateBWAPitching(site_photos) write. */
  persistPhotos?: PersistPhotoUrls;
  bucket?: string;
  pathPrefix?: string;
  /** Whether to show the edit affordance (caller gates on permission). */
  editable?: boolean;
  /** Called after a successful save (parent can refresh its data). */
  onSaved?: (urls: string[]) => void;
  title?: string;
  photoLabel?: string;
}) {
  const { toast } = useToast();
  // Working copy of the URLs; resyncs when the source changes.
  const [urls, setUrls] = useState<string[]>(() => parseBubbleImageUrls(rawPhotos));
  useEffect(() => {
    setUrls(parseBubbleImageUrls(rawPhotos));
  }, [rawPhotos]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const skipNextClickRef = useRef(false);

  const persistId = pathPrefix || pitchingId || "";
  const canEdit = editable && (!!persistPhotos || !!pitchingId);
  const canReorder = canEdit && !editing && urls.length > 1;

  const persistSerialized = async (serialized: string) => {
    if (persistPhotos) return persistPhotos(serialized);
    if (!pitchingId) return { success: false, error: "Missing pitching" };
    return updateBWAPitching(pitchingId, {
      site_photos: serialized,
      modified_date: new Date().toISOString(),
    });
  };
  const items = useMemo(() => itemsFromUrls(urls), [urls]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const startEdit = () => {
    setDraft(urls);
    setEditing(true);
  };

  const persistOrder = async (next: string[]) => {
    if (!canEdit) return;
    const previous = urls;
    setUrls(next);
    setSaving(true);
    try {
      const res = await persistSerialized(serializeImageUrls(next));
      if (!res.success) throw new Error(res.error || "儲存失敗");
      onSaved?.(next);
      toast({ title: "已更新順序", description: `${photoLabel}排序已儲存` });
    } catch (err: unknown) {
      setUrls(previous);
      const message = err instanceof Error ? err.message : "儲存失敗";
      toast({ title: "儲存失敗", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    skipNextClickRef.current = true;
    window.setTimeout(() => {
      skipNextClickRef.current = false;
    }, 150);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(urls, oldIndex, newIndex));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await persistSerialized(serializeImageUrls(draft));
      if (!res.success) throw new Error(res.error || "儲存失敗");
      setUrls(draft);
      setEditing(false);
      onSaved?.(draft);
      toast({ title: "已儲存", description: `${photoLabel}已更新` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "儲存失敗";
      toast({ title: "儲存失敗", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-bw-blue" />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">({editing ? draft.length : urls.length})</span>
        {canReorder && (
          <span className="text-[11px] text-gray-400">拖曳調整順序</span>
        )}
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs text-gray-500 hover:text-bw-blue"
            onClick={startEdit}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> 編輯
          </Button>
        )}
        {editing && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              儲存
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              取消
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <MultiImageUploader
          value={draft}
          onChange={setDraft}
          bucket={bucket}
          pathPrefix={persistId || undefined}
          maxImages={20}
          label={title}
        />
      ) : urls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ImageIcon className="w-8 h-8 opacity-30 mb-2" />
          <p className="text-xs">尚無{photoLabel}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={canReorder ? handleDragEnd : undefined}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map((item, i) => (
                <SortablePhotoThumb
                  key={item.id}
                  id={item.id}
                  url={item.url}
                  index={i}
                  sortable={canReorder && !saving}
                  onOpen={() => {
                    if (skipNextClickRef.current) {
                      skipNextClickRef.current = false;
                      return;
                    }
                    setLightbox(i);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Lightbox */}
      {lightbox !== null && urls[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[lightbox]}
            alt={`Site photo ${lightbox + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/90 text-sm">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + urls.length) % urls.length); }}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                ‹
              </button>
              <span>{lightbox + 1} / {urls.length}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % urls.length); }}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
