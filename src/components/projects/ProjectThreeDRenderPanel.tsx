"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Plus,
  Trash2,
  Loader2,
  FolderPlus,
  Image as ImageIcon,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Upload,
  MoreHorizontal,
  Eye,
  ArrowUp,
  ArrowDown,
  Check,
  FolderOpen,
  Tag,
  User,
  Calendar,
  Download,
  DownloadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";

// ─── TYPES ────────────────────────────────────────────────

interface ThreeDCollection {
  id: string;
  display_name: string | null;
  description: string | null;
  o_3d_status: string | null;
  tags: string | null;
  version_number: number | null;
  created_date: string | null;
  main_designer_id: string | null;
  collab_designer_id: string | null;
  r_project_id: string | null;
}

interface ThreeDRender {
  id: string;
  image: string | null;
  order: number | null;
  r_3d_collection_id: string | null;
  project_id: string | null;
  created_date: string | null;
}

interface StaffOption {
  id: string;
  name: string;
  full_name: string | null;
  position: string | null;
}

interface ProjectThreeDRenderPanelProps {
  projectId: string; // UUID of bwa_projects
  /** Override the permission module used for CRUD checks. Defaults to "3d-design". */
  permissionModule?: string;
}

// ─── STATUS OPTIONS ───────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "草稿", label: "草稿", color: "bg-gray-100 text-gray-600" },
  { value: "進行中", label: "進行中", color: "bg-blue-100 text-blue-700" },
  { value: "待審核", label: "待審核", color: "bg-amber-100 text-amber-700" },
  { value: "已批核", label: "已批核", color: "bg-green-100 text-green-700" },
  { value: "已拒絕", label: "已拒絕", color: "bg-red-100 text-red-700" },
];

// ─── HELPERS ──────────────────────────────────────────────

import { formatDate } from "@/lib/date-utils";
import { compressImageIfNeeded, formatFileSize } from "@/lib/compress-image";
import { buildStorageObjectKey } from "@/lib/storage-utils";

function getStatusBadge(status: string | null) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  if (!opt) return <Badge variant="outline" className="text-[13px]">未設定</Badge>;
  return (
    <Badge className={`text-[13px] border-0 ${opt.color}`}>{opt.label}</Badge>
  );
}

function resolveImageUrl(image: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("//")) return `https:${image}`;
  return image;
}

// ─── DOWNLOAD HELPERS ─────────────────────────────────────

async function downloadSingleImage(imageUrl: string, fileName?: string) {
  let normalizedUrl = imageUrl;
  if (normalizedUrl.startsWith("//")) {
    normalizedUrl = `https:${normalizedUrl}`;
  }

  const downloadName = fileName || normalizedUrl.split("/").pop()?.split("?")[0] || "3d-render.jpg";

  try {
    const proxyUrl = `/api/download-image?url=${encodeURIComponent(normalizedUrl)}&filename=${encodeURIComponent(downloadName)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Proxy returned ${response.status}: ${errorBody}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error("Empty blob received");
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = downloadName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 200);
  } catch (err) {
    console.error("Download via proxy failed, trying direct:", err);
    try {
      const response = await fetch(normalizedUrl, { mode: "cors" });
      if (!response.ok) throw new Error(`Direct fetch ${response.status}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Empty blob");
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = downloadName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 200);
    } catch {
      window.open(normalizedUrl, "_blank");
    }
  }
}

async function downloadAllImages(rendersList: ThreeDRender[], collectionName: string) {
  if (rendersList.length === 0) return;

  for (let i = 0; i < rendersList.length; i++) {
    const render = rendersList[i];
    const imageUrl = resolveImageUrl(render.image);
    if (!imageUrl) continue;
    const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const fileName = `${collectionName}_${String(i + 1).padStart(2, "0")}.${ext}`;
    await downloadSingleImage(imageUrl, fileName);
    if (i < rendersList.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

// ─── TAG HELPERS ──────────────────────────────────────────

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ─── CONSTANTS ────────────────────────────────────────────

const INDUSTRY_TAG_COLLECTION_UUID = "4f5de598-2dcb-45a6-a106-9d933e9a8007";

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function ProjectThreeDRenderPanel({ projectId, permissionModule = "3d-design" }: ProjectThreeDRenderPanelProps) {
  const supabase = createClient();
  const { canCreate, canEdit, canDelete } = usePermission();
  const _canCreate = canCreate(permissionModule);
  const _canEdit = canEdit(permissionModule);
  const _canDelete = canDelete(permissionModule);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ───
  const [collections, setCollections] = useState<ThreeDCollection[]>([]);
  const [renders, setRenders] = useState<Record<string, ThreeDRender[]>>({});
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [customerIndustryTag, setCustomerIndustryTag] = useState<string>("");

  // Collection CRUD state
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionStatus, setNewCollectionStatus] = useState("草稿");
  const [newCollectionTags, setNewCollectionTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newCollectionDesigner, setNewCollectionDesigner] = useState("");
  const [newCollectionVersion, setNewCollectionVersion] = useState<string>("1");
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Edit collection state
  const [editingCollection, setEditingCollection] = useState<ThreeDCollection | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editDesigner, setEditDesigner] = useState("");
  const [editVersion, setEditVersion] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Expanded collections
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Upload state
  const [uploadingToCollection, setUploadingToCollection] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [compressingFile, setCompressingFile] = useState<string | null>(null);

  // Image viewer
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Drag reorder
  const [dragItem, setDragItem] = useState<{ collectionId: string; renderId: string; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "collection" | "render"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Load Data ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load collections for this project
      const { data: colData, error: colErr } = await supabase
        .from("three_d_collections")
        .select("id, display_name, description, o_3d_status, tags, version_number, created_date, main_designer_id, collab_designer_id, r_project_id")
        .eq("r_project_id", projectId)
        .order("created_date", { ascending: false });

      if (colErr) {
        console.error("Error loading collections:", colErr);
        setLoading(false);
        return;
      }

      setCollections(colData || []);

      // Load all renders for these collections
      if (colData && colData.length > 0) {
        const collectionIds = colData.map((c: { id: string }) => c.id);
        const { data: renderData, error: renderErr } = await supabase
          .from("three_d_renders")
          .select("id, image, order, r_3d_collection_id, project_id, created_date")
          .in("r_3d_collection_id", collectionIds)
          .order("order", { ascending: true });

        if (renderErr) {
          console.error("Error loading renders:", renderErr);
        } else {
          // Group renders by collection
          const grouped: Record<string, ThreeDRender[]> = {};
          (renderData || []).forEach((r: { r_3d_collection_id: string | null; id: string; image: string | null; order: number | null; project_id: string | null; created_date: string | null }) => {
            const cId = r.r_3d_collection_id;
            if (cId) {
              if (!grouped[cId]) grouped[cId] = [];
              grouped[cId].push(r);
            }
          });
          setRenders(grouped);
        }

        // Auto-expand first collection
        if (colData.length > 0) {
          setExpandedCollections(new Set([colData[0].id]));
        }
      }

      // Load staff list
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name, full_name, position")
        .order("name");
      setStaffList(staffData || []);
    } catch (err) {
      console.error("Error loading 3D data:", err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Fetch customer industry tag for default ───
  useEffect(() => {
    async function fetchCustomerIndustryTag() {
      try {
        // Step 1: Get the customer_id from the project
        const { data: project } = await supabase
          .from("bwa_projects")
          .select("customer_id")
          .eq("id", projectId)
          .single();

        if (!project?.customer_id) return;

        // Step 2: Get the industry tag from customer_tags junction
        const { data: tagRows } = await supabase
          .from("customer_tags")
          .select("tag_uuid, nos_customer_tags!fk_customer_tags_tag_uuid(id, display)")
          .eq("customer_uuid", project.customer_id)
          .eq("collection_uuid", INDUSTRY_TAG_COLLECTION_UUID);

        if (tagRows && tagRows.length > 0) {
          // Collect all industry tag names
          const tagNames = tagRows
            .map((row: any) => {
              const tag = row.nos_customer_tags;
              return tag?.display || null;
            })
            .filter(Boolean);
          if (tagNames.length > 0) {
            setCustomerIndustryTag(tagNames.join(", "));
          }
        }
      } catch (err) {
        console.error("Error fetching customer industry tag:", err);
      }
    }
    fetchCustomerIndustryTag();
  }, [projectId]);

  // ─── Toggle collection expand ───
  const toggleExpand = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Create Collection ───
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setCreatingCollection(true);
    try {
      const { error } = await supabase.from("three_d_collections").insert({
        display_name: newCollectionName.trim(),
        description: newCollectionDesc.trim() || null,
        o_3d_status: newCollectionStatus,
        tags: newCollectionTags.length > 0 ? newCollectionTags.join(", ") : null,
        main_designer_id: newCollectionDesigner || null,
        r_project_id: projectId,
        version_number: parseInt(newCollectionVersion) || 1,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      });
      if (error) throw error;
      setShowCreateCollection(false);
      setNewCollectionName("");
      setNewCollectionDesc("");
      setNewCollectionStatus("草稿");
      setNewCollectionTags([]);
      setNewTagInput("");
      setNewCollectionDesigner("");
      setNewCollectionVersion("1");
      await loadData();
    } catch (err) {
      console.error("Error creating collection:", err);
    }
    setCreatingCollection(false);
  };

  // ─── Edit Collection ───
  const startEditCollection = (col: ThreeDCollection) => {
    setEditingCollection(col);
    setEditName(col.display_name || "");
    setEditDesc(col.description || "");
    setEditStatus(col.o_3d_status || "草稿");
    setEditTags(col.tags ? col.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []);
    setEditTagInput("");
    setEditDesigner(col.main_designer_id || "");
    setEditVersion(col.version_number != null ? String(col.version_number) : "");
  };

  const handleSaveEdit = async () => {
    if (!editingCollection || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("three_d_collections")
        .update({
          display_name: editName.trim(),
          description: editDesc.trim() || null,
          o_3d_status: editStatus,
          tags: editTags.length > 0 ? editTags.join(", ") : null,
          main_designer_id: editDesigner || null,
          version_number: editVersion ? parseInt(editVersion) || null : null,
          modified_date: new Date().toISOString(),
        })
        .eq("id", editingCollection.id);
      if (error) throw error;
      setEditingCollection(null);
      await loadData();
    } catch (err) {
      console.error("Error updating collection:", err);
    }
    setSavingEdit(false);
  };

  // ─── Upload Images ───
  const handleFileSelect = (collectionId: string) => {
    setUploadingToCollection(collectionId);
    fileInputRef.current?.click();
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingToCollection) return;

    setUploading(true);
    setUploadProgress(0);

    const collectionId = uploadingToCollection;
    const existingRenders = renders[collectionId] || [];
    let maxOrder = existingRenders.reduce((max, r) => Math.max(max, r.order || 0), 0);

    const totalFiles = files.length;
    let completed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        setCompressingFile(file.name);
        const { file: uploadFile, compressed } = await compressImageIfNeeded(file);
        setCompressingFile(null);

        const fileName = buildStorageObjectKey(collectionId, file.name, compressed ? "jpg" : undefined);

        if (compressed) {
          console.info(
            `[3D Render] Compressed ${file.name}: ${formatFileSize(file.size)} → ${formatFileSize(uploadFile.size)}`
          );
        }

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from("3d-renders")
          .upload(fileName, uploadFile, { cacheControl: "3600", upsert: false });

        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("3d-renders")
          .getPublicUrl(fileName);

        maxOrder++;

        // Insert render record
        await supabase.from("three_d_renders").insert({
          image: urlData.publicUrl,
          order: maxOrder,
          r_3d_collection_id: collectionId,
          project_id: projectId,
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
        });

        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      } catch (err) {
        console.error("Error uploading file:", err);
      }
    }

    // Reset
    setUploading(false);
    setUploadProgress(0);
    setCompressingFile(null);
    setUploadingToCollection(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Ensure this collection is expanded
    setExpandedCollections((prev) => new Set(prev).add(collectionId));
    await loadData();
  };

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === "render") {
        // Find image to delete from storage
        const allRenders = Object.values(renders).flat();
        const render = allRenders.find((r) => r.id === deleteConfirm.id);
        if (render?.image && render.image.includes("3d-renders")) {
          const urlParts = render.image.split("/3d-renders/");
          if (urlParts[1]) {
            await supabase.storage.from("3d-renders").remove([decodeURIComponent(urlParts[1])]);
          }
        }
        const { error } = await supabase.from("three_d_renders").delete().eq("id", deleteConfirm.id);
        if (error) throw error;
      } else {
        // Delete all renders in this collection first
        const collectionRenders = renders[deleteConfirm.id] || [];
        if (collectionRenders.length > 0) {
          const storagePaths = collectionRenders
            .filter((r) => r.image && r.image.includes("3d-renders"))
            .map((r) => {
              const urlParts = r.image!.split("/3d-renders/");
              return urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
            })
            .filter(Boolean) as string[];

          if (storagePaths.length > 0) {
            await supabase.storage.from("3d-renders").remove(storagePaths);
          }

          await supabase
            .from("three_d_renders")
            .delete()
            .eq("r_3d_collection_id", deleteConfirm.id);
        }
        // Delete collection
        const { error } = await supabase.from("three_d_collections").delete().eq("id", deleteConfirm.id);
        if (error) throw error;
      }
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error("Error deleting:", err);
    }
    setDeleting(false);
  };

  // ─── Reorder ───
  const handleMoveRender = async (collectionId: string, renderId: string, direction: "up" | "down") => {
    const colRenders = [...(renders[collectionId] || [])];
    const idx = colRenders.findIndex((r) => r.id === renderId);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === colRenders.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = colRenders[idx];
    colRenders[idx] = colRenders[swapIdx];
    colRenders[swapIdx] = temp;

    const updates = colRenders.map((r, i) => ({
      id: r.id,
      order: i + 1,
    }));

    setRenders((prev) => ({ ...prev, [collectionId]: colRenders }));

    for (const u of updates) {
      await supabase
        .from("three_d_renders")
        .update({ order: u.order, modified_date: new Date().toISOString() })
        .eq("id", u.id);
    }
  };

  // ─── Drag & Drop ───
  const handleDragStart = (collectionId: string, renderId: string, index: number) => {
    setDragItem({ collectionId, renderId, index });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (collectionId: string, dropIndex: number) => {
    if (!dragItem || dragItem.collectionId !== collectionId) {
      setDragItem(null);
      setDragOverIndex(null);
      return;
    }

    const colRenders = [...(renders[collectionId] || [])];
    const dragIdx = dragItem.index;
    if (dragIdx === dropIndex) {
      setDragItem(null);
      setDragOverIndex(null);
      return;
    }

    const [removed] = colRenders.splice(dragIdx, 1);
    colRenders.splice(dropIndex, 0, removed);

    setRenders((prev) => ({ ...prev, [collectionId]: colRenders }));

    for (let i = 0; i < colRenders.length; i++) {
      await supabase
        .from("three_d_renders")
        .update({ order: i + 1, modified_date: new Date().toISOString() })
        .eq("id", colRenders[i].id);
    }

    setDragItem(null);
    setDragOverIndex(null);
  };

  // ─── Staff name lookup ───
  const getStaffName = (id: string | null) => {
    if (!id) return null;
    const s = staffList.find((st) => st.id === id);
    return s ? s.name || s.full_name : null;
  };

  // ─── RENDER ───

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">載入 3D 渲染資料...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input for bulk upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFilesChange}
      />

      {/* Header */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-50">
                <Box className="w-3.5 h-3.5 text-purple-500" />
              </div>
              3D 渲染管理
              <Badge variant="outline" className="text-[13px] ml-1">
                {collections.length} 合集
              </Badge>
            </div>
            {_canCreate && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setNewCollectionTags(customerIndustryTag ? customerIndustryTag.split(",").map(t => t.trim()).filter(Boolean) : []);
                  setNewTagInput("");
                  setShowCreateCollection(true);
                }}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                新增合集
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-1">
          <Separator className="mb-3" />

          {collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <FolderOpen className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">尚無 3D 合集</p>
              <p className="text-xs text-gray-300 mt-1">點擊「新增合集」建立第一個 3D 渲染合集</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collections.map((col) => {
                const colRenders = renders[col.id] || [];
                const isExpanded = expandedCollections.has(col.id);

                return (
                  <div
                    key={col.id}
                    className="border border-gray-100 rounded-lg overflow-hidden"
                  >
                    {/* Collection Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50/60 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleExpand(col.id)}
                    >
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {col.display_name || "未命名合集"}
                          </span>
                          {getStatusBadge(col.o_3d_status)}
                          {parseTags(col.tags).map((tag, tagIdx) => (
                            <Badge
                              key={tagIdx}
                              variant="outline"
                              className="text-[12px] gap-0.5 bg-gray-50 hover:bg-gray-100"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[13px] text-gray-400">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {colRenders.length} 張圖片
                          </span>
                          {col.main_designer_id && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {getStaffName(col.main_designer_id) || "設計師"}
                            </span>
                          )}
                          {col.version_number && (
                            <span>V{col.version_number}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(col.created_date)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {_canCreate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleFileSelect(col.id)}
                            title="上傳圖片"
                          >
                            <Upload className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            {_canEdit && (
                              <DropdownMenuItem onClick={() => startEditCollection(col)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" />
                                編輯合集
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => downloadAllImages(colRenders, col.display_name || "3D合集")}
                              disabled={colRenders.length === 0}
                            >
                              <DownloadCloud className="w-3.5 h-3.5 mr-2" />
                              下載全部圖片 ({colRenders.length})
                            </DropdownMenuItem>
                            {_canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: "collection",
                                      id: col.id,
                                      name: col.display_name || "此合集",
                                    })
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  刪除合集
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Upload progress */}
                    {uploading && uploadingToCollection === col.id && (
                      <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          <span className="text-xs text-blue-600">
                            {compressingFile ? `壓縮中：${compressingFile}` : `上傳中... ${uploadProgress}%`}
                          </span>
                          <div className="flex-1 bg-blue-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded: Image Grid */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4">
                        {colRenders.length === 0 ? (
                          <div className="flex flex-col items-center py-8 text-center">
                            <ImageIcon className="w-8 h-8 text-gray-200 mb-2" />
                            <p className="text-xs text-gray-400">此合集尚無圖片</p>
                            {_canCreate && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 h-7 text-xs gap-1"
                                onClick={() => handleFileSelect(col.id)}
                              >
                                <Upload className="w-3 h-3" />
                                上傳圖片
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {colRenders.map((render, idx) => (
                              <div
                                key={render.id}
                                draggable
                                onDragStart={() => handleDragStart(col.id, render.id, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={() => handleDrop(col.id, idx)}
                                onDragEnd={() => {
                                  setDragItem(null);
                                  setDragOverIndex(null);
                                }}
                                className={`group relative aspect-square rounded-lg border overflow-hidden transition-all cursor-grab active:cursor-grabbing
                                  ${dragItem?.renderId === render.id ? "opacity-50 scale-95" : ""}
                                  ${dragOverIndex === idx && dragItem?.collectionId === col.id ? "ring-2 ring-blue-400 ring-offset-1" : "border-gray-100 hover:border-gray-200 hover:shadow-md"}
                                `}
                              >
                                {/* Image */}
                                {render.image ? (
                                  <img
                                    src={resolveImageUrl(render.image) || ""}
                                    alt={`Render ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 text-gray-200" />
                                  </div>
                                )}

                                {/* Order badge */}
                                <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[12px] font-mono px-1.5 py-0.5 rounded">
                                  #{render.order || idx + 1}
                                </div>

                                {/* Hover overlay with actions */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingImage(resolveImageUrl(render.image));
                                    }}
                                    title="預覽圖片"
                                  >
                                    <Eye className="w-4 h-4 text-gray-700" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const imageUrl = resolveImageUrl(render.image);
                                      if (imageUrl) {
                                        downloadSingleImage(imageUrl, `render_${render.order || idx + 1}.jpg`);
                                      }
                                    }}
                                    title="下載圖片"
                                  >
                                    <Download className="w-4 h-4 text-gray-700" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveRender(col.id, render.id, "up");
                                    }}
                                    disabled={idx === 0}
                                  >
                                    <ArrowUp className="w-4 h-4 text-gray-700" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveRender(col.id, render.id, "down");
                                    }}
                                    disabled={idx === colRenders.length - 1}
                                  >
                                    <ArrowDown className="w-4 h-4 text-gray-700" />
                                  </Button>
                                  {_canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 rounded-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm({
                                          type: "render",
                                          id: render.id,
                                          name: `圖片 #${render.order || idx + 1}`,
                                        });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>

                                {/* Drag handle */}
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <GripVertical className="w-4 h-4 text-white drop-shadow" />
                                </div>
                              </div>
                            ))}

                            {/* Add more images button */}
                            {_canCreate && (
                              <div
                                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 flex flex-col items-center justify-center cursor-pointer transition-colors"
                                onClick={() => handleFileSelect(col.id)}
                              >
                                <Plus className="w-6 h-6 text-gray-300 mb-1" />
                                <span className="text-[12px] text-gray-400">上傳圖片</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── CREATE COLLECTION DIALOG ─── */}
      <Dialog open={showCreateCollection} onOpenChange={setShowCreateCollection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderPlus className="w-4 h-4 text-purple-500" />
              新增 3D 合集
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">合集名稱 <span className="text-red-500">*</span></label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="輸入合集名稱..."
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">描述</label>
              <Textarea
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="合集描述（選填）..."
                className="text-sm min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">狀態</label>
              <Select value={newCollectionStatus} onValueChange={setNewCollectionStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">標籤</label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border rounded-md bg-white focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                {newCollectionTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setNewCollectionTags(prev => prev.filter((_, i) => i !== idx))}
                      className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = newTagInput.trim();
                      if (val && !newCollectionTags.includes(val)) {
                        setNewCollectionTags(prev => [...prev, val]);
                      }
                      setNewTagInput("");
                    } else if (e.key === "Backspace" && !newTagInput && newCollectionTags.length > 0) {
                      setNewCollectionTags(prev => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    const val = newTagInput.trim();
                    if (val && !newCollectionTags.includes(val)) {
                      setNewCollectionTags(prev => [...prev, val]);
                    }
                    setNewTagInput("");
                  }}
                  placeholder={newCollectionTags.length === 0 ? "輸入標籤後按 Enter..." : ""}
                  className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5 px-1"
                />
              </div>
              <p className="text-[12px] text-gray-400 mt-1">按 Enter 或逗號新增標籤，Backspace 移除最後一個</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">主設計師</label>
              <Select value={newCollectionDesigner || "none"} onValueChange={(v) => setNewCollectionDesigner(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="選擇設計師..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-sm text-gray-400">不指定</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">
                      {s.name || s.full_name || s.id}
                      {s.position && <span className="text-gray-400 ml-1">({s.position})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">版本號碼</label>
              <Input
                type="number"
                min={1}
                value={newCollectionVersion}
                onChange={(e) => setNewCollectionVersion(e.target.value)}
                placeholder="1"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowCreateCollection(false)}>
              取消
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || creatingCollection}
            >
              {creatingCollection && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              建立合集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT COLLECTION DIALOG ─── */}
      <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 text-blue-500" />
              編輯合集
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">合集名稱 <span className="text-red-500">*</span></label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">描述</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="text-sm min-h-[60px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">狀態</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">標籤</label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 border rounded-md bg-white focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                {editTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setEditTags(prev => prev.filter((_, i) => i !== idx))}
                      className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = editTagInput.trim();
                      if (val && !editTags.includes(val)) {
                        setEditTags(prev => [...prev, val]);
                      }
                      setEditTagInput("");
                    } else if (e.key === "Backspace" && !editTagInput && editTags.length > 0) {
                      setEditTags(prev => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    const val = editTagInput.trim();
                    if (val && !editTags.includes(val)) {
                      setEditTags(prev => [...prev, val]);
                    }
                    setEditTagInput("");
                  }}
                  placeholder={editTags.length === 0 ? "輸入標籤後按 Enter..." : ""}
                  className="flex-1 min-w-[80px] text-sm outline-none bg-transparent py-0.5 px-1"
                />
              </div>
              <p className="text-[12px] text-gray-400 mt-1">按 Enter 或逗號新增標籤，Backspace 移除最後一個</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">主設計師</label>
              <Select value={editDesigner || "none"} onValueChange={(v) => setEditDesigner(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="選擇設計師..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-sm text-gray-400">不指定</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">
                      {s.name || s.full_name || s.id}
                      {s.position && <span className="text-gray-400 ml-1">({s.position})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">版本號碼</label>
              <Input
                type="number"
                min={1}
                value={editVersion}
                onChange={(e) => setEditVersion(e.target.value)}
                placeholder="1"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditingCollection(null)}>
              取消
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSaveEdit}
              disabled={!editName.trim() || savingEdit}
            >
              {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRM DIALOG ─── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-red-600">
              <Trash2 className="w-4 h-4" />
              確認刪除
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            確定要刪除{deleteConfirm?.type === "collection" ? "合集" : ""}「
            <span className="font-semibold">{deleteConfirm?.name}</span>」嗎？
            {deleteConfirm?.type === "collection" && (
              <span className="text-red-500 block mt-1 text-xs">此操作會同時刪除合集內所有圖片，無法復原。</span>
            )}
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── IMAGE VIEWER LIGHTBOX ─── */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="sm:max-w-4xl p-0 bg-black/95 border-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-3 right-3 z-10 h-8 w-8 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setViewingImage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            {viewingImage && (
              <img
                src={viewingImage}
                alt="3D Render Preview"
                className="w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
