"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Loader2,
  Search,
  Heart,
  Star,
  X,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiFileUploader } from "@/components/ui/multi-file-uploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createManHourTask,
  updateManHourTask,
  getManHourTaskById,
  getNOSTasks,
  getNOSTaskTypes,
  getNOSAiToolGroups,
  getPinnedByType,
  getPinnedProjects,
  togglePin,
  isProjectPinType,
  DEFAULT_AI_TOOL_GROUPS,
  type JobType,
  type ManHourTaskInsert,
  type ManHourTaskUpdate,
  type NOSTask,
  type NOSTaskType,
  type AiToolGroup,
  type AiToolsData,
  type DeliverablesData,
} from "@/lib/man-hour-service";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";

// ─── Types ─────────────────────────────────────────────────
type ProjectType = "Pitching" | "Project" | "BWF Pitching" | "BWF Project" | "❤️";

interface ProjectListItem {
  _id: string;
  displayName: string;
  jobType: JobType;
}

// ─── Session-level cache ──────────────────────────────────
const projectCache: Record<string, { items: ProjectListItem[]; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedProjects(key: string): ProjectListItem[] | null {
  const entry = projectCache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.items;
  return null;
}

function setCachedProjects(key: string, items: ProjectListItem[]) {
  projectCache[key] = { items, timestamp: Date.now() };
}

// Output types
const OUTPUT_TYPES = ["圖片", "文案", "影片", "簡報", "文件", "報價", "設計", "其他"];

// Output stages (成果階段)
const OUTPUT_STAGES = ["未完成初稿", "已完成初稿", "最終稿"];

interface ManHourTaskInlineFormProps {
  taskNumber: number;
  manHourDateId: string;
  editTaskId?: string | null;
  onSaved: () => void;
  onCancel?: () => void;
  onPinToFavorites?: () => void;
}

export default function ManHourTaskInlineForm({
  taskNumber,
  manHourDateId,
  editTaskId,
  onSaved,
  onCancel,
  onPinToFavorites,
}: ManHourTaskInlineFormProps) {
  const isEditMode = !!editTaskId;
  const { staff } = useAuth();
  const { toast } = useToast();

  // ─── Collapse/Expand State ────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ─── Form State ─────────────────────────────────────────
  const [projectType, setProjectType] = useState<ProjectType>("Project");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [workHours, setWorkHours] = useState<string>("0");
  const [images, setImages] = useState<string[]>([]);
  const [asanaLink, setAsanaLink] = useState<string>("");

  // AI Tools state (types + tools from settings; selections keyed by type code)
  const [aiToolGroups, setAiToolGroups] = useState<AiToolGroup[]>(DEFAULT_AI_TOOL_GROUPS);
  const [selectedAiByCode, setSelectedAiByCode] = useState<Record<string, string[]>>({});
  const [aiOtherByCode, setAiOtherByCode] = useState<Record<string, string>>({});

  // Output / 成果
  const [outputType, setOutputType] = useState<string>("");
  const [outputCount, setOutputCount] = useState<string>("");
  const [outputStage, setOutputStage] = useState<string>("");

  // ─── Reference Data ─────────────────────────────────────
  const [projectListItems, setProjectListItems] = useState<ProjectListItem[]>([]);
  const [nosTasks, setNosTasks] = useState<NOSTask[]>([]);
  const [nosTaskTypes, setNosTaskTypes] = useState<NOSTaskType[]>([]);

  // Pinned
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>([]);
  const [pinnedProjectIds, setPinnedProjectIds] = useState<Set<string>>(new Set());
  const [pinningProjectId, setPinningProjectId] = useState<string | null>(null);
  const [pinningTaskId, setPinningTaskId] = useState<string | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [projectSearch, setProjectSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // ─── Click-outside to close project dropdown ─────────────
  useEffect(() => {
    if (!projectDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectDropdownOpen]);

  // ─── Load Reference Data ─────────────────────────────────
  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [tasksRes, taskTypesRes, aiGroupsRes] = await Promise.all([
        getNOSTasks(),
        getNOSTaskTypes(),
        getNOSAiToolGroups(),
      ]);
      setNosTasks(tasksRes);
      setNosTaskTypes(taskTypesRes);
      setAiToolGroups(aiGroupsRes);
    } catch (err) {
      console.error("[ManHourTaskInlineForm] Error loading reference data:", err);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  // ─── Load Pinned Tasks ─────────────────────────────────
  const loadPinnedTasks = useCallback(async () => {
    if (!staff?.id) return;
    try {
      const pinnedItems = await getPinnedByType(staff.id, "task");
      const taskIds = [...new Set(
        pinnedItems
          .map((p) => p.task_bubble_id || p.task_name)
          .filter(Boolean) as string[]
      )];
      setPinnedTaskIds(taskIds);
    } catch (err) {
      console.error("[ManHourTaskInlineForm] Error loading pinned tasks:", err);
    }
  }, [staff]);

  // ─── Load Pinned Project IDs ─────────────────────────────
  const loadPinnedProjectIds = useCallback(async () => {
    if (!staff?.id) return;
    try {
      const pinnedItems = await getPinnedProjects(staff.id);
      const ids = new Set(
        pinnedItems
          .map((p) => p.project_id)
          .filter(Boolean) as string[]
      );
      setPinnedProjectIds(ids);
    } catch (err) {
      console.error("[ManHourTaskInlineForm] Error loading pinned project IDs:", err);
    }
  }, [staff]);

  // Toggle Pin Project — pin_type stores JobType so submit can set job_type correctly
  const handleTogglePinProject = useCallback(async (projectId: string, projectName: string, jobType: JobType) => {
    if (!staff?.id || pinningProjectId) return;
    setPinningProjectId(projectId);
    try {
      const result = await togglePin(staff.id, jobType, {
        project_id: projectId,
        project_name: projectName,
      });
      setPinnedProjectIds((prev) => {
        const next = new Set(prev);
        if (result.pinned) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
      delete projectCache[`pinned_${staff.id}`];
      toast({ title: result.pinned ? "已收藏" : "已取消收藏", description: projectName, duration: 2000 });
    } catch (err) {
      toast({ title: "操作失敗", description: "無法更新收藏狀態", variant: "destructive", duration: 3000 });
    } finally {
      setPinningProjectId(null);
    }
  }, [staff, pinningProjectId, toast]);

  // Toggle Pin Task
  const handleTogglePinTask = useCallback(async (taskKey: string, taskDisplayName: string) => {
    if (!staff?.id || pinningTaskId) return;
    setPinningTaskId(taskKey);
    try {
      const result = await togglePin(staff.id, "task", {
        task_name: taskDisplayName,
        task_bubble_id: taskKey,
      });
      setPinnedTaskIds((prev) => result.pinned ? [...prev, taskKey] : prev.filter((id) => id !== taskKey));
      delete projectCache[`pinned_tasks_${staff.id}`];
      toast({ title: result.pinned ? "已收藏" : "已取消收藏", description: taskDisplayName, duration: 2000 });
    } catch (err) {
      toast({ title: "操作失敗", description: "無法更新收藏狀態", variant: "destructive", duration: 3000 });
    } finally {
      setPinningTaskId(null);
    }
  }, [staff, pinningTaskId, toast]);

  // ─── Load Project List by Type ──────────────────────────
  // Full-list pagination (PAGE_SIZE 1000) — matches ManHourTaskDialog.
  // Previous .limit(200) hid older rows (e.g. QLC202605024 ranked #202).
  const loadProjectsByType = useCallback(async (type: ProjectType) => {
    setLoadingProjects(true);
    setProjectListItems([]);
    try {
      let items: ProjectListItem[] = [];
      const supabase = createClient();
      const PAGE_SIZE = 1000;

      const fetchAllPages = async <T,>(
        fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
        label: string
      ): Promise<T[]> => {
        let allData: T[] = [];
        let hasMore = true;
        let page = 0;
        while (hasMore) {
          const from = page * PAGE_SIZE;
          const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
          if (error) {
            console.error(`[ManHourTaskInlineForm] ${label} error:`, error);
            break;
          }
          allData = allData.concat(data ?? []);
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          page++;
        }
        return allData;
      };

      switch (type) {
        case "Pitching": {
          // Unfiltered list so any designer/PM can report on a pitch they are not yet on BV for
          const allData = await fetchAllPages<any>(
            (from, to) =>
              supabase
                .from("bwa_pitchings")
                .select("id, pitching_code, real_customer_display_name, real_building_name, site_address")
                .order("created_date", { ascending: false, nullsFirst: false })
                .range(from, to),
            "bwa_pitchings"
          );
          items = allData.filter((p) => p.id).map((p) => ({
            _id: p.id,
            displayName: p.pitching_code
              ? `${p.pitching_code} ${p.real_customer_display_name || p.real_building_name || ""}`.trim()
              : p.real_customer_display_name || p.site_address || p.id,
            jobType: "bwa_pitching" as JobType,
          }));
          break;
        }
        case "Project": {
          // Unfiltered list so any designer/PM can report on a project they are not yet on BV for
          const allData = await fetchAllPages<any>(
            (from, to) =>
              supabase
                .from("bwa_projects")
                .select("id, project_code, project_name, real_customer_display_name")
                .order("created_date", { ascending: false, nullsFirst: false })
                .range(from, to),
            "bwa_projects"
          );
          items = allData.filter((p) => p.id).map((p) => ({
            _id: p.id,
            displayName: p.project_code
              ? `${p.project_code} ${p.project_name || p.real_customer_display_name || ""}`.trim()
              : p.project_name || p.real_customer_display_name || p.id,
            jobType: "bwa_project" as JobType,
          }));
          break;
        }
        case "BWF Pitching": {
          const allData = await fetchAllPages<any>(
            (from, to) =>
              supabase
                .from("bwf_pitchings")
                .select("id, pitching_code, pitching_name, real_customer_display_name")
                .order("created_date", { ascending: false, nullsFirst: false })
                .range(from, to),
            "bwf_pitchings"
          );
          items = allData.filter((p) => p.id).map((p) => ({
            _id: p.id,
            displayName: p.pitching_code
              ? `${p.pitching_code} ${p.pitching_name || p.real_customer_display_name || ""}`.trim()
              : p.pitching_name || p.real_customer_display_name || p.id,
            jobType: "bwf_pitching" as JobType,
          }));
          break;
        }
        case "BWF Project": {
          const allData = await fetchAllPages<any>(
            (from, to) =>
              supabase
                .from("bwf_projects")
                .select("id, project_code, project_name, real_customer_display_name")
                .order("created_date", { ascending: false, nullsFirst: false })
                .range(from, to),
            "bwf_projects"
          );
          items = allData.filter((p) => p.id).map((p) => ({
            _id: p.id,
            displayName: p.project_code
              ? `${p.project_code} ${p.project_name || p.real_customer_display_name || ""}`.trim()
              : p.project_name || p.real_customer_display_name || p.id,
            jobType: "bwf_project" as JobType,
          }));
          break;
        }
        case "❤️": {
          if (!staff?.id) break;
          const pinnedItems = await getPinnedProjects(staff.id);
          items = pinnedItems
            .filter((p) => p.project_id && isProjectPinType(p.pin_type))
            .map((p) => ({
              _id: p.project_id!,
              displayName: p.project_name || p.project_id!,
              jobType: p.pin_type as JobType,
            }));
          break;
        }
      }

      setProjectListItems(items);
      setCachedProjects(`inline_${type}_${staff?.id || ""}`, items);
    } catch (err) {
      console.error("[ManHourTaskInlineForm] Load projects error:", err);
    } finally {
      setLoadingProjects(false);
    }
  }, [staff]);

  // ─── Load edit data ─────────────────────────────────────
  useEffect(() => {
    if (isEditMode && editTaskId) {
      setLoading(true);
      getManHourTaskById(editTaskId)
        .then((task) => {
          if (task) {
            setSelectedProjectId(task.project_id || "");
            setSelectedJobType(task.job_type || null);
            setSelectedProjectName(task.project_name || "");
            setSelectedTaskId(task.task_bubble_id || "");
            setTaskDescription(task.task_description || "");
            setWorkHours(String(task.work_hour || 0));
            setImages(task.images || []);
            setAsanaLink(task.asana_link || "");
            setOutputCount(task.output_count ? String(task.output_count) : "");
            setOutputType(task.output_unit || "");
            // Restore AI tools from JSONB (keys = type codes + `{code}_other`)
            if (task.ai_tools) {
              const aiData = task.ai_tools as AiToolsData;
              const nextSelected: Record<string, string[]> = {};
              const nextOther: Record<string, string> = {};
              for (const [key, value] of Object.entries(aiData)) {
                if (key.endsWith("_other") && typeof value === "string") {
                  nextOther[key.slice(0, -"_other".length)] = value;
                } else if (Array.isArray(value)) {
                  nextSelected[key] = value.filter((v): v is string => typeof v === "string");
                }
              }
              setSelectedAiByCode(nextSelected);
              setAiOtherByCode(nextOther);
            }
            // Restore deliverables from JSONB
            if (task.deliverables) {
              const delData = task.deliverables as DeliverablesData;
              setOutputType(delData.type || "");
              setOutputCount(delData.count ? String(delData.count) : "");
              setOutputStage(delData.stage || "");
            }
          }
        })
        .catch((err) => console.error("[ManHourTaskInlineForm] Load task error:", err))
        .finally(() => setLoading(false));
    }
  }, [isEditMode, editTaskId]);

  // Auto-resolve task type from selected task (for edit mode)
  useEffect(() => {
    if (selectedTaskId && nosTasks.length > 0 && nosTaskTypes.length > 0 && !selectedTaskTypeId) {
      const task = nosTasks.find((t) => (t.bubble_id || t.id) === selectedTaskId || t.id === selectedTaskId);
      if (task && task.task_type_ids && task.task_type_ids.length > 0) {
        const firstTypeId = task.task_type_ids[0];
        const matchedType = nosTaskTypes.find(
          (tt) => tt.id === firstTypeId || tt.bubble_id === firstTypeId
        );
        if (matchedType) {
          setSelectedTaskTypeId(matchedType.bubble_id || matchedType.id);
        }
      }
    }
  }, [selectedTaskId, nosTasks, nosTaskTypes, selectedTaskTypeId]);

  // Load refs on mount
  useEffect(() => {
    loadReferenceData();
    loadPinnedTasks();
    loadPinnedProjectIds();
  }, [loadReferenceData, loadPinnedTasks, loadPinnedProjectIds]);

  // Load projects when type changes
  useEffect(() => {
    loadProjectsByType(projectType);
  }, [projectType, loadProjectsByType]);

  // ─── Filtered projects ──────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projectListItems.slice(0, 50);
    const search = projectSearch.toLowerCase();
    return projectListItems
      .filter((p) => p.displayName.toLowerCase().includes(search))
      .slice(0, 50);
  }, [projectListItems, projectSearch]);


  // ─── Filtered Tasks by Selected Task Type ──────────────────
  const filteredTasksByType = useMemo(() => {
    if (!selectedTaskTypeId) return [];
    const selectedType = nosTaskTypes.find(
      (tt) => tt.id === selectedTaskTypeId || tt.bubble_id === selectedTaskTypeId
    );
    if (!selectedType) return [];
    const typeKey = selectedType.bubble_id || selectedType.id;
    let filtered = nosTasks.filter((t) => {
      const typeIds = t.task_type_ids || [];
      return typeIds.includes(typeKey) || typeIds.includes(selectedType.id);
    });
    if (taskSearch) {
      const search = taskSearch.toLowerCase();
      filtered = filtered.filter(
        (t) => (t.display || "").toLowerCase().includes(search) || (t.eng_display || "").toLowerCase().includes(search)
      );
    }
    // Sort by English name A→Z (fall back to Chinese display when no eng_display).
    filtered.sort((a, b) =>
      (a.eng_display || a.display || "").localeCompare(b.eng_display || b.display || "", "en")
    );
    return filtered;
  }, [nosTasks, nosTaskTypes, selectedTaskTypeId, taskSearch]);

  // Label for a task option — English name first, then Chinese.
  const taskLabel = (task: { display?: string | null; eng_display?: string | null; id: string }) => {
    const en = (task.eng_display || "").trim();
    const zh = (task.display || "").trim();
    if (en && zh) return `${en} ${zh}`;
    return en || zh || task.id;
  };

  // ─── Check if selected task type requires project link ──────
  const isProjectLinkDisabled = useMemo(() => {
    if (!selectedTaskTypeId) return false;
    
    // When pinned task type is selected, check the actual selected task's type
    if (selectedTaskTypeId === "__pinned__") {
      if (!selectedTaskId) return false;
      const task = nosTasks.find((t) => (t.bubble_id || t.id) === selectedTaskId || t.id === selectedTaskId);
      if (!task || !task.task_type_ids || task.task_type_ids.length === 0) return false;
      // Check if ANY of the task's types has require_project_link === false
      return task.task_type_ids.some((typeId) => {
        const taskType = nosTaskTypes.find((tt) => tt.id === typeId || tt.bubble_id === typeId);
        return taskType && taskType.require_project_link === false;
      });
    }
    
    const selectedType = nosTaskTypes.find(
      (tt) => tt.id === selectedTaskTypeId || tt.bubble_id === selectedTaskTypeId
    );
    if (!selectedType) return false;
    return selectedType.require_project_link === false;
  }, [nosTaskTypes, selectedTaskTypeId, selectedTaskId, nosTasks]);

  // ─── Whether selected 任務選項 requires 成果 (deliverables) ──
  const isDeliverablesRequired = useMemo(() => {
    if (!selectedTaskId) return false;
    const task = nosTasks.find(
      (t) => (t.bubble_id || t.id) === selectedTaskId || t.id === selectedTaskId
    );
    return task?.require_deliverables === true;
  }, [selectedTaskId, nosTasks]);

  // Pinned Tasks (resolved)
  const pinnedTaskItems = useMemo(() => {
    if (pinnedTaskIds.length === 0 || nosTasks.length === 0) return [];
    const pinnedSet = new Set(pinnedTaskIds);
    let items = nosTasks.filter((t) => pinnedSet.has(t.bubble_id || "") || pinnedSet.has(t.id));
    if (taskSearch) {
      const search = taskSearch.toLowerCase();
      items = items.filter(
        (t) => (t.display || "").toLowerCase().includes(search) || (t.eng_display || "").toLowerCase().includes(search)
      );
    }
    items.sort((a, b) =>
      (a.eng_display || a.display || "").localeCompare(b.eng_display || b.display || "", "en")
    );
    return items;
  }, [pinnedTaskIds, nosTasks, taskSearch]);

  // ─── Handle Save ────────────────────────────────────────
  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!selectedTaskId) errors.task = "請選擇一個 Task（任務）";
    if (!isProjectLinkDisabled && !selectedProjectId) errors.project = "請選擇關聯項目";
    if (!taskDescription || !taskDescription.trim()) errors.description = "請填寫工作描述";
    if (!workHours || parseFloat(workHours) <= 0) errors.workHours = "請填寫工作時數";
    if (isDeliverablesRequired) {
      if (!outputType) errors.deliverables = "請選擇成果類型";
      else if (!outputCount || parseInt(outputCount, 10) <= 0) errors.deliverables = "請填寫成果數量";
      else if (!outputStage) errors.deliverables = "請選擇成果階段";
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setSaving(true);
    try {
      // Resolve task_name + task_type (denormalized display for reports / designer-load)
      const task = nosTasks.find((t) => t.id === selectedTaskId || t.bubble_id === selectedTaskId);
      let resolvedTaskType = nosTaskTypes.find(
        (tt) => tt.id === selectedTaskTypeId || tt.bubble_id === selectedTaskTypeId
      );
      if (!resolvedTaskType && task?.task_type_ids?.length) {
        const firstTypeId = task.task_type_ids[0];
        resolvedTaskType = nosTaskTypes.find(
          (tt) => tt.id === firstTypeId || tt.bubble_id === firstTypeId
        );
      }
      const resolvedTaskTypeName =
        resolvedTaskType?.display || resolvedTaskType?.eng_display || undefined;

      const buildAiToolsPayload = (): { payload: AiToolsData; hasAiTools: boolean } => {
        const payload: AiToolsData = {};
        let hasAiTools = false;
        const codes = new Set([
          ...aiToolGroups.map((g) => g.code),
          ...Object.keys(selectedAiByCode),
          ...Object.keys(aiOtherByCode),
        ]);
        for (const code of codes) {
          const selected = selectedAiByCode[code] || [];
          const other = (aiOtherByCode[code] || "").trim();
          if (selected.length > 0) {
            payload[code] = selected;
            hasAiTools = true;
          }
          if (other) {
            payload[`${code}_other`] = other;
            hasAiTools = true;
          }
        }
        return { payload, hasAiTools };
      };

      if (isEditMode) {
        const { payload: aiToolsPayload, hasAiTools } = buildAiToolsPayload();
        const deliverablesPayload: DeliverablesData | null = outputType
          ? { type: outputType, count: outputCount ? parseInt(outputCount) : 0, stage: outputStage || undefined }
          : null;

        const updates: ManHourTaskUpdate = {
          project_id: selectedProjectId || null,
          job_type: selectedJobType || null,
          project_name: selectedProjectName || null,
          asana_link: asanaLink || null,
          task_bubble_id: selectedTaskId || undefined,
          task_name: task?.display || undefined,
          task_type: resolvedTaskTypeName,
          task_type_bubble_id: resolvedTaskType?.id,
          task_description: taskDescription || undefined,
          work_hour: workHours ? parseFloat(workHours) : undefined,
          images: images.length > 0 ? images : null,
          output_count: outputCount ? parseInt(outputCount) : undefined,
          output_unit: outputType || undefined,
          ai_tools: hasAiTools ? aiToolsPayload : null,
          deliverables: deliverablesPayload,
        };
        await updateManHourTask(editTaskId!, updates);
      } else {
        const { payload: aiToolsPayload, hasAiTools } = buildAiToolsPayload();
        const deliverablesPayload: DeliverablesData | null = outputType
          ? { type: outputType, count: outputCount ? parseInt(outputCount) : 0, stage: outputStage || undefined }
          : null;

        const insertData: ManHourTaskInsert = {
          man_hour_date_id: manHourDateId,
          project_id: selectedProjectId || undefined,
          job_type: selectedJobType || undefined,
          project_name: selectedProjectName || undefined,
          asana_link: asanaLink || undefined,
          task_bubble_id: selectedTaskId || undefined,
          task_name: task?.display || undefined,
          task_type: resolvedTaskTypeName,
          task_type_bubble_id: resolvedTaskType?.id,
          task_description: taskDescription || undefined,
          work_hour: workHours ? parseFloat(workHours) : 0,
          images: images.length > 0 ? images : undefined,
          output_count: outputCount ? parseInt(outputCount) : undefined,
          output_unit: outputType || undefined,
          ai_tools: hasAiTools ? aiToolsPayload : undefined,
          deliverables: deliverablesPayload || undefined,
        };
        await createManHourTask(insertData);
      }
      onSaved();
      // Reset form if not editing
      if (!isEditMode) {
        setSelectedProjectId("");
        setSelectedJobType(null);
        setSelectedProjectName("");
        setSelectedTaskTypeId("");
        setSelectedTaskId("");
        setTaskDescription("");
        setWorkHours("0");
        setImages([]);
        setAsanaLink("");
        setOutputType("");
        setOutputCount("");
        setOutputStage("");
        setSelectedAiByCode({});
        setAiOtherByCode({});
      }
      toast({ title: isEditMode ? "已更新" : "已新增", description: "任務已儲存", duration: 2000 });
    } catch (err: any) {
      console.error("[ManHourTaskInlineForm] Save error:", err);
      toast({ title: "儲存失敗", description: err?.message || "Unknown error", variant: "destructive", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  // Project type tabs
  const projectTypes: ProjectType[] = ["Pitching", "Project", "BWF Pitching", "BWF Project", "❤️"];

  if (loading || loadingRefs) {
    return (
      <div className="border rounded-xl bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500 text-sm">載入中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl bg-white overflow-hidden ${isEditMode ? 'border-amber-300 ring-1 ring-amber-200' : ''}`}>
      {/* ─── Section Header (clickable to collapse/expand) ────────────────────── */}
      <div
        className={`flex items-center justify-between px-4 sm:px-6 py-4 ${!isCollapsed ? 'border-b' : ''} ${isEditMode ? 'bg-amber-50/80' : 'bg-gray-50/50'} cursor-pointer select-none hover:bg-gray-100/60 transition-colors`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full ${isEditMode ? 'bg-amber-500' : 'bg-green-500'} text-white text-sm font-bold flex items-center justify-center`}>
            {isEditMode ? '✏' : taskNumber}
          </span>
          <h3 className={`text-base font-semibold ${isEditMode ? 'text-amber-700' : 'text-green-700'}`}>
            {isEditMode ? '編輯任務' : '工作項目'}
          </h3>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onPinToFavorites && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-amber-600 gap-1"
              onClick={onPinToFavorites}
            >
              <Star className="w-3.5 h-3.5" />
              加入到常用匯報項目
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ─── Main Form Row (matching reference image layout) ────── */}
      {!isCollapsed && (
      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Phone: one field per row. Desktop: 12-col row. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* 工作類別 (Task Type select) */}
          <div className="col-span-1 lg:col-span-2 space-y-1.5 min-w-0">
            <Label className="text-xs font-medium text-gray-600">
              工作類別 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedTaskTypeId}
              onValueChange={(val) => {
                setSelectedTaskTypeId(val);
                // Reset task selection when type changes
                setSelectedTaskId("");
                setTaskDescription("");
                setValidationErrors((prev) => { const { task: _, ...rest } = prev; return rest; });
                // Clear project selection if the new type doesn't require project link
                const newType = nosTaskTypes.find((tt) => tt.id === val || tt.bubble_id === val);
                if (newType && newType.require_project_link === false) {
                  setSelectedProjectId("");
                  setSelectedJobType(null);
                  setSelectedProjectName("");
                }
              }}
            >
              <SelectTrigger className={`h-10 ${validationErrors.task && !selectedTaskTypeId ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="選擇類別..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {/* ❤️ Pinned tasks as first option */}
                <SelectItem key="__pinned__" value="__pinned__">
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                    喜好任務
                  </span>
                </SelectItem>
                <div className="border-t my-1" />
                {nosTaskTypes.map((tt) => (
                  <SelectItem key={tt.id} value={tt.bubble_id || tt.id}>
                    {tt.display || tt.eng_display || tt.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 任務選項 (Task Option - filtered by task type) */}
          <div className="col-span-1 lg:col-span-3 space-y-1.5 min-w-0">
            <Label className="text-xs font-medium text-gray-600">
              任務選項 <span className="text-red-500">*</span>
            </Label>
            {validationErrors.task && <p className="text-xs text-red-500">{validationErrors.task}</p>}
            <div className="flex items-center gap-1.5">
            <Select
              value={selectedTaskId}
              onOpenChange={(open) => { if (!open) setTaskSearch(""); }}
              onValueChange={(val) => {
                setSelectedTaskId(val);
                const task = nosTasks.find((t) => (t.bubble_id || t.id) === val);
                if (task) {
                  setTaskDescription(task.display || val);
                  setValidationErrors((prev) => { const { task: _, description: __, ...rest } = prev; return rest; });
                  // When in pinned mode, check if selected task's type doesn't require project link
                  if (selectedTaskTypeId === "__pinned__" && task.task_type_ids && task.task_type_ids.length > 0) {
                    const taskTypeDisablesProject = task.task_type_ids.some((typeId) => {
                      const taskType = nosTaskTypes.find((tt) => tt.id === typeId || tt.bubble_id === typeId);
                      return taskType && taskType.require_project_link === false;
                    });
                    if (taskTypeDisablesProject) {
                      setSelectedProjectId("");
                      setSelectedJobType(null);
                      setSelectedProjectName("");
                      setValidationErrors((prev) => { const { project: _, ...rest } = prev; return rest; });
                    }
                  }
                }
              }}
              disabled={!selectedTaskTypeId}
            >
              <SelectTrigger className={`h-10 flex-1 min-w-0 ${validationErrors.task ? 'border-red-500' : ''}`}>
                <SelectValue placeholder={selectedTaskTypeId ? "選擇任務..." : "請先選擇類別"} />
              </SelectTrigger>
              <SelectContent className="max-h-[340px] w-[var(--radix-select-trigger-width)] min-w-0 sm:min-w-[300px]">
                {/* Search box — sticks to the top of the dropdown. Negative
                    top/margins bleed over the Viewport's p-1 padding so options
                    don't peek above/beside it while scrolling. */}
                <div className="sticky -top-1 z-10 -mt-1 -mx-1 bg-white px-3 pt-2 pb-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="搜尋任務 Search task..."
                      className="h-8 pl-7 text-xs"
                      // Keep typing inside the input instead of the Select's typeahead.
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                {/* When ❤️ pinned type is selected, show ALL pinned tasks */}
                {selectedTaskTypeId === "__pinned__" ? (
                  <>
                    {pinnedTaskItems.length > 0 ? (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-red-500" /> 喜好任務
                        </div>
                        {pinnedTaskItems.map((task) => (
                          <SelectItem key={`pin-${task.id}`} value={task.bubble_id || task.id}>
                            {taskLabel(task)}
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      <div className="px-2 py-2 text-xs text-gray-400 text-center">
                        尚未收藏任何任務
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Pinned Tasks (filtered to current type) */}
                    {pinnedTaskItems.filter((t) => {
                      const typeIds = t.task_type_ids || [];
                      return typeIds.includes(selectedTaskTypeId);
                    }).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-red-600 flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-red-500" /> 喜好任務
                        </div>
                        {pinnedTaskItems
                          .filter((t) => {
                            const typeIds = t.task_type_ids || [];
                            return typeIds.includes(selectedTaskTypeId);
                          })
                          .map((task) => (
                            <SelectItem key={`pin-${task.id}`} value={task.bubble_id || task.id}>
                              {taskLabel(task)}
                            </SelectItem>
                          ))}
                        <div className="border-t my-1" />
                      </>
                    )}
                    {/* Filtered tasks by selected type (excluding pinned to avoid duplicate values) */}
                    {filteredTasksByType
                      .filter((task) => {
                        const taskKey = task.bubble_id || task.id;
                        const pinnedSet = new Set(pinnedTaskIds);
                        return !(pinnedSet.has(taskKey) || pinnedSet.has(task.id));
                      })
                      .map((task) => (
                      <SelectItem key={task.id} value={task.bubble_id || task.id}>
                        {taskLabel(task)}
                      </SelectItem>
                    ))}
                    {selectedTaskTypeId && filteredTasksByType.length === 0 && pinnedTaskItems.filter((t) => {
                      const typeIds = t.task_type_ids || [];
                      return typeIds.includes(selectedTaskTypeId);
                    }).length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-400 text-center">
                        此類別下暫無任務
                      </div>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>
            {/* Pin/Unpin Task Button */}
            {selectedTaskId && (
              <button
                type="button"
                onClick={() => {
                  const task = nosTasks.find((t) => (t.bubble_id || t.id) === selectedTaskId);
                  if (task) {
                    handleTogglePinTask(selectedTaskId, task.display || task.eng_display || task.id);
                  }
                }}
                disabled={pinningTaskId === selectedTaskId}
                className={`p-2 rounded-lg border transition-all duration-200 flex-shrink-0 ${
                  pinnedTaskIds.includes(selectedTaskId)
                    ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                    : "border-gray-200 bg-white text-gray-400 hover:text-red-400 hover:border-red-200 hover:bg-red-50"
                } ${pinningTaskId === selectedTaskId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                title={pinnedTaskIds.includes(selectedTaskId) ? "取消收藏任務" : "收藏任務"}
              >
                <Heart className={`w-4 h-4 ${pinnedTaskIds.includes(selectedTaskId) ? "fill-red-500" : ""}`} />
              </button>
            )}
            </div>
          </div>

          {/* 關聯提案/項目 (Related Project) */}
          <div className="col-span-1 lg:col-span-3 space-y-1.5 min-w-0">
            <Label className="text-xs font-medium text-gray-600">關聯提案/項目{!isProjectLinkDisabled && <span className="text-red-500 ml-0.5">*</span>}</Label>
            {validationErrors.project && <p className="text-xs text-red-500">{validationErrors.project}</p>}
            <div className="flex items-center gap-1.5">
            {isProjectLinkDisabled ? (
              <div className="relative flex-1">
                <Input
                  placeholder="無需關聯"
                  value=""
                  disabled
                  className="h-10 bg-gray-100 text-gray-400 cursor-not-allowed"
                />
              </div>
            ) : (
            <div className="relative flex-1" ref={projectDropdownRef}>
              <Input
                placeholder="搜尋項目..."
                value={selectedProjectName}
                onChange={(e) => {
                  setSelectedProjectName(e.target.value);
                  setProjectSearch(e.target.value);
                  setProjectDropdownOpen(true);
                }}
                onFocus={() => setProjectDropdownOpen(true)}
                className={`h-10 bg-white ${validationErrors.project ? 'border-red-500' : ''}`}
              />
              {/* Project dropdown */}
              {projectDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[260px] overflow-hidden">
                  {/* Type tabs */}
                  <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
                    {projectTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setProjectType(type)}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          projectType === type
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {type === "❤️" ? <Heart className="w-3 h-3 fill-red-500 text-red-500 inline" /> : type}
                      </button>
                    ))}
                  </div>
                  {/* Project search */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="搜尋..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="pl-8 h-8 text-sm border-0 bg-gray-50 focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  {/* Project list */}
                  <div className="max-h-[160px] overflow-y-auto">
                    {loadingProjects ? (
                      <div className="py-4 text-center text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> 載入中...
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="py-4 text-center text-gray-400 text-sm">沒有找到項目</div>
                    ) : (
                      filteredProjects.map((project) => {
                        const isSelected = selectedProjectId === project._id;
                        const isPinned = pinnedProjectIds.has(project._id);
                        const isPinning = pinningProjectId === project._id;
                        return (
                          <div
                            key={project._id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors border-b last:border-b-0 flex items-center justify-between gap-2 ${
                              isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex-1 text-left truncate"
                              onClick={() => {
                                setSelectedProjectId(project._id);
                                setSelectedJobType(project.jobType);
                                setSelectedProjectName(project.displayName);
                                setProjectDropdownOpen(false);
                                setProjectSearch("");
                                setValidationErrors((prev) => { const { project: _, ...rest } = prev; return rest; });
                              }}
                            >
                              <span className="truncate block">{project.displayName}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePinProject(project._id, project.displayName, project.jobType);
                              }}
                              disabled={isPinning}
                              className={`p-1 rounded-full transition-colors flex-shrink-0 ${
                                isPinned
                                  ? "text-red-500 hover:text-red-600"
                                  : "text-gray-300 hover:text-red-400"
                              } ${isPinning ? "opacity-50" : ""}`}
                              title={isPinned ? "取消收藏" : "加入收藏"}
                            >
                              <Heart className={`w-4 h-4 ${isPinned ? "fill-red-500" : ""}`} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {/* Close button */}
                  <div className="p-1.5 border-t bg-gray-50 text-center">
                    <button
                      type="button"
                      onClick={() => setProjectDropdownOpen(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      關閉
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
            {/* Pin/Unpin Project Button */}
            {!isProjectLinkDisabled && selectedProjectId && (
              <button
                type="button"
                onClick={() => {
                  if (selectedProjectId && selectedProjectName && selectedJobType) {
                    handleTogglePinProject(selectedProjectId, selectedProjectName, selectedJobType);
                  }
                }}
                disabled={pinningProjectId === selectedProjectId}
                className={`p-2 rounded-lg border transition-all duration-200 flex-shrink-0 ${
                  pinnedProjectIds.has(selectedProjectId)
                    ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                    : "border-gray-200 bg-white text-gray-400 hover:text-red-400 hover:border-red-200 hover:bg-red-50"
                } ${pinningProjectId === selectedProjectId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                title={pinnedProjectIds.has(selectedProjectId) ? "取消收藏項目" : "收藏項目"}
              >
                <Heart className={`w-4 h-4 ${pinnedProjectIds.has(selectedProjectId) ? "fill-red-500" : ""}`} />
              </button>
            )}
            </div>
          </div>

          {/* 工時(h) */}
          <div className="col-span-1 lg:col-span-1 space-y-1.5 min-w-0">
            <Label className="text-xs font-medium text-gray-600">
              工時(h) <span className="text-red-500">*</span>
            </Label>
            {validationErrors.workHours && <p className="text-xs text-red-500">{validationErrors.workHours}</p>}
            <Input
              type="number"
              placeholder="0"
              min={0}
              max={8}
              step={0.5}
              value={workHours}
              onChange={(e) => { setWorkHours(e.target.value); setValidationErrors((prev) => { const { workHours, ...rest } = prev; return rest; }); }}
              className={`h-10 text-center ${validationErrors.workHours ? 'border-red-500' : ''}`}
            />
          </div>

          {/* 工作內容 */}
          <div className="col-span-1 lg:col-span-3 space-y-1.5 min-w-0">
            <Label className="text-xs font-medium text-gray-600">
              工作內容 <span className="text-red-500">*</span>
            </Label>
            {validationErrors.description && <p className="text-xs text-red-500">{validationErrors.description}</p>}
            <Textarea
              placeholder="簡述工作內容...（可換行）"
              value={taskDescription}
              onChange={(e) => { setTaskDescription(e.target.value); setValidationErrors((prev) => { const { description, ...rest } = prev; return rest; }); }}
              className={`min-h-[80px] resize-y ${validationErrors.description ? 'border-red-500' : ''}`}
            />
          </div>
        </div>

        {/* ─── 成果 Section (before AI tools) ────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                <span>⭐</span> 成果
                {isDeliverablesRequired && <span className="text-red-500">*</span>}
                <span>：</span>
              </span>
            </div>
            <Select
              value={outputType}
              onValueChange={(v) => {
                setOutputType(v);
                setValidationErrors((prev) => {
                  const { deliverables: _, ...rest } = prev;
                  return rest;
                });
              }}
            >
              <SelectTrigger className={`h-9 w-[140px] ${validationErrors.deliverables ? "border-red-500" : ""}`}>
                <SelectValue placeholder="類型..." />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {outputType && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="數量"
                  value={outputCount}
                  onChange={(e) => {
                    setOutputCount(e.target.value);
                    setValidationErrors((prev) => {
                      const { deliverables: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                  className={`h-9 w-20 text-center ${validationErrors.deliverables ? "border-red-500" : ""}`}
                  min={0}
                />
                <span className="text-sm text-gray-500">個</span>
                <Select
                  value={outputStage}
                  onValueChange={(v) => {
                    setOutputStage(v);
                    setValidationErrors((prev) => {
                      const { deliverables: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                >
                  <SelectTrigger className={`h-9 w-[140px] ${validationErrors.deliverables ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="階段..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTPUT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {validationErrors.deliverables && (
            <p className="text-xs text-red-500">{validationErrors.deliverables}</p>
          )}
        </div>

        {/* ─── 成果 上載提示 Hint ────────────────── */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[13px] text-amber-700 leading-relaxed">
          <p>不需要上載未完成的過程, 只需要上載成果 JPG, PDF, PPT</p>
          <p>例如: 1) 已完成的效果圖&nbsp;&nbsp;2) Floor Plan&nbsp;&nbsp;3) 客戶方案PPT&nbsp;&nbsp;4) 品牌設計</p>
        </div>

        {/* ─── File Upload Section ────────────── */}
        <div className="space-y-2">
          <MultiFileUploader
            value={images}
            onChange={setImages}
            bucket="man-hour-images"
            pathPrefix={`tasks/${manHourDateId}`}
            maxFiles={10}
            label="附加檔案 Attachments"
            required={false}
          />
        </div>

        {/* ─── AI 工具 Section ────────────────────── */}
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50/30">
          <h4 className="text-sm font-semibold text-purple-700 flex items-center gap-1.5">
            <span className="text-base">🤖</span> AI 工具
          </h4>

          {aiToolGroups.map((group, index) => {
            const selected = selectedAiByCode[group.code] || [];
            const other = aiOtherByCode[group.code] || "";
            return (
              <div key={group.code} className="space-y-2">
                <p className="text-xs font-medium text-green-700">
                  {index + 1}. {group.display}
                  {group.eng_display ? ` ${group.eng_display}` : ""}：
                </p>
                <div className="flex flex-wrap gap-3">
                  {group.tools.map((tool) => (
                    <label key={tool} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <Checkbox
                        checked={selected.includes(tool)}
                        onCheckedChange={(checked) => {
                          setSelectedAiByCode((prev) => {
                            const current = prev[group.code] || [];
                            return {
                              ...prev,
                              [group.code]: checked
                                ? [...current, tool]
                                : current.filter((t) => t !== tool),
                            };
                          });
                        }}
                      />
                      {tool}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={!!other}
                      onCheckedChange={(checked) => {
                        setAiOtherByCode((prev) => ({
                          ...prev,
                          [group.code]: checked ? prev[group.code] || " " : "",
                        }));
                      }}
                    />
                    其他:
                  </label>
                  {!!other && (
                    <Input
                      value={other.trimStart() === "" ? "" : other}
                      onChange={(e) =>
                        setAiOtherByCode((prev) => ({
                          ...prev,
                          [group.code]: e.target.value,
                        }))
                      }
                      placeholder="..."
                      className="h-7 w-32 text-sm"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Save Button ───────────────────────── */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
              取消
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {isEditMode ? "更新任務" : "儲存任務"}
              </>
            )}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
