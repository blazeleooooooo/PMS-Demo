"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  List as ListIcon,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { type LookupTableConfig } from "@/lib/lookup-tables-config";
import { fetchOsScheduleGroupOptions } from "@/lib/data-service";
import {
  SETTINGS_FILL_CARD,
  SETTINGS_FILL_CARD_CONTENT,
  SETTINGS_FILL_CARD_HEADER,
  SETTINGS_FILL_LIST,
} from "@/components/settings/SettingsPageShell";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

type Row = Record<string, unknown>;

interface ProjectOption {
  id: string;
  label: string;
}

interface TaskForm {
  display: string;
  stage: string;
  sort: string;
  is_bwa: boolean;
  is_bwf_ob: boolean;
  is_fast_build: boolean;
  is_custom: boolean;
  project_with_custom_id: string;
  bwf_project_with_custom_id: string;
  os_schedule_groups_selected: string[];
}

function emptyTaskForm(): TaskForm {
  return {
    display: "",
    stage: "",
    sort: "",
    is_bwa: false,
    is_bwf_ob: false,
    is_fast_build: false,
    is_custom: false,
    project_with_custom_id: "",
    bwf_project_with_custom_id: "",
    os_schedule_groups_selected: [],
  };
}

function rowToForm(item: Row): TaskForm {
  const rawGroups = String(item.os_schedule_groups ?? "");
  return {
    display: String(item.display ?? ""),
    stage: String(item.stage ?? ""),
    sort: item.sort != null ? String(item.sort) : "",
    is_bwa: item.is_bwa === true,
    is_bwf_ob: item.is_bwf_ob === true,
    is_fast_build: item.is_fast_build === true,
    is_custom: item.is_custom === true,
    project_with_custom_id: String(item.project_with_custom_id ?? ""),
    bwf_project_with_custom_id: String(item.bwf_project_with_custom_id ?? ""),
    os_schedule_groups_selected: rawGroups
      ? rawGroups.split(",").map((g) => g.trim()).filter(Boolean)
      : [],
  };
}

async function adminWrite(body: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "網絡錯誤";
    return { success: false, error: message };
  }
}

async function fetchProjectOptions(table: "bwa_projects" | "bwf_projects"): Promise<ProjectOption[]> {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  const all: ProjectOption[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(table)
      .select("id, project_code, project_name")
      .order("project_code", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data?.length) {
      hasMore = false;
      break;
    }

    for (const row of data) {
      const code = String(row.project_code ?? "").trim();
      const name = String(row.project_name ?? "").trim();
      all.push({
        id: row.id,
        label: code && name ? `${code} — ${name}` : code || name || row.id,
      });
    }

    hasMore = data.length === PAGE_SIZE;
    page += 1;
  }

  return all;
}

function ProjectSearchSelect({
  label,
  options,
  value,
  onChange,
  loading,
  required,
}: {
  label: string;
  options: ProjectOption[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 80);
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 80);
  }, [options, query]);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      <div className="border rounded-lg overflow-hidden">
        <div className="p-2 border-b bg-gray-50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="搜尋項目..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9 border-0 bg-transparent focus-visible:ring-0"
            />
          </div>
        </div>
        {selected && (
          <div className="px-3 py-2 bg-blue-50 border-b text-sm text-blue-800 flex items-center justify-between gap-2">
            <span className="truncate">{selected.label}</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => onChange("")}>
              清除
            </Button>
          </div>
        )}
        <div className="max-h-[180px] overflow-y-auto">
          {loading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">沒有找到項目</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange(opt.id === value ? "" : opt.id)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b last:border-b-0 hover:bg-blue-50/50 flex items-center gap-2 ${
                  value === opt.id ? "bg-blue-50 font-medium" : ""
                }`}
              >
                {value === opt.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BoolCheckbox({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <Label htmlFor={id} className={`text-sm font-normal cursor-pointer ${disabled ? "text-gray-400" : ""}`}>
        {label}
      </Label>
    </div>
  );
}

export default function ProjectScheduleTasksSettings({
  config,
}: {
  config: LookupTableConfig;
}) {
  const { toast } = useToast();
  const { canView, loading: permLoading } = usePermission();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskForm>(emptyTaskForm());

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [scheduleGroupOptions, setScheduleGroupOptions] = useState<string[]>([]);
  const [bwaProjects, setBwaProjects] = useState<ProjectOption[]>([]);
  const [bwfProjects, setBwfProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const orderBy = config.orderBy ?? "display";
  const permKey = config.permissionKey ?? "settings";

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(config.key)
      .select("*")
      .order(orderBy, { ascending: true });

    if (error) {
      toast({ title: "載入失敗", description: error.message, variant: "destructive" });
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [config.key, orderBy, toast]);

  useEffect(() => {
    if (!permLoading && canView(permKey)) fetchRows();
  }, [permLoading, canView, permKey, fetchRows]);

  const loadDialogRefs = useCallback(async () => {
    setLoadingProjects(true);
    const [groups, bwa, bwf] = await Promise.all([
      fetchOsScheduleGroupOptions(),
      fetchProjectOptions("bwa_projects"),
      fetchProjectOptions("bwf_projects"),
    ]);
    setScheduleGroupOptions(groups);
    setBwaProjects(bwa);
    setBwfProjects(bwf);
    setLoadingProjects(false);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyTaskForm());
    setDialogOpen(true);
    void loadDialogRefs();
  };

  const openEdit = (item: Row) => {
    setEditing(item);
    setForm(rowToForm(item));
    setDialogOpen(true);
    void loadDialogRefs();
  };

  const isCustom = form.is_custom;
  const isBwaPath = isCustom && form.is_bwa;
  const isBwfPath = isCustom && (form.is_bwf_ob || form.is_fast_build);
  const disableBwa = isCustom && isBwfPath;
  const disableBwfFlags = isCustom && isBwaPath;

  const updateForm = (patch: Partial<TaskForm>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };

      if ("is_custom" in patch && !patch.is_custom) {
        next.project_with_custom_id = "";
        next.bwf_project_with_custom_id = "";
      }

      if (next.is_custom) {
        if ("is_bwa" in patch && patch.is_bwa) {
          next.is_bwf_ob = false;
          next.is_fast_build = false;
          next.bwf_project_with_custom_id = "";
        }
        if (("is_bwf_ob" in patch && patch.is_bwf_ob) || ("is_fast_build" in patch && patch.is_fast_build)) {
          if (patch.is_bwf_ob || patch.is_fast_build) {
            next.is_bwa = false;
            next.project_with_custom_id = "";
          }
        }
      }

      return next;
    });
  };

  const buildPayload = (): Row => {
    const sortVal = form.sort.trim() === "" ? null : Number(form.sort);
    return {
      display: form.display.trim() || null,
      stage: form.stage.trim() || null,
      sort: sortVal != null && !Number.isNaN(sortVal) ? sortVal : null,
      is_bwa: form.is_bwa || null,
      is_bwf_ob: form.is_bwf_ob || null,
      is_fast_build: form.is_fast_build || null,
      is_custom: form.is_custom ? true : null,
      os_schedule_groups:
        form.os_schedule_groups_selected.length > 0
          ? form.os_schedule_groups_selected.join(",")
          : null,
      project_with_custom_id: isBwaPath && form.project_with_custom_id ? form.project_with_custom_id : null,
      bwf_project_with_custom_id:
        isBwfPath && form.bwf_project_with_custom_id ? form.bwf_project_with_custom_id : null,
      modified_date: new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!form.display.trim()) {
      toast({ title: "錯誤", description: "「名稱」不能為空", variant: "destructive" });
      return;
    }
    if (isBwaPath && !form.project_with_custom_id) {
      toast({ title: "錯誤", description: "請選擇 BWA 項目", variant: "destructive" });
      return;
    }
    if (isBwfPath && !form.bwf_project_with_custom_id) {
      toast({ title: "錯誤", description: "請選擇 BWF 項目", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = buildPayload();
    const label = form.display.trim();

    if (editing) {
      const result = await adminWrite({
        action: "update",
        table: config.key,
        id: editing.id,
        updates: payload,
      });
      if (!result.success) {
        toast({ title: "更新失敗", description: result.error || "沒有權限或記錄不存在", variant: "destructive" });
      } else {
        toast({ title: "已更新", description: `「${label}」已成功更新` });
        setDialogOpen(false);
        fetchRows();
      }
    } else {
      const result = await adminWrite({
        action: "create",
        table: config.key,
        data: { ...payload, created_date: new Date().toISOString() },
      });
      if (!result.success) {
        toast({ title: "新增失敗", description: result.error || "沒有權限執行此操作", variant: "destructive" });
      } else {
        toast({ title: "已新增", description: `「${label}」已成功新增` });
        setDialogOpen(false);
        fetchRows();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const label = String(deleteTarget.display ?? "記錄");
    const result = await adminWrite({ action: "delete", table: config.key, id: deleteTarget.id });
    if (!result.success) {
      toast({ title: "刪除失敗", description: result.error || "沒有權限執行此操作", variant: "destructive" });
    } else {
      toast({ title: "已刪除", description: `「${label}」已成功刪除` });
      fetchRows();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const q = search.toLowerCase();
  const filtered = rows.filter((r) => {
    if (!q) return true;
    const display = String(r.display ?? "").toLowerCase();
    const stage = String(r.stage ?? "").toLowerCase();
    return display.includes(q) || stage.includes(q);
  });

  const typeBadges = (item: Row) => {
    const badges: string[] = [];
    if (item.is_bwa === true) badges.push("BWA");
    if (item.is_bwf_ob === true) badges.push("BWF-OB");
    if (item.is_fast_build === true) badges.push("Fast Build");
    if (item.is_custom === true) badges.push("Custom");
    return badges;
  };

  return (
    <Card className={SETTINGS_FILL_CARD}>
      <CardHeader className={SETTINGS_FILL_CARD_HEADER}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListIcon className="w-4 h-4 text-blue-500" />
            {config.labelZh} {config.labelEn}
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
              placeholder={`搜尋${config.labelZh}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
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
                key={String(item.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeBadges(item).map((b) => (
                      <Badge key={b} variant="outline" className="text-xs px-1.5 py-0 h-5 border-slate-200 text-slate-600 bg-slate-50">
                        {b}
                      </Badge>
                    ))}
                    <span className="text-sm font-medium truncate text-gray-900">
                      {String(item.display ?? "—")}
                    </span>
                    {item.stage ? (
                      <span className="text-xs truncate text-gray-400">{String(item.stage)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(item)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <DialogTitle>{editing ? `編輯${config.labelZh}` : `新增${config.labelZh}`}</DialogTitle>
            <DialogDescription>
              {editing ? `修改${config.labelZh}的資料` : `新增一個${config.labelZh}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>名稱 Display <span className="text-red-500">*</span></Label>
              <Input
                value={form.display}
                onChange={(e) => updateForm({ display: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>階段 Stage</Label>
              <Input
                value={form.stage}
                onChange={(e) => updateForm({ stage: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>排序 Sort</Label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) => updateForm({ sort: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>項目類型 Project Type</Label>
              <div className="flex flex-wrap gap-4">
                <BoolCheckbox
                  id="is_bwa"
                  label="BWA"
                  checked={form.is_bwa}
                  disabled={disableBwa}
                  onCheckedChange={(c) => updateForm({ is_bwa: c })}
                />
                <BoolCheckbox
                  id="is_bwf_ob"
                  label="BWF-OB"
                  checked={form.is_bwf_ob}
                  disabled={disableBwfFlags}
                  onCheckedChange={(c) => updateForm({ is_bwf_ob: c })}
                />
                <BoolCheckbox
                  id="is_fast_build"
                  label="Fast Build"
                  checked={form.is_fast_build}
                  disabled={disableBwfFlags}
                  onCheckedChange={(c) => updateForm({ is_fast_build: c })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <BoolCheckbox
                id="is_custom"
                label="自訂 Custom"
                checked={form.is_custom}
                onCheckedChange={(c) => updateForm({ is_custom: c })}
              />
            </div>

            {isBwaPath && (
              <ProjectSearchSelect
                label="BWA 項目 (project_with_custom_id)"
                required
                options={bwaProjects}
                value={form.project_with_custom_id}
                onChange={(id) => updateForm({ project_with_custom_id: id })}
                loading={loadingProjects}
              />
            )}

            {isBwfPath && (
              <ProjectSearchSelect
                label="BWF 項目 (bwf_project_with_custom_id)"
                required
                options={bwfProjects}
                value={form.bwf_project_with_custom_id}
                onChange={(id) => updateForm({ bwf_project_with_custom_id: id })}
                loading={loadingProjects}
              />
            )}

            <div className="space-y-2">
              <Label>
                時間表類型 OS Schedule Groups
                <span className="text-xs text-gray-400 ml-1.5 font-normal">(可多選)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {scheduleGroupOptions.map((g) => {
                  const selected = form.os_schedule_groups_selected.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? form.os_schedule_groups_selected.filter((x) => x !== g)
                          : [...form.os_schedule_groups_selected, g];
                        updateForm({ os_schedule_groups_selected: next });
                      }}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-500"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
                {scheduleGroupOptions.length === 0 && (
                  <p className="text-xs text-gray-400">暫無選項</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{String(deleteTarget?.display ?? "")}」嗎？此操作無法復原。
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
