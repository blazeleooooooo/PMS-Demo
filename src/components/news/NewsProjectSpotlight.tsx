"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  Search,
  Loader2,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  fetchNewsSpotlightProjects,
  fetchNewsSpotlightProjectTypes,
  type NewsSpotlightProjectRow,
  type NewsSpotlightProjectType,
  type ProjectStaffContext,
} from "@/lib/data-service";
import { useAuth } from "@/hooks/use-auth";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { formatHongKongDate } from "@/lib/date-utils";

type RenderFilter = "with_3d" | "all";

export default function NewsProjectSpotlight() {
  const router = useRouter();
  const { staff, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<NewsSpotlightProjectRow[]>([]);
  const [projectTypes, setProjectTypes] = useState<NewsSpotlightProjectType[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTypeId, setActiveTypeId] = useState<string>("__all__");
  const [renderFilter, setRenderFilter] = useState<RenderFilter>("with_3d");

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const staffContext: ProjectStaffContext | undefined = staff?.id
        ? {
            staffId: staff.id,
            role: staff.role || null,
            teamTypeId: staff.n_team_type_id || null,
          }
        : undefined;
      const [rows, types] = await Promise.all([
        fetchNewsSpotlightProjects(staffContext),
        fetchNewsSpotlightProjectTypes(),
      ]);
      if (!cancelled) {
        setProjects(rows);
        setProjectTypes(types);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, staff?.id, staff?.role, staff?.n_team_type_id]);

  const filtered = useMemo(() => {
    let rows = projects;

    if (activeTypeId !== "__all__") {
      rows = rows.filter((p) => p.projectTypeIds.includes(activeTypeId));
    }

    if (renderFilter === "with_3d") {
      rows = rows.filter((p) => p.images.length > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          p.districtName.toLowerCase().includes(q) ||
          p.buildingName.toLowerCase().includes(q) ||
          p.mainPmName.toLowerCase().includes(q) ||
          p.mainDesignerName.toLowerCase().includes(q) ||
          p.sizeLabel.toLowerCase().includes(q),
      );
    }

    return rows;
  }, [projects, activeTypeId, renderFilter, search]);

  const hasActiveFilters =
    search.trim() || activeTypeId !== "__all__" || renderFilter !== "all";

  return (
    <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">
      {/* ─── TYPE FILTER PILLS + 3D FILTER ─────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTypeId("__all__")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTypeId === "__all__"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          全部
        </button>
        {projectTypes.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setActiveTypeId(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTypeId === t.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => setRenderFilter("with_3d")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              renderFilter === "with_3d"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            有 3D
          </button>
          <button
            type="button"
            onClick={() => setRenderFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              renderFilter === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            全部項目
          </button>
        </div>
      </div>

      {/* ─── SEARCH BAR ──────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋項目、地區、大廈、項目經理、設計師..."
          className="w-full bg-slate-600 text-white placeholder:text-gray-300 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* ─── PROJECT GRID ────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500 text-sm">載入項目...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
          <Building2 className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {hasActiveFilters ? "沒有符合的項目" : "暫無符合條件的項目"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <SpotlightCard
              key={p.id}
              project={p}
              onOpen={(e) => handleNavClick(`/projects/bwa/${p.id}`, e, (href) => router.push(href))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpotlightCard({
  project,
  onOpen,
}: {
  project: NewsSpotlightProjectRow;
  onOpen: (e: React.MouseEvent) => void;
}) {
  const images = project.images;
  const [imageIdx, setImageIdx] = useState(0);
  const safeIdx = images.length > 0 ? imageIdx % images.length : 0;
  const current = images.length > 0 ? images[safeIdx] : null;

  const cycle = (dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length === 0) return;
    setImageIdx((prev) => (prev + dir + images.length) % images.length);
  };

  const locationParts = [
    project.sizeLabel,
    project.districtName,
    project.buildingName,
  ].filter(Boolean);

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col group"
    >
      {/* 3D image on top */}
      <div className="relative h-48 bg-slate-800 overflow-hidden">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image}
            alt={project.projectName || "3D 效果圖"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-700 text-slate-400 gap-2">
            <ImageOff className="w-10 h-10" />
            <span className="text-xs">無 3D 效果圖</span>
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一張"
              onClick={(e) => cycle(-1, e)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="下一張"
              onClick={(e) => cycle(1, e)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px]">
              {safeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Content below */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors min-w-0 flex-1">
            {project.projectName || "(無標題)"}
          </h3>
          <AsanaLinkButton href={project.asanaLink} className="shrink-0 -mt-0.5" />
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
          {locationParts.length > 0 ? locationParts.join(" · ") : "—"}
        </p>

        <p className="text-xs text-gray-500 line-clamp-2">
          項目經理 {project.mainPmName || "—"}
          <span className="mx-1.5 text-gray-300">·</span>
          主設計師 {project.mainDesignerName || "—"}
        </p>

        <div className="mt-auto pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p>
            工程日期 {formatHongKongDate(project.startDate)}
            <span className="mx-1 text-gray-300">·</span>
            交場日 {formatHongKongDate(project.handoverDate)}
            {project.totalDays != null && (
              <span className="text-gray-500">（{project.totalDays}日）</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
