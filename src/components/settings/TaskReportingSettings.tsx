"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  GripVertical,
  ListChecks,
  Tag,
  Search} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LookupTableSettings from "@/components/settings/LookupTableSettings";
import { getLookupConfig } from "@/lib/lookup-tables-config";
import {
  SETTINGS_FILL_CARD,
  SETTINGS_FILL_CARD_CONTENT,
  SETTINGS_FILL_CARD_HEADER,
  SETTINGS_FILL_LIST,
} from "@/components/settings/SettingsPageShell";

const AI_TOOL_TYPES_CONFIG = getLookupConfig("nos_ai_tool_types")!;
const AI_TOOLS_CONFIG = getLookupConfig("nos_ai_tools")!;
const TASK_REPORTING_TABS = ["task-types", "tasks", "ai-tool-types", "ai-tools"] as const;
type TaskReportingTab = (typeof TASK_REPORTING_TABS)[number];

function isTaskReportingTab(value: string | null): value is TaskReportingTab {
  return !!value && (TASK_REPORTING_TABS as readonly string[]).includes(value);
}

// ─── Types ───────────────────────────────────────────────────
interface NOSTaskType {
  id: string;
  bubble_id: string | null;
  display: string;
  eng_display: string | null;
  is_active: boolean | null;
  brand_ids: string[] | null;
  team_ids: string[] | null;
  require_project_link: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NOSTask {
  id: string;
  bubble_id: string | null;
  display: string;
  eng_display: string | null;
  is_active: boolean | null;
  sorting: number | null;
  task_type_ids: string[] | null;
  require_deliverables: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// ─── Lazy Supabase Client ────────────────────────────────────
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

// ─── Task Types Section ──────────────────────────────────────
function TaskTypesSection() {
  const { toast } = useToast();
  const [taskTypes, setTaskTypes] = useState<NOSTaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NOSTaskType | null>(null);
  const [saving, setSaving] = useState(false);
  const [formDisplay, setFormDisplay] = useState("");
  const [formEngDisplay, setFormEngDisplay] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRequireProjectLink, setFormRequireProjectLink] = useState(true);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<NOSTaskType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTaskTypes = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    let query = supabase
      .from("nos_task_types")
      .select("*")
      .order("display", { ascending: true });

    if (!showInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTaskTypes(data || []);
    }
    setLoading(false);
  }, [showInactive, toast]);

  useEffect(() => {
    fetchTaskTypes();
  }, [fetchTaskTypes]);

  const openCreate = () => {
    setEditing(null);
    setFormDisplay("");
    setFormEngDisplay("");
    setFormIsActive(true);
    setFormRequireProjectLink(true);
    setDialogOpen(true);
  };

  const openEdit = (item: NOSTaskType) => {
    setEditing(item);
    setFormDisplay(item.display);
    setFormEngDisplay(item.eng_display || "");
    setFormIsActive(item.is_active ?? true);
    setFormRequireProjectLink(item.require_project_link ?? true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDisplay.trim()) {
      toast({ title: "錯誤", description: "顯示名稱不能為空", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = getSupabase();
    const payload = {
      display: formDisplay.trim(),
      eng_display: formEngDisplay.trim() || null,
      is_active: formIsActive,
      require_project_link: formRequireProjectLink,
      updated_at: new Date().toISOString()};

    if (editing) {
      const { error } = await supabase
        .from("nos_task_types")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "更新失敗", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "已更新", description: `「${formDisplay}」已成功更新` });
        setDialogOpen(false);
        fetchTaskTypes();
      }
    } else {
      const { error } = await supabase
        .from("nos_task_types")
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        toast({ title: "新增失敗", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "已新增", description: `「${formDisplay}」已成功新增` });
        setDialogOpen(false);
        fetchTaskTypes();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("nos_task_types")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "已刪除", description: `「${deleteTarget.display}」已成功刪除` });
      fetchTaskTypes();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const toggleActive = async (item: NOSTaskType) => {
    const supabase = getSupabase();
    const newActive = !item.is_active;
    const { error } = await supabase
      .from("nos_task_types")
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    } else {
      fetchTaskTypes();
    }
  };

  const filtered = taskTypes.filter(
    (t) =>
      t.display.toLowerCase().includes(search.toLowerCase()) ||
      (t.eng_display && t.eng_display.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className={SETTINGS_FILL_CARD}>
      <CardHeader className={SETTINGS_FILL_CARD_HEADER}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-500" />
            工作類型 Task Types
            <Badge variant="secondary" className="ml-2 text-xs">
              {filtered.length}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新增
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋類型..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="show-inactive-types" className="text-xs text-gray-500 whitespace-nowrap">
              顯示停用
            </Label>
            <Switch
              id="show-inactive-types"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className={SETTINGS_FILL_CARD_CONTENT}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? "沒有符合的結果" : "暫無資料"}
          </div>
        ) : (
          <div className={SETTINGS_FILL_LIST}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group ${
                  item.is_active
                    ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${item.is_active !== false ? "text-gray-900" : "text-gray-400"}`}>
                      {item.display}
                    </span>
                    {item.eng_display && (
                      <span className={`text-xs truncate ${item.is_active !== false ? "text-gray-400" : "text-gray-300"}`}>
                        {item.eng_display}
                      </span>
                    )}
                    {item.require_project_link === false && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-500 bg-orange-50">
                        無需關聯
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={item.is_active ?? false}
                    onCheckedChange={() => toggleActive(item)}
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯工作類型" : "新增工作類型"}</DialogTitle>
            <DialogDescription>
              {editing ? "修改工作類型的基本資料" : "新增一個工作類型選項"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>中文名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={formDisplay}
                onChange={(e) => setFormDisplay(e.target.value)}
                placeholder="例: 設計"
              />
            </div>
            <div className="space-y-2">
              <Label>英文名稱</Label>
              <Input
                value={formEngDisplay}
                onChange={(e) => setFormEngDisplay(e.target.value)}
                placeholder="e.g. Design"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-active-type"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="form-active-type">啟用中</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-require-project-link"
                checked={formRequireProjectLink}
                onCheckedChange={setFormRequireProjectLink}
              />
              <Label htmlFor="form-require-project-link">需要關聯提案/項目</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.display}」嗎？此操作無法復原。
              如果有任務正在使用此類型，建議停用而非刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Sortable Task Item ───────────────────────────────────────
interface SortableTaskItemProps {
  item: NOSTask;
  canDrag: boolean;
  showInactive: boolean;
  getTaskTypeInfo: (typeId: string) => { name: string | null; isActive: boolean };
  toggleActive: (item: NOSTask) => void;
  openEdit: (item: NOSTask) => void;
  setDeleteTarget: (item: NOSTask | null) => void;
}

function SortableTaskItem({
  item,
  canDrag,
  showInactive,
  getTaskTypeInfo,
  toggleActive,
  openEdit,
  setDeleteTarget}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging} = useSortable({ id: item.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group ${
        item.is_active
          ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
          : "bg-gray-50 border-gray-100 opacity-60"
      } ${isDragging ? "shadow-lg ring-2 ring-blue-200" : ""}`}
    >
      <button
        type="button"
        className={`touch-none ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className={`w-3.5 h-3.5 ${canDrag ? "text-gray-400 hover:text-gray-600" : "text-gray-200"}`} />
      </button>
      {item.sorting != null && (
        <span className="text-[10px] text-gray-400 w-5 text-center font-mono">
          {item.sorting}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${item.is_active !== false ? "text-gray-900" : "text-gray-400"}`}>
            {item.display}
          </span>
          {item.eng_display && (
            <span className={`text-xs truncate ${item.is_active !== false ? "text-gray-400" : "text-gray-300"}`}>
              {item.eng_display}
            </span>
          )}
          {item.require_deliverables && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600 bg-amber-50">
              需填成果
            </Badge>
          )}
        </div>
        {item.task_type_ids && item.task_type_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.task_type_ids.map((tid) => {
              const info = getTaskTypeInfo(tid);
              if (!info.name) return null;
              if (!info.isActive && !showInactive) return null;
              return (
                <Badge
                  key={tid}
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${
                    info.isActive
                      ? "text-purple-600 border-purple-200 bg-purple-50"
                      : "text-gray-400 border-gray-200 bg-gray-50"
                  }`}
                >
                  {info.name}
                  {!info.isActive && " (停用)"}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={item.is_active ?? false}
          onCheckedChange={() => toggleActive(item)}
          className="scale-75"
        />
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7"
          onClick={() => openEdit(item)}
        >
          <Pencil className="w-3.5 h-3.5 text-gray-500" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={() => setDeleteTarget(item)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Tasks Section ───────────────────────────────────────────
function TasksSection() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<NOSTask[]>([]);
  const [taskTypes, setTaskTypes] = useState<NOSTaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTaskTypeId, setFilterTaskTypeId] = useState<string>("__all__");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NOSTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [formDisplay, setFormDisplay] = useState("");
  const [formEngDisplay, setFormEngDisplay] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSorting, setFormSorting] = useState<string>("");
  const [formTaskTypeIds, setFormTaskTypeIds] = useState<string[]>([]);
  const [formRequireDeliverables, setFormRequireDeliverables] = useState(false);
  const [formProjectLinkFilter, setFormProjectLinkFilter] = useState<boolean | null>(null); // null=show all, true=require, false=no require

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<NOSTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();

    // Fetch ALL task types for reference (including inactive, for name resolution)
    const { data: typesData } = await supabase
      .from("nos_task_types")
      .select("*")
      .order("display", { ascending: true });
    setTaskTypes(typesData || []);

    // Fetch tasks
    let query = supabase
      .from("nos_tasks")
      .select("*")
      .order("sorting", { ascending: true, nullsFirst: false });

    if (!showInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, [showInactive, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const getTaskTypeInfo = (typeId: string) => {
    const tt = taskTypes.find((t) => t.id === typeId || t.bubble_id === typeId);
    return { name: tt?.display || null, isActive: tt?.is_active !== false };
  };

  const openCreate = async () => {
    setEditing(null);
    setFormDisplay("");
    setFormEngDisplay("");
    setFormIsActive(true);
    // Default sorting to max existing sorting + 1 (query ALL records, not just visible)
    const supabase = getSupabase();
    const { data: maxRow } = await supabase
      .from("nos_tasks")
      .select("sorting")
      .order("sorting", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();
    const maxSorting = maxRow?.sorting ?? 0;
    setFormSorting((maxSorting + 1).toString());
    setFormTaskTypeIds([]);
    setFormRequireDeliverables(false);
    setFormProjectLinkFilter(null);
    setDialogOpen(true);
  };

  const openEdit = (item: NOSTask) => {
    setEditing(item);
    setFormDisplay(item.display);
    setFormEngDisplay(item.eng_display || "");
    setFormIsActive(item.is_active ?? true);
    setFormSorting(item.sorting?.toString() || "");
    setFormTaskTypeIds(item.task_type_ids || []);
    setFormRequireDeliverables(item.require_deliverables ?? false);
    // Determine the filter from existing task type ids
    if (item.task_type_ids && item.task_type_ids.length > 0) {
      const firstType = taskTypes.find((tt) => tt.id === item.task_type_ids![0]);
      if (firstType) {
        setFormProjectLinkFilter(firstType.require_project_link ?? true);
      } else {
        setFormProjectLinkFilter(null);
      }
    } else {
      setFormProjectLinkFilter(null);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDisplay.trim()) {
      toast({ title: "錯誤", description: "顯示名稱不能為空", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = getSupabase();
    const payload = {
      display: formDisplay.trim(),
      eng_display: formEngDisplay.trim() || null,
      is_active: formIsActive,
      sorting: formSorting ? parseInt(formSorting) : null,
      task_type_ids: formTaskTypeIds.length > 0 ? formTaskTypeIds : null,
      require_deliverables: formRequireDeliverables,
      updated_at: new Date().toISOString()};

    if (editing) {
      const { error } = await supabase
        .from("nos_tasks")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "更新失敗", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "已更新", description: `「${formDisplay}」已成功更新` });
        setDialogOpen(false);
        fetchTasks();
      }
    } else {
      const { error } = await supabase
        .from("nos_tasks")
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        toast({ title: "新增失敗", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "已新增", description: `「${formDisplay}」已成功新增` });
        setDialogOpen(false);
        fetchTasks();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("nos_tasks")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "已刪除", description: `「${deleteTarget.display}」已成功刪除` });
      fetchTasks();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const toggleActive = async (item: NOSTask) => {
    const supabase = getSupabase();
    const newActive = !item.is_active;
    const { error } = await supabase
      .from("nos_tasks")
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    } else {
      fetchTasks();
    }
  };

  const toggleTaskType = (typeId: string) => {
    setFormTaskTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  // DnD state
  const [reordering, setReordering] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Work on full tasks array (not filtered) so sorting is absolute
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    // Optimistic update
    setTasks(reordered);

    // Batch update sorting values in DB
    setReordering(true);
    const supabase = getSupabase();
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      sorting: idx + 1}));

    // Use Promise.all for batch update
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("nos_tasks")
          .update({ sorting: u.sorting, updated_at: new Date().toISOString() })
          .eq("id", u.id)
      )
    );

    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast({ title: "排序更新失敗", description: "部分排序未能儲存", variant: "destructive" });
      fetchTasks(); // Revert to DB state
    } else {
      // Update local state with new sorting values
      setTasks(reordered.map((item, idx) => ({ ...item, sorting: idx + 1 })));
      toast({ title: "排序已更新", description: "拖拽排序已儲存" });
    }
    setReordering(false);
  };

  const filterTaskType = filterTaskTypeId === "__all__"
    ? null
    : taskTypes.find((tt) => tt.id === filterTaskTypeId || tt.bubble_id === filterTaskTypeId) ?? null;

  const filtered = tasks.filter((t) => {
    // Search filter
    const matchesSearch =
      t.display.toLowerCase().includes(search.toLowerCase()) ||
      (t.eng_display && t.eng_display.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    // Task type filter
    if (filterTaskType) {
      const typeIds = t.task_type_ids || [];
      const matchesType = typeIds.some(
        (tid) =>
          tid === filterTaskType.id ||
          (!!filterTaskType.bubble_id && tid === filterTaskType.bubble_id)
      );
      if (!matchesType) return false;
    }

    // When showInactive is off, hide entire row if ALL its task_type_ids are inactive
    if (!showInactive && t.task_type_ids && t.task_type_ids.length > 0) {
      const hasAnyActiveType = t.task_type_ids.some((tid: string) => {
        const info = getTaskTypeInfo(tid);
        return info.name && info.isActive;
      });
      if (!hasAnyActiveType) return false;
    }

    return true;
  });

  const taskTypeFilterOptions = taskTypes.filter((tt) =>
    showInactive ? true : tt.is_active !== false
  );

  // Determine if drag is allowed (not when searching / filtering by type)
  const canDrag = !search && filterTaskTypeId === "__all__";

  return (
    <Card className={SETTINGS_FILL_CARD}>
      <CardHeader className={SETTINGS_FILL_CARD_HEADER}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-500" />
            工作項目 Tasks
            <Badge variant="secondary" className="ml-2 text-xs">
              {filtered.length}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新增
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋任務..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label htmlFor="filter-task-type" className="text-xs text-gray-500 whitespace-nowrap">
              工作類型
            </Label>
            <Select value={filterTaskTypeId} onValueChange={setFilterTaskTypeId}>
              <SelectTrigger id="filter-task-type" className="h-8 w-[200px] text-sm">
                <SelectValue placeholder="全部類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部類型</SelectItem>
                {taskTypeFilterOptions.map((tt) => (
                  <SelectItem key={tt.id} value={tt.id}>
                    {tt.display}
                    {tt.eng_display ? ` ${tt.eng_display}` : ""}
                    {tt.is_active === false ? " (停用)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="show-inactive-tasks" className="text-xs text-gray-500 whitespace-nowrap">
              顯示停用
            </Label>
            <Switch
              id="show-inactive-tasks"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className={SETTINGS_FILL_CARD_CONTENT}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search || filterTaskTypeId !== "__all__" ? "沒有符合的結果" : "暫無資料"}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={SETTINGS_FILL_LIST}>
                {reordering && (
                  <div className="flex items-center gap-2 text-xs text-blue-500 px-3 py-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    排序儲存中...
                  </div>
                )}
                {filtered.map((item) => (
                  <SortableTaskItem
                    key={item.id}
                    item={item}
                    canDrag={canDrag}
                    showInactive={showInactive}
                    getTaskTypeInfo={getTaskTypeInfo}
                    toggleActive={toggleActive}
                    openEdit={openEdit}
                    setDeleteTarget={setDeleteTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯工作項目" : "新增工作項目"}</DialogTitle>
            <DialogDescription>
              {editing ? "修改工作項目的基本資料" : "新增一個工作項目選項"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>中文名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={formDisplay}
                onChange={(e) => setFormDisplay(e.target.value)}
                placeholder="例: 平面設計"
              />
            </div>
            <div className="space-y-2">
              <Label>英文名稱</Label>
              <Input
                value={formEngDisplay}
                onChange={(e) => setFormEngDisplay(e.target.value)}
                placeholder="e.g. Graphic Design"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formSorting}
                  onChange={(e) => setFormSorting(e.target.value)}
                  placeholder="例: 10"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id="form-active-task"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                  <Label htmlFor="form-active-task">啟用中</Label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="form-require-deliverables"
                checked={formRequireDeliverables}
                onCheckedChange={setFormRequireDeliverables}
              />
              <div>
                <Label htmlFor="form-require-deliverables">必須填寫成果</Label>
                <p className="text-xs text-gray-400">開啟後，工作匯報選擇此任務時必須填寫成果類型</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>關聯工作類型</Label>
              <p className="text-xs text-gray-400">選擇此任務所屬的工作類型（可多選）</p>
              {/* Project link filter pills */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">篩選:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (formProjectLinkFilter !== true) {
                      setFormProjectLinkFilter(true);
                      setFormTaskTypeIds([]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    formProjectLinkFilter === true
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  需關聯項目
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (formProjectLinkFilter !== false) {
                      setFormProjectLinkFilter(false);
                      setFormTaskTypeIds([]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    formProjectLinkFilter === false
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600"
                  }`}
                >
                  無需關聯項目
                </button>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50/50 max-h-36 overflow-y-auto">
                {(() => {
                  const filteredTypes = taskTypes.filter((tt) => {
                    if (tt.is_active === false) return false;
                    if (formProjectLinkFilter === null) return true;
                    const typeRequires = tt.require_project_link ?? true;
                    return typeRequires === formProjectLinkFilter;
                  });
                  if (formProjectLinkFilter === null) {
                    return (
                      <span className="text-xs text-gray-400">請先選擇上方篩選條件</span>
                    );
                  }
                  if (filteredTypes.length === 0) {
                    return (
                      <span className="text-xs text-gray-400">暫無符合條件的工作類型</span>
                    );
                  }
                  return filteredTypes.map((tt) => {
                    const isSelected = formTaskTypeIds.includes(tt.id);
                    return (
                      <Badge
                        key={tt.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                            : "hover:bg-purple-50 hover:border-purple-300"
                        }`}
                        onClick={() => toggleTaskType(tt.id)}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {tt.display}
                      </Badge>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.display}」嗎？此操作無法復原。
              如果有工時記錄正在使用此項目，建議停用而非刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Main Export ─────────────────────────────────────────────
/** Content only — one-level tabs live in SettingsSubNav on the page shell. */
export default function TaskReportingSettings() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TaskReportingTab = isTaskReportingTab(tabParam) ? tabParam : "task-types";

  if (activeTab === "tasks") return <TasksSection />;
  if (activeTab === "ai-tool-types") {
    return AI_TOOL_TYPES_CONFIG ? <LookupTableSettings config={AI_TOOL_TYPES_CONFIG} /> : null;
  }
  if (activeTab === "ai-tools") {
    return AI_TOOLS_CONFIG ? <LookupTableSettings config={AI_TOOLS_CONFIG} /> : null;
  }
  return <TaskTypesSection />;
}
