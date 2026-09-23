"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Filter,
  Image as ImageIcon,
  Tag,
  ChevronDown,
  X,
  Eye,
  Download,
  Heart,
  Calendar,
  User,
  Layers,
  FolderOpen,
  Sparkles,
  Loader2,
  ZoomIn,
  Box,
  ExternalLink,
  FileBarChart,
  Clock,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentLightbox, type AttachmentLightboxImage } from "@/components/ui/attachment-lightbox";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";
import { isImageAttachmentUrl } from "@/lib/attachment-utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";

// ---------- Types ----------

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
  r_pitching_id: string | null;
  r_project_id: string | null;
  likes_count: number | null;
}

interface ThreeDRender {
  id: string;
  image: string | null;
  order: number | null;
  r_3d_collection_id: string | null;
  pitching_id: string | null;
  project_id: string | null;
  created_date: string | null;
}

interface StaffMember {
  id: string;
  name: string | null;
}

interface ProjectInfo {
  id: string;
  project_name: string | null;
  project_code: string | null;
}

interface PitchingInfo {
  id: string;
  description: string | null;
  pitching_code: string | null;
}

type ViewMode = "images" | "collections" | "outcomes";

// ── Work-report outcome (man-hour task with images), grouped by project ──
interface ManHourTaskRow {
  id: string;
  task_name: string | null;
  task_type: string | null;
  task_bubble_id: string | null;
  task_description: string | null;
  work_hour: number | null;
  project_id: string | null;
  project_name: string | null;
  man_hour_date_id: string | null;
  images: string[] | null;
  ai_tools: { text?: string[]; image?: string[]; video?: string[] } | null;
  deliverables: { type?: string; count?: number; stage?: string } | null;
  created_at: string | null;
}

// A single image within an outcome group, carrying its parent task's context
// so the lightbox can describe each photo.
interface OutcomeImageItem {
  url: string;
  reportDate: string | null; // man_hour_dates.report_date
  taskDescription: string | null;
  workHour: number | null;
  staffName: string | null;
  taskImageCount: number; // total images on the parent task
}

interface OutcomeGroup {
  key: string;
  projectId: string | null;
  projectName: string;
  isPitching: boolean;   // project_id actually references a pitching
  detailHref: string | null; // resolved /projects/bwa/{id} or /proposals/{id}
  images: string[];      // all image urls across the group's tasks
  imageItems: OutcomeImageItem[]; // images with per-task context (same order)
  totalHours: number;    // Σ work_hour
  dayCount: number;      // distinct report days
  avgPerDay: number;     // totalHours / dayCount
  taskCount: number;
  staffNames: string[];  // distinct reporting staff
  aiTools: string[];     // distinct AI tools used (across text/image/video)
  latestReportDate: string | null; // most recent related report date
  industryTag: string | null; // customer industry tag of the project
}

// ---------- Helpers ----------

// Single-select "客戶產業 Industry Tag" collection id (matches data-service).
const INDUSTRY_TAG_COLLECTION_ID = "4f5de598-2dcb-45a6-a106-9d933e9a8007";

function resolveImageUrl(image: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("//")) return `https:${image}`;
  return image;
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

import { formatDate } from "@/lib/date-utils";

const statusOptions: { value: string; label: string; color: string }[] = [
  { value: "草稿", label: "草稿", color: "bg-gray-100 text-gray-600" },
  { value: "進行中", label: "進行中", color: "bg-blue-50 text-blue-600" },
  { value: "審核中", label: "審核中", color: "bg-amber-50 text-amber-600" },
  { value: "已完成", label: "已完成", color: "bg-green-50 text-green-600" },
  { value: "已取消", label: "已取消", color: "bg-red-50 text-red-500" },
];

function getStatusBadge(status: string | null) {
  const opt = statusOptions.find((s) => s.value === status);
  if (!opt) return null;
  return (
    <Badge className={`text-[12px] border-0 ${opt.color}`}>{opt.label}</Badge>
  );
}

// ---------- Main Component ----------

export default function ThreeDGallery() {
  const supabase = createClient();
  const { canView, permissions, loading: permLoading } = usePermission();

  // Debug: log permission state on every render
  console.log("[ThreeDGallery] permLoading:", permLoading, "permissions count:", permissions.length, "canView('3d-design'):", !permLoading && canView("3d-design"));
  if (!permLoading && permissions.length > 0) {
    const threeDPerms = permissions.filter(p => p.module === "3d-design" || p.module === "*");
    console.log("[ThreeDGallery] Relevant permissions (3d-design or *):", threeDPerms);
  }

  // Data
  const [collections, setCollections] = useState<ThreeDCollection[]>([]);
  const [renders, setRenders] = useState<Record<string, ThreeDRender[]>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Record<string, ProjectInfo>>({});
  const [pitchings, setPitchings] = useState<Record<string, PitchingInfo>>({});
  const [loading, setLoading] = useState(true);

  // Work-report outcomes — man-hour tasks that carry images.
  const [manHourTasks, setManHourTasks] = useState<ManHourTaskRow[]>([]);
  // report_date keyed by man_hour_date_id (for avg-man-hour-per-day calc).
  const [manHourDates, setManHourDates] = useState<Record<string, string>>({});
  // reporting staff name keyed by man_hour_date_id.
  const [manHourStaff, setManHourStaff] = useState<Record<string, string>>({});
  // A man-hour task's project_id can reference EITHER a project or a pitching.
  // Track which ids are actually pitchings so 查看項目 routes to the right page.
  const [outcomePitchingIds, setOutcomePitchingIds] = useState<Set<string>>(new Set());
  // Industry tag (display) keyed by the task's project_id (resolved
  // project → customer → single-select industry tag collection).
  const [outcomeIndustryTag, setOutcomeIndustryTag] = useState<Record<string, string>>({});
  // task_bubble_id → { is效果圖, taskDisplay } resolved via nos_tasks.task_type_ids.
  const [outcomeTaskTypeInfo, setOutcomeTaskTypeInfo] = useState<
    Record<string, { isRender: boolean; display: string | null }>
  >({});

  // Filters (shared search + the 3D-collection filters)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDesigner, setSelectedDesigner] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "pitching" | "project">("all");

  // ── Outcome-specific filters (工作匯報成果) ──
  // These reinterpret the 狀態/標籤/設計師 controls for man-hour tasks.
  const [outcomeStages, setOutcomeStages] = useState<string[]>([]);      // deliverables.stage
  const [outcomeIndustryFilter, setOutcomeIndustryFilter] = useState<string[]>([]); // industry tag
  const [outcomeStaffFilter, setOutcomeStaffFilter] = useState<string | null>(null); // staff name
  // "只顯示效果圖" — default ON. Limits to tasks whose nos_task type is a 效果圖 type.
  const [onlyRender, setOnlyRender] = useState(true);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("images");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<AttachmentLightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ---------- Data Loading ----------

  useEffect(() => {
    loadData();
    loadOutcomes();
  }, []);

  async function loadOutcomes() {
    try {
      // All man-hour tasks that carry images (the "work-report outcomes").
      const { data: taskData } = await supabase
        .from("man_hour_tasks")
        .select("id, task_name, task_type, task_bubble_id, task_description, work_hour, project_id, project_name, man_hour_date_id, images, ai_tools, deliverables, created_at")
        .not("images", "is", null)
        .order("created_at", { ascending: false }) as { data: ManHourTaskRow[] | null };

      const withImages = (taskData || []).filter(
        (t) => Array.isArray(t.images) && t.images.length > 0
      );
      setManHourTasks(withImages);

      // ── Resolve task-type info (for the 只顯示效果圖 toggle) ──
      // man_hour_tasks.task_bubble_id matches nos_tasks.id (uuid) or .bubble_id;
      // nos_tasks.task_type_ids holds nos_task_types uuids. A task is a 效果圖
      // task when any of its types is an active nos_task_types whose display
      // contains "效果圖".
      const taskRefIds = [...new Set(withImages.map((t) => t.task_bubble_id).filter(Boolean) as string[])];
      if (taskRefIds.length > 0) {
        // Active task-type ids whose display contains 效果圖.
        const { data: renderTypes } = await supabase
          .from("nos_task_types")
          .select("id, display, is_active")
          .ilike("display", "%效果圖%")
          .eq("is_active", true) as { data: { id: string }[] | null };
        const renderTypeIds = new Set((renderTypes || []).map((r) => r.id));

        // task_bubble_id holds a MIX of nos_tasks UUIDs and legacy bubble ids.
        // Querying the uuid `id` column with a bubble-id string errors out the
        // whole request, so split the refs by form and query each column with
        // only its matching subset.
        const isUuid = (s: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const uuidRefs = taskRefIds.filter(isUuid);
        const bubbleRefs = taskRefIds.filter((s) => !isUuid(s));

        const [{ data: byId }, { data: byBubble }] = await Promise.all([
          uuidRefs.length
            ? supabase.from("nos_tasks").select("id, bubble_id, display, task_type_ids").in("id", uuidRefs)
            : Promise.resolve({ data: [] as any[] }),
          bubbleRefs.length
            ? supabase.from("nos_tasks").select("id, bubble_id, display, task_type_ids").in("bubble_id", bubbleRefs)
            : Promise.resolve({ data: [] as any[] }),
        ]) as { data: { id: string; bubble_id: string | null; display: string | null; task_type_ids: string[] | null }[] | null }[];

        const info: Record<string, { isRender: boolean; display: string | null }> = {};
        const register = (rows: typeof byId) => {
          (rows || []).forEach((nt) => {
            const isRender = (nt.task_type_ids || []).some((tid) => renderTypeIds.has(tid));
            const entry = { isRender, display: nt.display };
            if (nt.id) info[nt.id] = entry;
            if (nt.bubble_id) info[nt.bubble_id] = entry;
          });
        };
        register(byId);
        register(byBubble);
        setOutcomeTaskTypeInfo(info);
      }

      // Resolve report_date for each distinct man_hour_date_id (for avg/day).
      const dateIds = [...new Set(withImages.map((t) => t.man_hour_date_id).filter(Boolean) as string[])];
      if (dateIds.length > 0) {
        const { data: dateData } = await supabase
          .from("man_hour_dates")
          .select("id, report_date, staff_id")
          .in("id", dateIds) as { data: { id: string; report_date: string | null; staff_id: string | null }[] | null };
        if (dateData) {
          const map: Record<string, string> = {};
          dateData.forEach((d) => {
            if (d.report_date) map[d.id] = d.report_date;
          });
          setManHourDates(map);

          // Resolve the reporting staff for each date.
          const staffIds = [...new Set(dateData.map((d) => d.staff_id).filter(Boolean) as string[])];
          if (staffIds.length > 0) {
            const { data: staffData } = await supabase
              .from("staff")
              .select("id, name")
              .in("id", staffIds) as { data: { id: string; name: string | null }[] | null };
            const nameById: Record<string, string> = {};
            (staffData || []).forEach((s) => {
              if (s.name) nameById[s.id] = s.name.trim();
            });
            const staffByDate: Record<string, string> = {};
            dateData.forEach((d) => {
              if (d.staff_id && nameById[d.staff_id]) staffByDate[d.id] = nameById[d.staff_id];
            });
            setManHourStaff(staffByDate);
          }
        }
      }

      // Classify each project_id: those found in bwa_pitchings are pitchings,
      // so 查看項目 links to the pitching detail instead of a 404 project page.
      const refIds = [...new Set(withImages.map((t) => t.project_id).filter(Boolean) as string[])];
      if (refIds.length > 0) {
        // Resolve project/pitching → customer_id (one query each).
        const [{ data: projRows }, { data: pitchRows }] = await Promise.all([
          supabase.from("bwa_projects").select("id, customer_id").in("id", refIds),
          supabase.from("bwa_pitchings").select("id, customer_id").in("id", refIds),
        ]) as { data: { id: string; customer_id: string | null }[] | null }[];

        setOutcomePitchingIds(new Set((pitchRows || []).map((p) => p.id)));

        // project_id → customer_id (project takes precedence, then pitching).
        const customerByRef: Record<string, string> = {};
        (projRows || []).forEach((p) => { if (p.customer_id) customerByRef[p.id] = p.customer_id; });
        (pitchRows || []).forEach((p) => { if (p.customer_id && !customerByRef[p.id]) customerByRef[p.id] = p.customer_id; });

        // customer_id → industry tag display (single-select industry collection).
        const customerIds = [...new Set(Object.values(customerByRef))];
        if (customerIds.length > 0) {
          const { data: ctRows } = await supabase
            .from("customer_tags")
            .select("customer_uuid, tag_uuid")
            .eq("collection_uuid", INDUSTRY_TAG_COLLECTION_ID)
            .in("customer_uuid", customerIds) as { data: { customer_uuid: string; tag_uuid: string }[] | null };

          const tagIds = [...new Set((ctRows || []).map((r) => r.tag_uuid))];
          const tagNameById: Record<string, string> = {};
          if (tagIds.length > 0) {
            const { data: tagRows } = await supabase
              .from("nos_customer_tags")
              .select("id, display")
              .in("id", tagIds) as { data: { id: string; display: string | null }[] | null };
            (tagRows || []).forEach((t) => { if (t.display) tagNameById[t.id] = t.display; });
          }
          // customer_id → tag display
          const tagByCustomer: Record<string, string> = {};
          (ctRows || []).forEach((r) => {
            const name = tagNameById[r.tag_uuid];
            if (name && !tagByCustomer[r.customer_uuid]) tagByCustomer[r.customer_uuid] = name;
          });
          // project_id → tag display
          const tagByRef: Record<string, string> = {};
          Object.entries(customerByRef).forEach(([ref, cid]) => {
            if (tagByCustomer[cid]) tagByRef[ref] = tagByCustomer[cid];
          });
          setOutcomeIndustryTag(tagByRef);
        }
      }
    } catch (err) {
      console.error("Failed to load work-report outcomes:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      // Load all collections
      const { data: colData } = await supabase
        .from("three_d_collections")
        .select("id, display_name, description, o_3d_status, tags, version_number, created_date, main_designer_id, collab_designer_id, r_pitching_id, r_project_id, likes_count")
        .order("created_date", { ascending: false }) as { data: ThreeDCollection[] | null };

      if (colData) {
        setCollections(colData);

        // Load all renders for these collections
        const collectionIds = colData.map((c) => c.id);
        if (collectionIds.length > 0) {
          const { data: renderData } = await supabase
            .from("three_d_renders")
            .select("id, image, order, r_3d_collection_id, pitching_id, project_id, created_date")
            .in("r_3d_collection_id", collectionIds)
            .order("order", { ascending: true }) as { data: ThreeDRender[] | null };

          if (renderData) {
            const grouped: Record<string, ThreeDRender[]> = {};
            renderData.forEach((r) => {
              const colId = r.r_3d_collection_id || "unknown";
              if (!grouped[colId]) grouped[colId] = [];
              grouped[colId].push(r);
            });
            setRenders(grouped);
          }
        }

        // Load staff
        const designerIds = [
          ...new Set(
            colData
              .flatMap((c) => [c.main_designer_id, c.collab_designer_id])
              .filter(Boolean) as string[]
          ),
        ];
        if (designerIds.length > 0) {
          const { data: staffData } = await supabase
            .from("staff")
            .select("id, name")
            .in("id", designerIds) as { data: StaffMember[] | null };
          if (staffData) {
            const map: Record<string, string> = {};
            staffData.forEach((s) => {
              map[s.id] = s.name || "未知";
            });
            setStaff(map);
          }
        }

        // Load projects
        const projectIds = [
          ...new Set(colData.map((c) => c.r_project_id).filter(Boolean) as string[]),
        ];
        if (projectIds.length > 0) {
          const { data: projData } = await supabase
            .from("bwa_projects")
            .select("id, project_name, project_code")
            .in("id", projectIds) as { data: ProjectInfo[] | null };
          if (projData) {
            const map: Record<string, ProjectInfo> = {};
            projData.forEach((p) => {
              map[p.id] = p;
            });
            setProjects(map);
          }
        }

        // Load pitchings
        const pitchingIds = [
          ...new Set(colData.map((c) => c.r_pitching_id).filter(Boolean) as string[]),
        ];
        if (pitchingIds.length > 0) {
          const { data: pitchData } = await supabase
            .from("bwa_pitchings")
            .select("id, description, pitching_code")
            .in("id", pitchingIds) as { data: PitchingInfo[] | null };
          if (pitchData) {
            const map: Record<string, PitchingInfo> = {};
            pitchData.forEach((p) => {
              map[p.id] = p;
            });
            setPitchings(map);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load 3D gallery data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Derived Data ----------

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    collections.forEach((c) => {
      parseTags(c.tags).forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [collections]);

  const allDesigners = useMemo(() => {
    const designers: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    collections.forEach((c) => {
      if (c.main_designer_id && !seen.has(c.main_designer_id)) {
        seen.add(c.main_designer_id);
        designers.push({
          id: c.main_designer_id,
          name: staff[c.main_designer_id] || "未知",
        });
      }
    });
    return designers.sort((a, b) => a.name.localeCompare(b.name));
  }, [collections, staff]);

  // Flatten all renders with collection info for gallery display
  const galleryItems = useMemo(() => {
    // First filter collections
    let filtered = collections;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const name = (c.display_name || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        const tags = (c.tags || "").toLowerCase();
        const designer = c.main_designer_id ? (staff[c.main_designer_id] || "").toLowerCase() : "";
        const projectName = c.r_project_id ? (projects[c.r_project_id]?.project_name || "").toLowerCase() : "";
        const pitchingName = c.r_pitching_id ? (pitchings[c.r_pitching_id]?.description || pitchings[c.r_pitching_id]?.pitching_code || "").toLowerCase() : "";
        return name.includes(q) || desc.includes(q) || tags.includes(q) || designer.includes(q) || projectName.includes(q) || pitchingName.includes(q);
      });
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((c) => selectedStatuses.includes(c.o_3d_status || ""));
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) => {
        const cTags = parseTags(c.tags);
        return selectedTags.some((t) => cTags.includes(t));
      });
    }

    if (selectedDesigner) {
      filtered = filtered.filter((c) => c.main_designer_id === selectedDesigner);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter((c) => {
        if (sourceFilter === "project") return !!c.r_project_id;
        if (sourceFilter === "pitching") return !!c.r_pitching_id;
        return true;
      });
    }

    // Build flat gallery items - each render image as a card
    const items: {
      render: ThreeDRender;
      collection: ThreeDCollection;
      totalInCollection: number;
      indexInCollection: number;
    }[] = [];

    filtered.forEach((col) => {
      const colRenders = renders[col.id] || [];
      colRenders.forEach((render, idx) => {
        if (render.image) {
          items.push({
            render,
            collection: col,
            totalInCollection: colRenders.length,
            indexInCollection: idx,
          });
        }
      });
    });

    return items;
  }, [collections, renders, searchQuery, selectedStatuses, selectedTags, selectedDesigner, sourceFilter, staff, projects, pitchings]);

  // Collection items for "collections" view — one entry per collection with first render as thumbnail
  const collectionItems = useMemo(() => {
    // Filter collections using same logic
    let filtered = collections;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const name = (c.display_name || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        const tags = (c.tags || "").toLowerCase();
        const designer = c.main_designer_id ? (staff[c.main_designer_id] || "").toLowerCase() : "";
        const projectName = c.r_project_id ? (projects[c.r_project_id]?.project_name || "").toLowerCase() : "";
        const pitchingName = c.r_pitching_id ? (pitchings[c.r_pitching_id]?.description || pitchings[c.r_pitching_id]?.pitching_code || "").toLowerCase() : "";
        return name.includes(q) || desc.includes(q) || tags.includes(q) || designer.includes(q) || projectName.includes(q) || pitchingName.includes(q);
      });
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((c) => selectedStatuses.includes(c.o_3d_status || ""));
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) => {
        const cTags = parseTags(c.tags);
        return selectedTags.some((t) => cTags.includes(t));
      });
    }

    if (selectedDesigner) {
      filtered = filtered.filter((c) => c.main_designer_id === selectedDesigner);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter((c) => {
        if (sourceFilter === "project") return !!c.r_project_id;
        if (sourceFilter === "pitching") return !!c.r_pitching_id;
        return true;
      });
    }

    return filtered.map((col) => {
      const colRenders = renders[col.id] || [];
      const firstRender = colRenders.find((r) => r.image) || null;
      return {
        collection: col,
        thumbnailRender: firstRender,
        renderCount: colRenders.filter((r) => r.image).length,
      };
    }).filter((item) => item.thumbnailRender !== null);
  }, [collections, renders, searchQuery, selectedStatuses, selectedTags, selectedDesigner, sourceFilter, staff, projects, pitchings]);

  // Stats
  const totalImages = useMemo(() => {
    return Object.values(renders).flat().filter((r) => r.image).length;
  }, [renders]);

  // ── Work-report outcomes grouped by project ──
  // Each group sums man-hours, counts distinct report days for the per-day
  // average, and collects every distinct AI tool used across its tasks.
  const outcomeGroups = useMemo<OutcomeGroup[]>(() => {
    // Per-task helpers (resolved-context lookups).
    const stageOf = (t: ManHourTaskRow) => t.deliverables?.stage || null;
    const staffNameOf = (t: ManHourTaskRow) =>
      t.man_hour_date_id ? (manHourStaff[t.man_hour_date_id] || null) : null;
    const industryOf = (t: ManHourTaskRow) =>
      t.project_id ? (outcomeIndustryTag[t.project_id] || null) : null;
    const isRenderTask = (t: ManHourTaskRow) =>
      !!(t.task_bubble_id && outcomeTaskTypeInfo[t.task_bubble_id]?.isRender);

    // ── Task-level filters (apply BEFORE grouping) ──
    const q = searchQuery.trim().toLowerCase();
    const filteredTasks = manHourTasks.filter((t) => {
      // 只顯示效果圖 toggle
      if (onlyRender && !isRenderTask(t)) return false;
      // 狀態 → deliverables.stage
      if (outcomeStages.length > 0) {
        const s = stageOf(t);
        if (!s || !outcomeStages.includes(s)) return false;
      }
      // 標籤 → customer industry tag
      if (outcomeIndustryFilter.length > 0) {
        const ind = industryOf(t);
        if (!ind || !outcomeIndustryFilter.includes(ind)) return false;
      }
      // 設計師 → reporting staff
      if (outcomeStaffFilter) {
        if (staffNameOf(t) !== outcomeStaffFilter) return false;
      }
      // shared search → project name / staff / industry / description
      if (q) {
        const hay = [
          t.project_name,
          staffNameOf(t),
          industryOf(t),
          t.task_description,
          t.task_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const groups = new Map<string, {
      projectId: string | null;
      projectName: string;
      industryTag: string | null;
      images: string[];
      imageItems: OutcomeImageItem[];
      totalHours: number;
      days: Set<string>;
      taskCount: number;
      staff: Set<string>;
      aiTools: Set<string>;
      latestDate: string | null;
    }>();

    for (const t of filteredTasks) {
      const key = t.project_id || `__noproj__${t.project_name || "未指定項目"}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          projectId: t.project_id,
          projectName: t.project_name || "未指定項目",
          industryTag: industryOf(t),
          images: [],
          imageItems: [],
          totalHours: 0,
          days: new Set(),
          taskCount: 0,
          staff: new Set(),
          aiTools: new Set(),
          latestDate: null,
        };
        groups.set(key, g);
      }
      const staffName = staffNameOf(t);
      const reportDate = t.man_hour_date_id ? (manHourDates[t.man_hour_date_id] || null) : null;
      const taskImages = (t.images || []).filter(Boolean) as string[];
      taskImages.forEach((img) => {
        g!.images.push(img);
        g!.imageItems.push({
          url: img,
          reportDate,
          taskDescription: t.task_description || t.task_name || null,
          workHour: t.work_hour != null ? Number(t.work_hour) : null,
          staffName,
          taskImageCount: taskImages.length,
        });
      });
      g.totalHours += Number(t.work_hour) || 0;
      g.taskCount += 1;
      if (staffName) g.staff.add(staffName);
      // Track the most recent related report date for this group.
      if (reportDate && (!g.latestDate || reportDate > g.latestDate)) {
        g.latestDate = reportDate;
      }
      // A "day" = the linked report date if present, else the task's own date.
      const dayKey = reportDate || (t.created_at ? t.created_at.split("T")[0] : null);
      if (dayKey) g.days.add(dayKey.split("T")[0]);
      // Collect AI tool names across all type-code buckets (skip `*_other` strings).
      const ai = t.ai_tools;
      if (ai) {
        for (const [key, value] of Object.entries(ai)) {
          if (key.endsWith("_other") || !Array.isArray(value)) continue;
          value.forEach((tool) => {
            if (typeof tool === "string" && tool) g!.aiTools.add(tool);
          });
        }
      }
    }

    const result: OutcomeGroup[] = Array.from(groups.entries()).map(([key, g]) => {
      const dayCount = g.days.size || 1;
      const isPitching = !!g.projectId && outcomePitchingIds.has(g.projectId);
      const detailHref = g.projectId
        ? isPitching
          ? `/proposals/${g.projectId}`
          : `/projects/bwa/${g.projectId}`
        : null;
      return {
        key,
        projectId: g.projectId,
        projectName: g.projectName,
        isPitching,
        detailHref,
        images: g.images,
        imageItems: g.imageItems,
        totalHours: g.totalHours,
        dayCount,
        avgPerDay: g.totalHours / dayCount,
        taskCount: g.taskCount,
        staffNames: Array.from(g.staff).sort(),
        aiTools: Array.from(g.aiTools).sort(),
        latestReportDate: g.latestDate,
        industryTag: g.industryTag,
      };
    });

    // Most recent report date first (groups without a date sink to the bottom).
    return result.sort((a, b) => {
      const ad = a.latestReportDate || "";
      const bd = b.latestReportDate || "";
      if (ad !== bd) return bd.localeCompare(ad);
      return b.images.length - a.images.length;
    });
  }, [
    manHourTasks, manHourDates, manHourStaff, outcomePitchingIds,
    outcomeIndustryTag, outcomeTaskTypeInfo, onlyRender, outcomeStages,
    outcomeIndustryFilter, outcomeStaffFilter, searchQuery,
  ]);

  // Total image count shown on the pill — respects the 只顯示效果圖 toggle.
  const totalOutcomeImages = useMemo(
    () => outcomeGroups.reduce((sum, g) => sum + g.images.length, 0),
    [outcomeGroups]
  );

  // ── Filter option lists for the outcome filter bar ──
  const outcomeStageOptions = useMemo(() => {
    const set = new Set<string>();
    manHourTasks.forEach((t) => { const s = t.deliverables?.stage; if (s) set.add(s); });
    return Array.from(set).sort();
  }, [manHourTasks]);

  const outcomeIndustryOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(outcomeIndustryTag).forEach((v) => { if (v) set.add(v); });
    return Array.from(set).sort();
  }, [outcomeIndustryTag]);

  const outcomeStaffOptions = useMemo(() => {
    const set = new Set<string>();
    manHourTasks.forEach((t) => {
      const n = t.man_hour_date_id ? manHourStaff[t.man_hour_date_id] : null;
      if (n) set.add(n);
    });
    return Array.from(set).sort();
  }, [manHourTasks, manHourStaff]);

  // ---------- Lightbox ----------

  const openLightbox = useCallback(
    (collectionId: string, startIndex: number) => {
      const colRenders = renders[collectionId] || [];
      const col = collections.find((c) => c.id === collectionId);
      const images = colRenders
        .filter((r) => r.image)
        .map((r) => ({
          url: resolveImageUrl(r.image)!,
          title: col?.display_name || "未命名合集",
        }));
      setLightboxImages(images);
      setLightboxIndex(startIndex);
      setLightboxOpen(true);
    },
    [renders, collections]
  );

  // Open the lightbox from outcome image items (carries per-task context).
  const openOutcomeLightbox = useCallback(
    (items: OutcomeImageItem[], title: string, startIndex: number) => {
      const images = items
        .map((it) => {
          const url = resolveImageUrl(it.url);
          if (!url) return null;
          return {
            url,
            title,
            reportDate: it.reportDate,
            taskDescription: it.taskDescription,
            workHour: it.workHour,
            staffName: it.staffName,
            taskImageCount: it.taskImageCount,
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
      setLightboxImages(images);
      setLightboxIndex(startIndex);
      setLightboxOpen(true);
    },
    []
  );

  // ---------- Download ----------

  async function downloadImage(url: string, filename: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  // ---------- Clear Filters ----------

  const hasFilters = searchQuery || selectedStatuses.length > 0 || selectedTags.length > 0 || selectedDesigner || sourceFilter !== "all";

  function clearFilters() {
    setSearchQuery("");
    setSelectedStatuses([]);
    setSelectedTags([]);
    setSelectedDesigner(null);
    setSourceFilter("all");
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bw-blue/20 to-bw-violet/20 flex items-center justify-center">
            <Box className="w-8 h-8 text-bw-blue animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">載入 3D 設計靈感庫...</p>
          <p className="text-xs text-gray-400 mt-1">正在讀取合集與渲染圖片</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ========= HEADER ========= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-bw-amber" />
              3D 設計靈感庫
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              瀏覽所有項目及提案的 3D 渲染圖片，尋找設計靈感
            </p>
          </div>

          {/* View mode toggle — pill-style buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("collections")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 border text-sm font-medium transition-all duration-200 ${
                viewMode === "collections"
                  ? "bg-bw-blue text-white border-bw-blue shadow-md shadow-blue-200/50"
                  : "bg-white text-gray-500 border-gray-200 shadow-sm hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Layers className={`w-4 h-4 ${viewMode === "collections" ? "text-white" : "text-bw-blue"}`} />
              <span className="font-semibold">{collections.length}</span>
              <span>合集</span>
            </button>
            <button
              onClick={() => setViewMode("images")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 border text-sm font-medium transition-all duration-200 ${
                viewMode === "images"
                  ? "bg-bw-blue text-white border-bw-blue shadow-md shadow-blue-200/50"
                  : "bg-white text-gray-500 border-gray-200 shadow-sm hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <ImageIcon className={`w-4 h-4 ${viewMode === "images" ? "text-white" : "text-bw-violet"}`} />
              <span className="font-semibold">{totalImages}</span>
              <span>圖片</span>
            </button>
            <button
              onClick={() => setViewMode("outcomes")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 border text-sm font-medium transition-all duration-200 ${
                viewMode === "outcomes"
                  ? "bg-bw-blue text-white border-bw-blue shadow-md shadow-blue-200/50"
                  : "bg-white text-gray-500 border-gray-200 shadow-sm hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <FileBarChart className={`w-4 h-4 ${viewMode === "outcomes" ? "text-white" : "text-bw-teal"}`} />
              <span className="font-semibold">{totalOutcomeImages}</span>
              <span>工作匯報成果</span>
            </button>
          </div>
        </div>

        {/* ========= SEARCH & FILTERS ========= */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={viewMode === "outcomes" ? "搜尋項目名、員工、產業、工作描述..." : "搜尋合集名稱、標籤、設計師、項目名..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50/80 border-gray-200 focus:bg-white h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>

            {viewMode === "outcomes" ? (
              <OutcomeFilters
                onlyRender={onlyRender}
                setOnlyRender={setOnlyRender}
                stageOptions={outcomeStageOptions}
                selectedStages={outcomeStages}
                setSelectedStages={setOutcomeStages}
                industryOptions={outcomeIndustryOptions}
                selectedIndustries={outcomeIndustryFilter}
                setSelectedIndustries={setOutcomeIndustryFilter}
                staffOptions={outcomeStaffOptions}
                selectedStaff={outcomeStaffFilter}
                setSelectedStaff={setOutcomeStaffFilter}
              />
            ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Source filter */}
              <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200 text-xs">
                {(["all", "project", "pitching"] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => setSourceFilter(val)}
                    className={`px-3 py-1.5 rounded-md transition-all font-medium ${
                      sourceFilter === val
                        ? val === "project"
                          ? "bg-bw-blue text-white shadow-sm"
                          : val === "pitching"
                          ? "bg-bw-amber text-white shadow-sm"
                          : "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {val === "all" ? "全部" : val === "project" ? "項目" : "提案"}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
                    <Filter className="w-3.5 h-3.5" />
                    狀態
                    {selectedStatuses.length > 0 && (
                      <Badge className="ml-1 h-4 w-4 p-0 text-[12px] bg-bw-blue text-white justify-center">
                        {selectedStatuses.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel className="text-xs text-gray-400">篩選狀態</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusOptions.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s.value}
                      checked={selectedStatuses.includes(s.value)}
                      onCheckedChange={(checked) => {
                        setSelectedStatuses((prev) =>
                          checked ? [...prev, s.value] : prev.filter((v) => v !== s.value)
                        );
                      }}
                      className="text-xs"
                    >
                      {s.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tags filter */}
              {allTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
                      <Tag className="w-3.5 h-3.5" />
                      標籤
                      {selectedTags.length > 0 && (
                        <Badge className="ml-1 h-4 w-4 p-0 text-[12px] bg-bw-violet text-white justify-center">
                          {selectedTags.length}
                        </Badge>
                      )}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs text-gray-400">篩選標籤</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allTags.map((t) => (
                      <DropdownMenuCheckboxItem
                        key={t}
                        checked={selectedTags.includes(t)}
                        onCheckedChange={(checked) => {
                          setSelectedTags((prev) =>
                            checked ? [...prev, t] : prev.filter((v) => v !== t)
                          );
                        }}
                        className="text-xs"
                      >
                        {t}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Designer filter */}
              {allDesigners.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
                      <User className="w-3.5 h-3.5" />
                      設計師
                      {selectedDesigner && (
                        <Badge className="ml-1 h-4 px-1 text-[12px] bg-bw-teal text-white">
                          {staff[selectedDesigner]?.slice(0, 3)}
                        </Badge>
                      )}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs text-gray-400">篩選設計師</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedDesigner === null}
                      onCheckedChange={() => setSelectedDesigner(null)}
                      className="text-xs"
                    >
                      全部設計師
                    </DropdownMenuCheckboxItem>
                    {allDesigners.map((d) => (
                      <DropdownMenuCheckboxItem
                        key={d.id}
                        checked={selectedDesigner === d.id}
                        onCheckedChange={() =>
                          setSelectedDesigner(selectedDesigner === d.id ? null : d.id)
                        }
                        className="text-xs"
                      >
                        {d.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Clear filters */}
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                  onClick={clearFilters}
                >
                  <X className="w-3.5 h-3.5" />
                  清除篩選
                </Button>
              )}
            </div>
            )}
          </div>

          {/* Active filter tags (3D-collection views only) */}
          {viewMode !== "outcomes" && hasFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[13px] text-gray-400">篩選條件:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-[13px] gap-1 pr-1">
                  搜尋: {searchQuery}
                  <button onClick={() => setSearchQuery("")} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {sourceFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className={`text-[13px] gap-1 pr-1 ${
                    sourceFilter === "project" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {sourceFilter === "project" ? "項目" : "提案"}
                  <button onClick={() => setSourceFilter("all")} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedStatuses.map((s) => (
                <Badge key={s} variant="secondary" className="text-[13px] gap-1 pr-1">
                  {s}
                  <button
                    onClick={() => setSelectedStatuses((prev) => prev.filter((v) => v !== s))}
                    className="ml-0.5 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {selectedTags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[13px] gap-1 pr-1 bg-violet-50 text-violet-600">
                  <Tag className="w-2.5 h-2.5" />
                  {t}
                  <button
                    onClick={() => setSelectedTags((prev) => prev.filter((v) => v !== t))}
                    className="ml-0.5 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {selectedDesigner && (
                <Badge variant="secondary" className="text-[13px] gap-1 pr-1 bg-teal-50 text-teal-600">
                  <User className="w-2.5 h-2.5" />
                  {staff[selectedDesigner] || "未知"}
                  <button onClick={() => setSelectedDesigner(null)} className="ml-0.5 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              <span className="text-[13px] text-gray-400 ml-2">
                共 {viewMode === "images"
                  ? `${galleryItems.length} 張圖片`
                  : `${collectionItems.length} 個合集`}
              </span>
            </div>
          )}
        </div>

        {/* ========= GALLERY ========= */}
        {viewMode === "images" ? (
          galleryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">沒有找到匹配的 3D 渲染圖</p>
                <p className="text-xs text-gray-400 mt-1">
                  {hasFilters ? "嘗試調整篩選條件" : "目前尚無 3D 渲染合集"}
                </p>
              </div>
              {hasFilters && (
                <Button variant="outline" size="sm" className="text-xs" onClick={clearFilters}>
                  清除所有篩選
                </Button>
              )}
            </div>
          ) : (
            <MasonryGallery
              items={galleryItems}
              staff={staff}
              projects={projects}
              pitchings={pitchings}
              onImageClick={openLightbox}
              onDownload={downloadImage}
            />
          )
        ) : viewMode === "collections" ? (
          collectionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Layers className="w-10 h-10 text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">沒有找到匹配的合集</p>
                <p className="text-xs text-gray-400 mt-1">
                  {hasFilters ? "嘗試調整篩選條件" : "目前尚無 3D 渲染合集"}
                </p>
              </div>
              {hasFilters && (
                <Button variant="outline" size="sm" className="text-xs" onClick={clearFilters}>
                  清除所有篩選
                </Button>
              )}
            </div>
          ) : (
            <CollectionGallery
              items={collectionItems}
              staff={staff}
              projects={projects}
              pitchings={pitchings}
              onImageClick={openLightbox}
              onDownload={downloadImage}
            />
          )
        ) : (
          /* ===== 工作匯報成果 — man-hour tasks with images, grouped by project ===== */
          outcomeGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                <FileBarChart className="w-10 h-10 text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">沒有找到工作匯報成果</p>
                <p className="text-xs text-gray-400 mt-1">
                  {onlyRender
                    ? "嘗試關閉「只顯示效果圖」或調整篩選條件"
                    : searchQuery || outcomeStages.length || outcomeIndustryFilter.length || outcomeStaffFilter
                    ? "嘗試調整篩選條件"
                    : "目前尚無附帶附件的工時記錄"}
                </p>
              </div>
            </div>
          ) : (
            <OutcomeGallery
              groups={outcomeGroups}
              onImageClick={openOutcomeLightbox}
            />
          )
        )}

        <AttachmentLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={lightboxImages}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
        />
      </div>
    </TooltipProvider>
  );
}

// ---------- Masonry Gallery Sub-component ----------

interface GalleryProps {
  items: {
    render: ThreeDRender;
    collection: ThreeDCollection;
    totalInCollection: number;
    indexInCollection: number;
  }[];
  staff: Record<string, string>;
  projects: Record<string, ProjectInfo>;
  pitchings: Record<string, PitchingInfo>;
  onImageClick: (collectionId: string, startIndex: number) => void;
  onDownload: (url: string, filename: string) => void;
}

function MasonryGallery({ items, staff, projects, pitchings, onImageClick, onDownload }: GalleryProps) {
  // Distribute items into columns for masonry effect
  const columnCount = 4;
  const columns: typeof items[] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, i) => {
    columns[i % columnCount].push(item);
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-4">
          {col.map((item) => (
            <GalleryCard
              key={item.render.id}
              item={item}
              staff={staff}
              projects={projects}
              pitchings={pitchings}
              onImageClick={onImageClick}
              onDownload={onDownload}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Outcome Filter Bar (工作匯報成果) ----------
// Reinterprets 狀態 / 標籤 / 設計師 for man-hour tasks: stage (from
// deliverables) / customer industry tag / reporting staff. Plus a
// "只顯示效果圖" toggle (default on).

function OutcomeFilters({
  onlyRender,
  setOnlyRender,
  stageOptions,
  selectedStages,
  setSelectedStages,
  industryOptions,
  selectedIndustries,
  setSelectedIndustries,
  staffOptions,
  selectedStaff,
  setSelectedStaff,
}: {
  onlyRender: boolean;
  setOnlyRender: (v: boolean) => void;
  stageOptions: string[];
  selectedStages: string[];
  setSelectedStages: React.Dispatch<React.SetStateAction<string[]>>;
  industryOptions: string[];
  selectedIndustries: string[];
  setSelectedIndustries: React.Dispatch<React.SetStateAction<string[]>>;
  staffOptions: string[];
  selectedStaff: string | null;
  setSelectedStaff: (v: string | null) => void;
}) {
  const hasFilters =
    selectedStages.length > 0 || selectedIndustries.length > 0 || !!selectedStaff;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 只顯示效果圖 toggle */}
      <button
        onClick={() => setOnlyRender(!onlyRender)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all ${
          onlyRender
            ? "bg-bw-teal text-white border-bw-teal shadow-sm"
            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
        }`}
        title="只顯示效果圖相關的工時記錄"
      >
        <Sparkles className="w-3.5 h-3.5" />
        只顯示效果圖
      </button>

      {/* 狀態 → deliverables.stage */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
            <Filter className="w-3.5 h-3.5" />
            狀態
            {selectedStages.length > 0 && (
              <Badge className="ml-1 h-4 w-4 p-0 text-[12px] bg-bw-blue text-white justify-center">
                {selectedStages.length}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 max-h-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-gray-400">階段 Stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {stageOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-gray-400">無階段資料</div>
          ) : (
            stageOptions.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={selectedStages.includes(s)}
                onCheckedChange={(checked) =>
                  setSelectedStages((prev) =>
                    checked ? [...prev, s] : prev.filter((v) => v !== s)
                  )
                }
                className="text-xs"
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 標籤 → customer industry tag */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
            <Tag className="w-3.5 h-3.5" />
            標籤
            {selectedIndustries.length > 0 && (
              <Badge className="ml-1 h-4 w-4 p-0 text-[12px] bg-bw-amber text-white justify-center">
                {selectedIndustries.length}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-gray-400">客戶產業 Industry</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {industryOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-gray-400">無產業資料</div>
          ) : (
            industryOptions.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={selectedIndustries.includes(t)}
                onCheckedChange={(checked) =>
                  setSelectedIndustries((prev) =>
                    checked ? [...prev, t] : prev.filter((v) => v !== t)
                  )
                }
                className="text-xs"
              >
                {t}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 設計師 → reporting staff */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-gray-200">
            <User className="w-3.5 h-3.5" />
            設計師
            {selectedStaff && (
              <Badge className="ml-1 h-4 px-1 text-[12px] bg-bw-teal text-white">
                {selectedStaff.slice(0, 3)}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-gray-400">匯報員工 Staff</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={selectedStaff === null}
            onCheckedChange={() => setSelectedStaff(null)}
            className="text-xs"
          >
            全部員工
          </DropdownMenuCheckboxItem>
          {staffOptions.map((n) => (
            <DropdownMenuCheckboxItem
              key={n}
              checked={selectedStaff === n}
              onCheckedChange={() => setSelectedStaff(selectedStaff === n ? null : n)}
              className="text-xs"
            >
              {n}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
          onClick={() => {
            setSelectedStages([]);
            setSelectedIndustries([]);
            setSelectedStaff(null);
          }}
        >
          <X className="w-3.5 h-3.5" />
          清除篩選
        </Button>
      )}
    </div>
  );
}

// ---------- Outcome Gallery Sub-component (工作匯報成果) ----------

function OutcomeGallery({
  groups,
  onImageClick,
}: {
  groups: OutcomeGroup[];
  onImageClick: (items: OutcomeImageItem[], title: string, startIndex: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {groups.map((g) => (
        <OutcomeCard key={g.key} group={g} onImageClick={onImageClick} />
      ))}
    </div>
  );
}

function OutcomeCard({
  group,
  onImageClick,
}: {
  group: OutcomeGroup;
  onImageClick: (items: OutcomeImageItem[], title: string, startIndex: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const coverUrl = group.images.find(isImageAttachmentUrl) ?? group.images[0] ?? "";

  const detailHref = group.detailHref;
  const detailLabel = group.isPitching ? "查看提案" : "查看項目";

  // Split the leading project-code token (e.g. "QPY202606009 聯合醫院…") into a
  // subtitle, leaving the readable name as the title. A code is the first
  // whitespace-delimited token containing digits.
  const { projectTitle, projectCode } = (() => {
    const full = group.projectName.trim();
    const sp = full.indexOf(" ");
    if (sp > 0) {
      const first = full.slice(0, sp);
      if (/\d/.test(first)) {
        return { projectTitle: full.slice(sp + 1).trim() || first, projectCode: first };
      }
    }
    return { projectTitle: full, projectCode: null as string | null };
  })();

  // Round hours to at most one decimal.
  const fmtH = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");
  // "dd/m" — day/month of the report date.
  const fmtDayMonth = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div
      className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onImageClick(group.imageItems, group.projectName, 0)}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        {coverUrl ? (
          <AttachmentThumbnail
            url={coverUrl}
            alt={group.projectName}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            previewWidth={480}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-200" />
          </div>
        )}

        {/* Hover overlay → open project */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {detailHref && (
            <div className="absolute top-3 right-14">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(detailHref, "_blank", "noopener");
                }}
                className="h-7 px-2.5 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center gap-1 text-white transition-all text-[12px] font-medium"
                title={detailLabel}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {detailLabel}
              </button>
            </div>
          )}
        </div>

        {/* Attachment count badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-black/50 text-white backdrop-blur-sm flex items-center gap-1">
            <FileBarChart className="w-3 h-3" />
            {group.images.length}
          </span>
        </div>
      </div>

      {/* Info bar */}
      <div className="px-3 py-2.5 border-t border-gray-50 space-y-2">
        <div className="flex items-start gap-2">
          {/* Title (project name) + subtitle (project code) — max 2/3 width */}
          <div className="min-w-0 basis-2/3 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate" title={group.projectName}>
              {projectTitle}
            </p>
            {projectCode && (
              <p className="text-[11px] text-gray-400 truncate" title={projectCode}>
                {projectCode}
              </p>
            )}
          </div>
          {group.industryTag && (
            <span
              className="shrink-0 max-w-[33%] truncate text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100"
              title={group.industryTag}
            >
              {group.industryTag}
            </span>
          )}
        </div>

        {/* Most recent related report date */}
        {group.latestReportDate && (
          <div className="flex items-center gap-1 text-[12px] text-bw-blue font-medium">
            <Calendar className="w-3 h-3 shrink-0" />
            最近匯報: {fmtDayMonth(group.latestReportDate)}
          </div>
        )}

        {/* Reporting staff */}
        {group.staffNames.length > 0 && (
          <div className="flex items-center gap-1 text-[12px] text-gray-500">
            <User className="w-3 h-3 shrink-0 text-gray-400" />
            <span className="truncate" title={group.staffNames.join("、")}>
              {group.staffNames.join("、")}
            </span>
          </div>
        )}

        {/* Man-hour stats */}
        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1 text-bw-teal font-semibold">
            <Clock className="w-3 h-3" />
            {fmtH(group.totalHours)}h
          </span>
          <span className="text-gray-400">
            平均 {fmtH(group.avgPerDay)}h/日
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400">{group.dayCount} 日</span>
        </div>

        {/* AI tools used */}
        {group.aiTools.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            <Cpu className="w-3 h-3 text-bw-violet shrink-0" />
            {group.aiTools.slice(0, 4).map((tool, idx) => (
              <span
                key={idx}
                className="text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600"
              >
                {tool}
              </span>
            ))}
            {group.aiTools.length > 4 && (
              <span className="text-[11px] text-gray-400">+{group.aiTools.length - 4}</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> 未使用 AI 工具
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- Collection Gallery Sub-component ----------

interface CollectionGalleryProps {
  items: {
    collection: ThreeDCollection;
    thumbnailRender: ThreeDRender | null;
    renderCount: number;
  }[];
  staff: Record<string, string>;
  projects: Record<string, ProjectInfo>;
  pitchings: Record<string, PitchingInfo>;
  onImageClick: (collectionId: string, startIndex: number) => void;
  onDownload: (url: string, filename: string) => void;
}

function CollectionGallery({ items, staff, projects, pitchings, onImageClick, onDownload }: CollectionGalleryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item) => (
        <CollectionCard
          key={item.collection.id}
          item={item}
          staff={staff}
          projects={projects}
          pitchings={pitchings}
          onImageClick={onImageClick}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

// ---------- Collection Card ----------

function CollectionCard({
  item,
  staff,
  projects,
  pitchings,
  onImageClick,
}: {
  item: {
    collection: ThreeDCollection;
    thumbnailRender: ThreeDRender | null;
    renderCount: number;
  };
  staff: Record<string, string>;
  projects: Record<string, ProjectInfo>;
  pitchings: Record<string, PitchingInfo>;
  onImageClick: (collectionId: string, startIndex: number) => void;
  onDownload: (url: string, filename: string) => void;
}) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const imageUrl = item.thumbnailRender ? resolveImageUrl(item.thumbnailRender.image) : null;
  const col = item.collection;

  const sourceLabel = col.r_project_id
    ? projects[col.r_project_id]?.project_name || projects[col.r_project_id]?.project_code || "項目"
    : col.r_pitching_id
    ? pitchings[col.r_pitching_id]?.pitching_code || pitchings[col.r_pitching_id]?.description || "提案"
    : null;

  const isProject = !!col.r_project_id;

  // Navigation: project detail first, fallback to pitching detail
  const detailHref = col.r_project_id
    ? `/projects/bwa/${col.r_project_id}`
    : col.r_pitching_id
    ? `/proposals/${col.r_pitching_id}`
    : null;
  const detailLabel = col.r_project_id ? "查看項目" : col.r_pitching_id ? "查看提案" : null;

  return (
    <div
      className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onImageClick(col.id, 0)}
    >
      {/* Thumbnail Image */}
      <div className="relative w-full aspect-[4/3]">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-200" />
          </div>
        )}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={col.display_name || "3D Collection"}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        )}

        {/* Hover Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              {sourceLabel && (
                <span
                  className={`text-[12px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm ${
                    isProject
                      ? "bg-blue-500/80 text-white"
                      : "bg-amber-500/80 text-white"
                  }`}
                >
                  {isProject ? "項目" : "提案"}
                </span>
              )}
              {col.o_3d_status && col.o_3d_status !== "草稿" && (
                <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {col.o_3d_status}
                </span>
              )}
            </div>
          </div>

          {/* Go to project/pitching detail button */}
          {detailHref && (
            <div className="absolute top-3 right-14 flex flex-col gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(detailHref, "_blank", "noopener");
                }}
                className="h-7 px-2.5 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center gap-1 text-white transition-all text-[12px] font-medium"
                title={detailLabel || "查看詳情"}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {detailLabel}
              </button>
            </div>
          )}

          {/* Bottom info on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {col.main_designer_id && (
              <span className="text-white/70 text-[13px] flex items-center gap-1">
                <User className="w-3 h-3" />
                {staff[col.main_designer_id] || "設計師"}
              </span>
            )}
            {sourceLabel && (
              <p className="text-white/50 text-[12px] truncate mt-0.5">
                {sourceLabel}
              </p>
            )}
          </div>
        </div>

        {/* Image count badge — always visible */}
        <div className="absolute top-3 right-3">
          <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-black/50 text-white backdrop-blur-sm flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {item.renderCount}
          </span>
        </div>
      </div>

      {/* Collection Info Bar */}
      <div className="px-3 py-2.5 border-t border-gray-50">
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-medium text-gray-800 truncate flex-1">
            {col.display_name || "未命名合集"}
          </p>
          {detailHref && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(detailHref, "_blank", "noopener");
                  }}
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    isProject
                      ? "text-bw-blue hover:bg-blue-50"
                      : "text-bw-amber hover:bg-amber-50"
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {detailLabel}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {col.version_number && (
            <span className="text-[12px] text-gray-400">V{col.version_number}</span>
          )}
          {col.created_date && (
            <span className="text-[12px] text-gray-400 flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {formatDate(col.created_date)}
            </span>
          )}
        </div>
        {/* Tags */}
        {col.tags && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {parseTags(col.tags).slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
              >
                {tag}
              </span>
            ))}
            {parseTags(col.tags).length > 3 && (
              <span className="text-[11px] text-gray-400">
                +{parseTags(col.tags).length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Gallery Card ----------

function GalleryCard({
  item,
  staff,
  projects,
  pitchings,
  onImageClick,
  onDownload,
}: {
  item: {
    render: ThreeDRender;
    collection: ThreeDCollection;
    totalInCollection: number;
    indexInCollection: number;
  };
  staff: Record<string, string>;
  projects: Record<string, ProjectInfo>;
  pitchings: Record<string, PitchingInfo>;
  onImageClick: (collectionId: string, startIndex: number) => void;
  onDownload: (url: string, filename: string) => void;
}) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const imageUrl = resolveImageUrl(item.render.image);
  const col = item.collection;

  const sourceLabel = col.r_project_id
    ? projects[col.r_project_id]?.project_name || projects[col.r_project_id]?.project_code || "項目"
    : col.r_pitching_id
    ? pitchings[col.r_pitching_id]?.pitching_code || pitchings[col.r_pitching_id]?.description || "提案"
    : null;

  const isProject = !!col.r_project_id;

  // Navigation: project detail first, fallback to pitching detail
  const detailHref = col.r_project_id
    ? `/projects/bwa/${col.r_project_id}`
    : col.r_pitching_id
    ? `/proposals/${col.r_pitching_id}`
    : null;
  const detailLabel = col.r_project_id ? "查看項目" : col.r_pitching_id ? "查看提案" : null;

  return (
    <div
      className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onImageClick(col.id, item.indexInCollection)}
    >
      {/* Image */}
      <div className="relative w-full">
        {!imageLoaded && (
          <div className="w-full aspect-[4/3] bg-gray-100 animate-pulse flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-200" />
          </div>
        )}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={col.display_name || "3D Render"}
            className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        )}

        {/* Hover Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              {sourceLabel && (
                <span
                  className={`text-[12px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm ${
                    isProject
                      ? "bg-blue-500/80 text-white"
                      : "bg-amber-500/80 text-white"
                  }`}
                >
                  {isProject ? "項目" : "提案"}
                </span>
              )}
              {col.o_3d_status && col.o_3d_status !== "草稿" && (
                <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {col.o_3d_status}
                </span>
              )}
            </div>
            {item.totalInCollection > 1 && (
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {item.indexInCollection + 1}/{item.totalInCollection}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5" style={{ top: sourceLabel ? "36px" : "12px" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onImageClick(col.id, item.indexInCollection);
              }}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-all"
              title="預覽"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (imageUrl) {
                  onDownload(imageUrl, `${col.display_name || "render"}_${item.indexInCollection + 1}.jpg`);
                }
              }}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-all"
              title="下載"
            >
              <Download className="w-4 h-4" />
            </button>
            {detailHref && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(detailHref, "_blank", "noopener");
                }}
                className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center text-white transition-all ${
                  isProject
                    ? "bg-blue-500/40 hover:bg-blue-500/70"
                    : "bg-amber-500/40 hover:bg-amber-500/70"
                }`}
                title={detailLabel || "查看詳情"}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-sm font-medium truncate">
              {col.display_name || "未命名合集"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {col.main_designer_id && (
                <span className="text-white/70 text-[13px] flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {staff[col.main_designer_id] || "設計師"}
                </span>
              )}
              {col.version_number && (
                <span className="text-white/50 text-[12px]">V{col.version_number}</span>
              )}
              {sourceLabel && detailHref ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(detailHref, "_blank", "noopener");
                  }}
                  className="text-white/70 text-[12px] truncate max-w-[120px] hover:text-white hover:underline flex items-center gap-0.5 transition-colors"
                >
                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                  {sourceLabel}
                </button>
              ) : sourceLabel ? (
                <span className="text-white/50 text-[12px] truncate max-w-[120px]">
                  {sourceLabel}
                </span>
              ) : null}
            </div>
            {/* Tags */}
            {col.tags && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {parseTags(col.tags).slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/15 text-white/80 backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
                {parseTags(col.tags).length > 3 && (
                  <span className="text-[11px] text-white/50">
                    +{parseTags(col.tags).length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
