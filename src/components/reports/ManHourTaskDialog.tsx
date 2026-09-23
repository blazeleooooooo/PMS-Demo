"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  Search,
  Heart,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiFileUploader } from "@/components/ui/multi-file-uploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createManHourTask,
  updateManHourTask,
  getManHourTaskById,
  getNOSTasks,
  getNOSTaskTypes,
  getNOSBrands,
  getNOSWorkLocations,
  getPinnedByType,
  getPinnedProjects,
  togglePin,
  isProjectPinType,
  type JobType,
  type ManHourTaskInsert,
  type ManHourTaskUpdate,
  type NOSTask,
  type NOSTaskType,
  type NOSBrand,
  type NOSWorkLocation,
} from "@/lib/man-hour-service";
import { createClient } from "@/lib/supabase/client";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";

// ─── Types ─────────────────────────────────────────────────

type ProjectType = "Pitching" | "Project" | "BWF Pitching" | "BWF Project" | "❤️";

/** Unified project item for the list display */
interface ProjectListItem {
  _id: string; // Supabase UUID
  displayName: string;
  jobType: JobType; // discriminator for which table it belongs to
}

// ─── Session-level cache for slow Bubble API calls ──────────
// This prevents re-fetching OTC and Pinned data every time the user switches tabs
const projectCache: Record<string, { items: ProjectListItem[]; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedProjects(key: string): ProjectListItem[] | null {
  const entry = projectCache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.items;
  }
  return null;
}

function setCachedProjects(key: string, items: ProjectListItem[]) {
  projectCache[key] = { items, timestamp: Date.now() };
}

interface ManHourTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  manHourDateId: string;
  editTaskId?: string | null;
}

// ─── Component ─────────────────────────────────────────────

export default function ManHourTaskDialog({
  open,
  onClose,
  onSaved,
  manHourDateId,
  editTaskId,
}: ManHourTaskDialogProps) {
  const isEditMode = !!editTaskId;
  const { displayName: currentStaffName } = useCurrentStaff();
  const { staff } = useAuth();
  const { toast } = useToast();

  // ─── Form State ─────────────────────────────────────────
  const [projectType, setProjectType] = useState<ProjectType>("Project");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(""); // UUID
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedWorkLocationId, setSelectedWorkLocationId] = useState<string>("");
  const [asanaLink, setAsanaLink] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [workHours, setWorkHours] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);

  // ─── Reference Data ─────────────────────────────────────
  const [projectListItems, setProjectListItems] = useState<ProjectListItem[]>([]);
  const [brands, setBrands] = useState<NOSBrand[]>([]);
  const [workLocations, setWorkLocations] = useState<NOSWorkLocation[]>([]);
  const [nosTasks, setNosTasks] = useState<NOSTask[]>([]);
  const [nosTaskTypes, setNosTaskTypes] = useState<NOSTaskType[]>([]);

  // ─── Pinned Tasks (from Man Hour Pinned → Task field) ───
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>([]);
  const [loadingPinnedTasks, setLoadingPinnedTasks] = useState(false);

  // ─── Pinned Projects (from Man Hour Pinned → Project field) ───
  const [pinnedProjectIds, setPinnedProjectIds] = useState<Set<string>>(new Set());
  const [pinningProjectId, setPinningProjectId] = useState<string | null>(null);
  const [pinningTaskId, setPinningTaskId] = useState<string | null>(null);

  // ─── UI State ───────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [projectSearch, setProjectSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [loadingRefs, setLoadingRefs] = useState(true);

  // ─── Load Reference Data (non-project refs) ─────────────
  const loadReferenceData = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const [brandsRes, locationsRes, tasksRes, taskTypesRes] = await Promise.all([
        getNOSBrands(),
        getNOSWorkLocations(),
        getNOSTasks(),
        getNOSTaskTypes(),
      ]);
      setBrands(brandsRes);
      setWorkLocations(locationsRes);
      setNosTasks(tasksRes);
      setNosTaskTypes(taskTypesRes);
    } catch (err) {
      console.error("[ManHourTaskDialog] Error loading reference data:", err);
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  // ─── Load Pinned Tasks for Current User ─────────────────
  const loadPinnedTasks = useCallback(async () => {
    if (!staff?.id) return;
    // Use cache
    const cacheKey = `pinned_tasks_${staff.id}`;
    const cached = getCachedProjects(cacheKey);
    if (cached) {
      // cached items hold _id which are task IDs (bubble_id or uuid)
      setPinnedTaskIds(cached.map((c) => c._id));
      return;
    }
    setLoadingPinnedTasks(true);
    try {
      // Fetch pinned tasks from Supabase man_hour_pinned table
      const pinnedItems = await getPinnedByType(staff.id, "task");
      // Extract unique task bubble IDs (used to match against nosTasks)
      const taskIds = [...new Set(
        pinnedItems
          .map((p) => p.task_bubble_id || p.task_name)
          .filter(Boolean) as string[]
      )];
      setPinnedTaskIds(taskIds);
      // Store in cache (as ProjectListItem format for compatibility)
      setCachedProjects(cacheKey, taskIds.map((id) => ({ _id: id, displayName: id, jobType: "bwa_project" as JobType })));
    } catch (err) {
      console.error("[ManHourTaskDialog] Error loading pinned tasks:", err);
      setPinnedTaskIds([]);
    } finally {
      setLoadingPinnedTasks(false);
    }
  }, [staff]);

  // ─── Load Pinned Project IDs (to show filled hearts) ─────
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
      console.error("[ManHourTaskDialog] Error loading pinned project IDs:", err);
    }
  }, [staff]);

  // ─── Toggle Pin Project (pin_type = JobType) ─────────────
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
        if (result.pinned) {
          next.add(projectId);
        } else {
          next.delete(projectId);
        }
        return next;
      });
      // Invalidate pinned projects cache
      const pinnedCacheKey = `pinned_${staff.id}`;
      delete projectCache[pinnedCacheKey];
      toast({
        title: result.pinned ? "已收藏" : "已取消收藏",
        description: projectName,
        duration: 2000,
      });
    } catch (err) {
      console.error("[ManHourTaskDialog] Error toggling pin project:", err);
      toast({
        title: "操作失敗",
        description: "無法更新收藏狀態，請重試",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setPinningProjectId(null);
    }
  }, [staff, pinningProjectId, toast]);

  // ─── Toggle Pin Task ─────────────────────────────────────
  const handleTogglePinTask = useCallback(async (taskKey: string, taskDisplayName: string) => {
    if (!staff?.id || pinningTaskId) return;
    setPinningTaskId(taskKey);
    try {
      const result = await togglePin(staff.id, "task", {
        task_name: taskDisplayName,
        task_bubble_id: taskKey,
      });
      setPinnedTaskIds((prev) => {
        if (result.pinned) {
          return [...prev, taskKey];
        } else {
          return prev.filter((id) => id !== taskKey);
        }
      });
      // Invalidate pinned tasks cache
      const cacheKey = `pinned_tasks_${staff.id}`;
      delete projectCache[cacheKey];
      toast({
        title: result.pinned ? "已收藏" : "已取消收藏",
        description: taskDisplayName,
        duration: 2000,
      });
    } catch (err) {
      console.error("[ManHourTaskDialog] Error toggling pin task:", err);
      toast({
        title: "操作失敗",
        description: "無法更新收藏狀態，請重試",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setPinningTaskId(null);
    }
  }, [staff, pinningTaskId, toast]);

  // ─── Load Project List by Type ──────────────────────────
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null; stage: string }>({ loaded: 0, total: null, stage: "" });

  const loadProjectsByType = useCallback(async (type: ProjectType) => {
    setLoadingProjects(true);
    setProjectListItems([]);
    setLoadProgress({ loaded: 0, total: null, stage: "正在連接..." });
    try {
      let items: ProjectListItem[] = [];
      const supabase = createClient();

      switch (type) {
        case "Pitching": {
          // Unfiltered list so any designer/PM can report on a pitch they are not yet on BV for
          const PAGE_SIZE = 1000;
          let allData: any[] = [];
          let hasMore = true;
          let page = 0;
          setLoadProgress({ loaded: 0, total: null, stage: "載入 BWA Pitching..." });

          while (hasMore) {
            const from = page * PAGE_SIZE;
            const { data, error } = await supabase
              .from("bwa_pitchings")
              .select("id, pitching_code, real_customer_display_name, real_building_name, site_address")
              .order("created_date", { ascending: false, nullsFirst: false })
              .range(from, from + PAGE_SIZE - 1);
            if (error) { console.error("[ManHourTaskDialog] bwa_pitchings error:", error); break; }
            allData = allData.concat(data ?? []);
            setLoadProgress({ loaded: allData.length, total: null, stage: "載入 BWA Pitching..." });
            hasMore = (data?.length ?? 0) === PAGE_SIZE;
            page++;
          }
          items = allData
            .filter((p: any) => p.id)
            .map((p: any) => ({
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
          const PAGE_SIZE = 1000;
          let allData: any[] = [];
          let hasMore = true;
          let page = 0;
          setLoadProgress({ loaded: 0, total: null, stage: "載入 BWA Project..." });

          while (hasMore) {
            const from = page * PAGE_SIZE;
            const { data, error } = await supabase
              .from("bwa_projects")
              .select("id, project_code, project_name, real_customer_display_name")
              .order("created_date", { ascending: false, nullsFirst: false })
              .range(from, from + PAGE_SIZE - 1);
            if (error) { console.error("[ManHourTaskDialog] bwa_projects error:", error); break; }
            allData = allData.concat(data ?? []);
            setLoadProgress({ loaded: allData.length, total: null, stage: "載入 BWA Project..." });
            hasMore = (data?.length ?? 0) === PAGE_SIZE;
            page++;
          }
          items = allData
            .filter((p: any) => p.id)
            .map((p: any) => ({
              _id: p.id,
              displayName: p.project_code
                ? `${p.project_code} ${p.project_name || p.real_customer_display_name || ""}`.trim()
                : p.project_name || p.real_customer_display_name || p.id,
              jobType: "bwa_project" as JobType,
            }));
          break;
        }
        case "BWF Pitching": {
          // Unfiltered list so any designer/PM can report on a pitch they are not yet on BV for
          const PAGE_SIZE = 1000;
          let allData: any[] = [];
          let hasMore = true;
          let page = 0;
          setLoadProgress({ loaded: 0, total: null, stage: "載入 BWF Pitching..." });

          while (hasMore) {
            const from = page * PAGE_SIZE;
            const { data, error } = await supabase
              .from("bwf_pitchings")
              .select("id, pitching_code, pitching_name, real_customer_display_name")
              .order("created_date", { ascending: false, nullsFirst: false })
              .range(from, from + PAGE_SIZE - 1);
            if (error) { console.error("[ManHourTaskDialog] bwf_pitchings error:", error); break; }
            allData = allData.concat(data ?? []);
            setLoadProgress({ loaded: allData.length, total: null, stage: "載入 BWF Pitching..." });
            hasMore = (data?.length ?? 0) === PAGE_SIZE;
            page++;
          }
          items = allData
            .filter((p: any) => p.id)
            .map((p: any) => ({
              _id: p.id,
              displayName: p.pitching_code
                ? `${p.pitching_code} ${p.pitching_name || p.real_customer_display_name || ""}`.trim()
                : p.pitching_name || p.real_customer_display_name || p.id,
              jobType: "bwf_pitching" as JobType,
            }));
          break;
        }
        case "BWF Project": {
          // Unfiltered list so any designer/PM can report on a project they are not yet on BV for
          const PAGE_SIZE = 1000;
          let allData: any[] = [];
          let hasMore = true;
          let page = 0;
          setLoadProgress({ loaded: 0, total: null, stage: "載入 BWF Project..." });

          while (hasMore) {
            const from = page * PAGE_SIZE;
            const { data, error } = await supabase
              .from("bwf_projects")
              .select("id, project_code, project_name, real_customer_display_name")
              .order("created_date", { ascending: false, nullsFirst: false })
              .range(from, from + PAGE_SIZE - 1);
            if (error) { console.error("[ManHourTaskDialog] bwf_projects error:", error); break; }
            allData = allData.concat(data ?? []);
            setLoadProgress({ loaded: allData.length, total: null, stage: "載入 BWF Project..." });
            hasMore = (data?.length ?? 0) === PAGE_SIZE;
            page++;
          }
          items = allData
            .filter((p: any) => p.id)
            .map((p: any) => ({
              _id: p.id,
              displayName: p.project_code
                ? `${p.project_code} ${p.project_name || p.real_customer_display_name || ""}`.trim()
                : p.project_name || p.real_customer_display_name || p.id,
              jobType: "bwf_project" as JobType,
            }));
          break;
        }
        case "❤️": {
          // Fetch pinned jobs — pin_type is already the JobType discriminator
          if (!staff?.id) {
            items = [];
            break;
          }
          const pinnedCacheKey = `pinned_${staff.id}`;
          const cachedPinned = getCachedProjects(pinnedCacheKey);
          if (cachedPinned) {
            items = cachedPinned;
            break;
          }
          setLoadProgress({ loaded: 0, total: null, stage: "載入 ❤️ Pinned..." });
          const pinnedData = await getPinnedProjects(staff.id);
          items = pinnedData
            .filter((pin) => pin.project_id && isProjectPinType(pin.pin_type))
            .map((pin) => ({
              _id: pin.project_id!,
              displayName: pin.project_name || pin.project_id!,
              jobType: pin.pin_type as JobType,
            }));
          setCachedProjects(pinnedCacheKey, items);
          break;
        }
      }

      setProjectListItems(items);
    } catch (err) {
      console.error(`[ManHourTaskDialog] Error loading ${type} list:`, err);
      setProjectListItems([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [currentStaffName, staff]);

  // ─── Load Edit Data ─────────────────────────────────────
  const loadEditData = useCallback(async () => {
    if (!editTaskId) return;
    setLoading(true);
    try {
      const task = await getManHourTaskById(editTaskId);
      if (!task) {
        console.error("[ManHourTaskDialog] Task not found:", editTaskId);
        return;
      }
      setSelectedProjectId(task.project_id || "");
      setSelectedJobType(task.job_type || null);
      setSelectedProjectName(task.project_name || "");
      setSelectedBrandId(task.brand_bubble_id || task.brand_name || "");
      setSelectedWorkLocationId(task.work_location || "");
      setAsanaLink(task.asana_link || "");
      setSelectedTaskId(task.task_bubble_id || task.task_name || "");
      setTaskDescription(task.task_description || "");
      setWorkHours(String(task.work_hour || ""));
      setImages(task.images || []);
    } catch (err) {
      console.error("[ManHourTaskDialog] Error loading task:", err);
    } finally {
      setLoading(false);
    }
  }, [editTaskId]);

  useEffect(() => {
    if (open) {
      loadReferenceData();
      loadPinnedTasks();
      loadPinnedProjectIds();
      if (isEditMode) {
        loadEditData();
      } else {
        // Reset form for create mode
        setProjectType("Project");
        setSelectedProjectId("");
        setSelectedJobType(null);
        setSelectedProjectName("");
        setSelectedBrandId("");
        setSelectedWorkLocationId("");
        setAsanaLink("");
        setSelectedTaskId("");
        setTaskDescription("");
        setWorkHours("");
        setImages([]);
        setProjectSearch("");
        setTaskSearch("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, loadReferenceData, loadEditData, loadPinnedTasks, loadPinnedProjectIds]);

  // Reload project list when projectType changes (if dialog is open)
  useEffect(() => {
    if (open) {
      setSelectedProjectId("");
      setSelectedJobType(null);
      setSelectedProjectName("");
      setProjectSearch("");
      loadProjectsByType(projectType);
    }
  }, [projectType, open, loadProjectsByType]);

  // ─── Background Preload: pre-fetch Pinned data when dialog opens ─
  // This runs once when the dialog opens so that by the time user switches to ❤️, data may already be cached.
  useEffect(() => {
    if (!open || !staff?.id) return;
    const pinnedCacheKey = `pinned_${staff.id}`;
    if (getCachedProjects(pinnedCacheKey)) return; // Already cached
    // No background preload for pinned — it's fast from Supabase, loaded on-demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id]);

  // ─── Filtered Projects ──────────────────────────────────
  // Full-list search is preserved — searching filters the entire list
  // Display is capped to keep DOM performant
  const DISPLAY_LIMIT_BROWSE = 30;
  const DISPLAY_LIMIT_SEARCH = 100;

  const filteredProjects = useMemo(() => {
    let filtered = projectListItems;
    if (projectSearch) {
      const search = projectSearch.toLowerCase();
      filtered = filtered.filter(
        (p) => p.displayName.toLowerCase().includes(search)
      );
      return filtered.slice(0, DISPLAY_LIMIT_SEARCH);
    }
    return filtered.slice(0, DISPLAY_LIMIT_BROWSE);
  }, [projectListItems, projectSearch]);

  const totalMatchCount = useMemo(() => {
    if (!projectSearch) return projectListItems.length;
    const search = projectSearch.toLowerCase();
    return projectListItems.filter(
      (p) => p.displayName.toLowerCase().includes(search)
    ).length;
  }, [projectListItems, projectSearch]);

  // ─── Group Tasks by NOS Task Type ────────────────────────
  const groupedTasks = useMemo(() => {
    // Build a map from task type ID (bubble_id) → display name
    const taskTypeMap: Record<string, string> = {};
    nosTaskTypes.forEach((tt) => {
      // Map both UUID and bubble_id for backward compatibility
      taskTypeMap[tt.id] = tt.display || tt.eng_display || tt.id;
      if (tt.bubble_id) {
        taskTypeMap[tt.bubble_id] = tt.display || tt.eng_display || tt.id;
      }
    });

    // Filter tasks by search
    let filtered = nosTasks;
    if (taskSearch) {
      const search = taskSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          (t.display || "").toLowerCase().includes(search) ||
          (t.eng_display || "").toLowerCase().includes(search)
      );
    }

    // Group by task_type_ids (list) — a task can appear in multiple groups
    const groups: Record<string, NOSTask[]> = {};
    filtered.forEach((task) => {
      const typeIds = task.task_type_ids || [];
      if (typeIds.length === 0) {
        const typeName = "其他";
        if (!groups[typeName]) groups[typeName] = [];
        groups[typeName].push(task);
      } else {
        typeIds.forEach((typeId) => {
          const typeName = taskTypeMap[typeId] || "其他";
          if (!groups[typeName]) groups[typeName] = [];
          groups[typeName].push(task);
        });
      }
    });

    // Sort tasks within each group by Sorting field
    Object.values(groups).forEach((tasks) => {
      tasks.sort((a, b) => (a.sorting || 999) - (b.sorting || 999));
    });

    return groups;
  }, [nosTasks, nosTaskTypes, taskSearch]);

  // ─── Pinned Tasks (resolved from pinnedTaskIds → nosTasks) ─
  const pinnedTaskItems = useMemo(() => {
    if (pinnedTaskIds.length === 0 || nosTasks.length === 0) return [];
    const pinnedSet = new Set(pinnedTaskIds);
    // Match by bubble_id since pinned tasks store bubble_ids
    let items = nosTasks.filter((t) => pinnedSet.has(t.bubble_id || "") || pinnedSet.has(t.id));
    // Apply search filter
    if (taskSearch) {
      const search = taskSearch.toLowerCase();
      items = items.filter(
        (t) =>
          (t.display || "").toLowerCase().includes(search) ||
          (t.eng_display || "").toLowerCase().includes(search)
      );
    }
    return items;
  }, [pinnedTaskIds, nosTasks, taskSearch]);

  // ─── Check if selected task's type requires project link ──────
  const isProjectLinkDisabled = useMemo(() => {
    if (!selectedTaskId) return false;
    const selectedTask = nosTasks.find(
      (t) => (t.bubble_id || t.id) === selectedTaskId || t.id === selectedTaskId
    );
    if (!selectedTask || !selectedTask.task_type_ids || selectedTask.task_type_ids.length === 0) return false;
    // Check if ANY of the task's associated types has require_project_link === false
    const matchedType = nosTaskTypes.find((tt) => {
      const typeKey = tt.bubble_id || tt.id;
      return selectedTask.task_type_ids!.includes(typeKey) || selectedTask.task_type_ids!.includes(tt.id);
    });
    if (matchedType && matchedType.require_project_link === false) return true;
    return false;
  }, [selectedTaskId, nosTasks, nosTaskTypes]);

  // ─── Handle Save ────────────────────────────────────────
  const handleSave = async () => {
    // ─── Validation (all required except Asana) ───
    const errors: Record<string, string> = {};
    if (!isProjectLinkDisabled && !selectedProjectId) {
      errors.project = "請選擇一個 Job（項目）";
    }
    if (!selectedTaskId) {
      errors.task = "請選擇一個 Task（任務）";
    }
    if (!taskDescription || !taskDescription.trim()) {
      errors.description = "請填寫工作描述";
    }
    if (!workHours || parseFloat(workHours) <= 0) {
      errors.workHours = "請填寫工作時數";
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setSaving(true);
    try {
      // Resolve task_name + task_type from nos_tasks / nos_task_types
      const task = nosTasks.find((t) => t.id === selectedTaskId || t.bubble_id === selectedTaskId);
      let resolvedTaskType: NOSTaskType | undefined;
      if (task?.task_type_ids?.length) {
        const firstTypeId = task.task_type_ids[0];
        resolvedTaskType = nosTaskTypes.find(
          (tt) => tt.id === firstTypeId || tt.bubble_id === firstTypeId
        );
      }
      const resolvedTaskTypeName =
        resolvedTaskType?.display || resolvedTaskType?.eng_display || undefined;

      if (isEditMode) {
        // Update existing task via Supabase
        const updates: ManHourTaskUpdate = {
          project_id: selectedProjectId || null,
          job_type: selectedJobType || null,
          project_name: selectedProjectName || null,
          brand_bubble_id: selectedBrandId || null,
          work_location: selectedWorkLocationId || undefined,
          asana_link: asanaLink || null,
          task_bubble_id: selectedTaskId || undefined,
          task_name: task?.display || undefined,
          task_type: resolvedTaskTypeName,
          task_type_bubble_id: resolvedTaskType?.id,
          task_description: taskDescription || undefined,
          work_hour: workHours ? parseFloat(workHours) : undefined,
          images: images.length > 0 ? images : null,
        };
        // Resolve brand_name from brands list
        const brand = brands.find((b) => b.id === selectedBrandId || b.bubble_id === selectedBrandId);
        if (brand) {
          updates.brand_name = brand.display || brand.brand_name || null;
        }
        await updateManHourTask(editTaskId!, updates);
      } else {
        // Create new task via Supabase
        const insertData: ManHourTaskInsert = {
          man_hour_date_id: manHourDateId,
          project_id: selectedProjectId || undefined,
          job_type: selectedJobType || undefined,
          project_name: selectedProjectName || undefined,
          brand_bubble_id: selectedBrandId || undefined,
          work_location: selectedWorkLocationId || undefined,
          asana_link: asanaLink || undefined,
          task_bubble_id: selectedTaskId || undefined,
          task_name: task?.display || undefined,
          task_type: resolvedTaskTypeName,
          task_type_bubble_id: resolvedTaskType?.id,
          task_description: taskDescription || undefined,
          work_hour: workHours ? parseFloat(workHours) : 0,
          images: images.length > 0 ? images : undefined,
        };
        // Resolve brand_name from brands list
        const brand = brands.find((b) => b.id === selectedBrandId || b.bubble_id === selectedBrandId);
        if (brand) {
          insertData.brand_name = brand.display || brand.brand_name || undefined;
        }
        await createManHourTask(insertData);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[ManHourTaskDialog] Save error:", err);
      alert(`儲存失敗: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Project Type Tabs ──────────────────────────────────
  const projectTypes: ProjectType[] = [
    "Pitching",
    "Project",
    "BWF Pitching",
    "BWF Project",
    "❤️",
  ];

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden w-full flex flex-col">
        {/* ═══════ Fixed Header ═══════ */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg font-bold">
            {isEditMode ? "編輯工作匯報" : "建立工作匯報"}
          </DialogTitle>
        </DialogHeader>

        {/* ═══════ Scrollable Content ═══════ */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 w-full">

        {(loading || loadingRefs) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500 text-sm">載入中...</span>
          </div>
        ) : (
          <div className="space-y-6 py-2 w-full min-w-0 max-w-full">
            {/* ═══════ Section 1: 項目資料 Project Info ═══════ */}
            <div className="space-y-4 w-full min-w-0">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                項目資料 Project Info
              </h3>

              {/* Choose Type */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">選擇類型 Choose Type</Label>
                <div className="flex flex-wrap gap-2">
                  {projectTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProjectType(type)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        projectType === type
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {type === "❤️" ? (
                        <Heart className={`w-4 h-4 ${projectType === type ? "fill-red-400 text-red-400" : "text-red-500 fill-red-500"}`} />
                      ) : (
                        type
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Choose Project */}
              <div className="space-y-2 w-full min-w-0">
                <Label className="text-xs text-gray-500">選擇項目 Choose Project {!isProjectLinkDisabled && <span className="text-red-500">*</span>}</Label>
                {validationErrors.project && <p className="text-xs text-red-500">{validationErrors.project}</p>}
                {isProjectLinkDisabled ? (
                  <div className="border rounded-lg overflow-hidden w-full bg-gray-100 p-4 flex items-center justify-center">
                    <span className="text-sm text-gray-400">無需關聯</span>
                  </div>
                ) : (
                <div className={`border rounded-lg overflow-hidden w-full ${validationErrors.project ? 'border-red-500' : ''}`}>
                  <div className="p-2 border-b bg-gray-50">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search for project..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="pl-9 h-9 border-0 bg-transparent focus-visible:ring-0"
                      />
                      {/* Show total/match count badge */}
                      {!loadingProjects && projectListItems.length > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {projectSearch
                            ? `${totalMatchCount} 筆結果`
                            : `共 ${projectListItems.length} 筆`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                    {loadingProjects ? (
                      <div className="py-6 text-center text-sm flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="text-gray-500">
                          {projectType === "❤️"
                            ? "正在從伺服器載入資料，請稍候..."
                            : "載入中..."}
                        </span>
                        {loadProgress.loaded > 0 && (
                          <span className="text-xs font-medium text-blue-600">
                            {loadProgress.stage}{" "}
                            {loadProgress.total
                              ? `${loadProgress.loaded} / ${loadProgress.total}`
                              : `已載入 ${loadProgress.loaded} 筆`}
                          </span>
                        )}
                        {loadProgress.total && loadProgress.total > 0 && (
                          <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${Math.min(100, (loadProgress.loaded / loadProgress.total) * 100)}%` }}
                            />
                          </div>
                        )}
                        {projectType === "❤️" && (
                          <span className="text-[12px] text-gray-400">首次載入後將會快取</span>
                        )}
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-sm">
                        沒有找到項目
                      </div>
                    ) : (
                      <>
                        {filteredProjects.map((project) => {
                          const isSelected = selectedProjectId === project._id;
                          const isPinned = pinnedProjectIds.has(project._id);
                          const isPinning = pinningProjectId === project._id;
                          return (
                            <div
                              key={project._id}
                              className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-blue-50/50 transition-colors flex items-center justify-between gap-3 overflow-hidden ${
                                isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedProjectId("");
                                    setSelectedJobType(null);
                                    setSelectedProjectName("");
                                  } else {
                                    setSelectedProjectId(project._id);
                                    setSelectedJobType(project.jobType);
                                    setSelectedProjectName(project.displayName);
                                    setValidationErrors((prev) => { const { project: _, ...rest } = prev; return rest; });
                                  }
                                }}
                                className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                    <span className="text-sm text-gray-800 font-medium truncate block">
                                      {project.displayName}
                                    </span>
                                  </div>
                                </div>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {isSelected && (
                                  <span className="text-blue-600 text-xs font-medium">
                                    ✓ 已選擇
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePinProject(project._id, project.displayName, project.jobType);
                                  }}
                                  disabled={isPinning}
                                  className={`p-1 rounded-full transition-colors ${
                                    isPinned
                                      ? "text-red-500 hover:text-red-600"
                                      : "text-gray-300 hover:text-red-400"
                                  } ${isPinning ? "opacity-50" : ""}`}
                                  title={isPinned ? "取消收藏" : "加入收藏"}
                                >
                                  <Heart className={`w-4 h-4 ${isPinned ? "fill-red-500" : ""}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {/* Truncation notice */}
                        {projectSearch && totalMatchCount > DISPLAY_LIMIT_SEARCH && (
                          <div className="py-2 text-center text-[12px] text-gray-400 border-t">
                            顯示前 {DISPLAY_LIMIT_SEARCH} 筆，請輸入更精確的搜尋條件
                          </div>
                        )}
                        {!projectSearch && projectListItems.length > DISPLAY_LIMIT_BROWSE && (
                          <div className="py-2 text-center text-[12px] text-gray-400 border-t">
                            顯示前 {DISPLAY_LIMIT_BROWSE} 筆，請使用搜尋查看更多
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* ═══════ Section 2: 任務資料 Task Info ═══════ */}
            <div className="space-y-4 w-full min-w-0">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
                任務資料 Task Info
              </h3>



              {/* Asana Link */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Asana</Label>
                <Input
                  placeholder="Asana link"
                  value={asanaLink}
                  onChange={(e) => setAsanaLink(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Choose Task */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">選擇任務 <span className="text-red-500">*</span></Label>
                {validationErrors.task && <p className="text-xs text-red-500">{validationErrors.task}</p>}
                <div className={`border rounded-lg overflow-hidden ${validationErrors.task ? 'border-red-500' : ''}`}>
                  <div className="p-2 border-b bg-gray-50">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search for task..."
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="pl-9 h-9 border-0 bg-transparent focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto p-3 space-y-4">
                    {/* ❤️ Pinned Tasks Section */}
                    {loadingPinnedTasks ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-black border-b pb-1 flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                          喜好任務
                        </h4>
                        <div className="py-2 text-center text-gray-400 text-xs">
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                          載入中...
                        </div>
                      </div>
                    ) : pinnedTaskItems.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-black border-b pb-1 flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                          喜好任務
                        </h4>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                          {pinnedTaskItems.map((task) => {
                            const taskKey = task.bubble_id || task.id;
                            const isSelected = selectedTaskId === taskKey;
                            const isTaskPinning = pinningTaskId === taskKey;
                            return (
                              <div
                                key={`pinned-${task.id}`}
                                className={`text-left text-sm px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                                  isSelected
                                    ? "text-red-600 font-medium bg-red-50"
                                    : "text-gray-700 hover:bg-red-50/50"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    { setSelectedTaskId(isSelected ? "" : taskKey); if (!isSelected) { setTaskDescription(task.display || taskKey); setValidationErrors((prev) => { const { task: _, description: __, ...rest } = prev; return rest; }); } }
                                  }
                                  className="flex items-center gap-1.5 min-w-0 flex-1"
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full border shrink-0 flex items-center justify-center ${
                                      isSelected
                                        ? "border-red-500 bg-red-500"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {isSelected && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                  </span>
                                  <span className="truncate">
                                    {task.display || task.eng_display || task.id}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePinTask(taskKey, task.display || task.eng_display || task.id);
                                  }}
                                  disabled={isTaskPinning}
                                  className={`p-0.5 rounded-full transition-colors shrink-0 text-red-500 hover:text-red-600 ${isTaskPinning ? "opacity-50" : ""}`}
                                  title="取消收藏"
                                >
                                  <Heart className="w-3 h-3 fill-red-500" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Regular Grouped Tasks */}
                    {Object.keys(groupedTasks).length === 0 && pinnedTaskItems.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-sm">
                        沒有找到任務
                      </div>
                    ) : (
                      Object.entries(groupedTasks).map(([typeName, tasks]) => (
                        <div key={typeName} className="space-y-2">
                          <h4 className="text-xs font-semibold text-gray-600 border-b pb-1">
                            {typeName}
                          </h4>
                          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                            {tasks.map((task) => {
                              const taskKey = task.bubble_id || task.id;
                              const isSelected = selectedTaskId === taskKey;
                              const isTaskPinned = pinnedTaskIds.includes(taskKey);
                              const isTaskPinning = pinningTaskId === taskKey;
                              return (
                                <div
                                  key={task.id}
                                  className={`text-left text-sm px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                                    isSelected
                                      ? "text-blue-600 font-medium bg-blue-50"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      { setSelectedTaskId(isSelected ? "" : taskKey); if (!isSelected) { setTaskDescription(task.display || taskKey); setValidationErrors((prev) => { const { task: _, description: __, ...rest } = prev; return rest; }); } }
                                    }
                                    className="flex items-center gap-1.5 min-w-0 flex-1"
                                  >
                                    <span
                                      className={`w-3 h-3 rounded-full border shrink-0 flex items-center justify-center ${
                                        isSelected
                                          ? "border-blue-500 bg-blue-500"
                                          : "border-gray-300"
                                      }`}
                                    >
                                      {isSelected && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                      )}
                                    </span>
                                    <span className="truncate">
                                      {task.display || task.eng_display || task.id}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePinTask(taskKey, task.display || task.eng_display || task.id);
                                    }}
                                    disabled={isTaskPinning}
                                    className={`p-0.5 rounded-full transition-colors shrink-0 ${
                                      isTaskPinned
                                        ? "text-red-500 hover:text-red-600"
                                        : "text-gray-300 hover:text-red-400"
                                    } ${isTaskPinning ? "opacity-50" : ""}`}
                                    title={isTaskPinned ? "取消收藏" : "加入收藏"}
                                  >
                                    <Heart className={`w-3 h-3 ${isTaskPinned ? "fill-red-500" : ""}`} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ Section 3: 描述 & 時數 ═══════ */}
            <div className="space-y-4 w-full min-w-0">
              <div className="flex gap-4">
                {/* Task Description */}
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-gray-500">任務描述 <span className="text-red-500">*</span></Label>
                  {validationErrors.description && <p className="text-xs text-red-500">{validationErrors.description}</p>}
                  <Textarea
                    placeholder="Type here..."
                    value={taskDescription}
                    onChange={(e) => { setTaskDescription(e.target.value); setValidationErrors((prev) => { const { description, ...rest } = prev; return rest; }); }}
                    className={`min-h-[80px] resize-none ${validationErrors.description ? 'border-red-500' : ''}`}
                  />
                </div>
                {/* Work Hours */}
                <div className="w-[120px] space-y-2">
                  <Label className="text-xs text-gray-500 text-right block">
                    工作時數 <span className="text-red-500">*</span>
                    <br />
                    <span className="text-[12px] text-gray-400">(最多8小時)</span>
                  </Label>
                  {validationErrors.workHours && <p className="text-xs text-red-500">{validationErrors.workHours}</p>}
                  <Input
                    type="number"
                    placeholder="Hour"
                    min={0}
                    max={8}
                    step={0.5}
                    value={workHours}
                    onChange={(e) => { setWorkHours(e.target.value); setValidationErrors((prev) => { const { workHours, ...rest } = prev; return rest; }); }}
                    className={`h-9 text-center ${validationErrors.workHours ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* ═══════ Section 4: 檔案上傳 ═══════ */}
            <div className="space-y-2 w-full min-w-0">
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
          </div>
        )}

        </div>

        {/* ═══════ Fixed Footer Buttons ═══════ */}
        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loadingRefs || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                儲存中...
              </>
            ) : (
              isEditMode ? "更新" : "確定"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
