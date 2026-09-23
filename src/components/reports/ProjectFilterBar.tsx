"use client";

// ─── REUSABLE PROJECT FILTER BAR ──────────────────────────────
// Aligned chrome for /business-reports, /design-reports, /team-reports:
// search + 項目BU / 服務類型 / 項目類型 / 項目規模 / 財政年度 / 項目狀態
// on one row (no 高級篩選, no embedded PM — staff attribution is StaffFilterBar).
// Works on any row satisfying ProjectFilterFields (projects or enriched pitches).

import React, { useMemo } from "react";
import { Search, FolderKanban, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BWA_PROJECT_SIZE_FILTER_OPTIONS,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import {
  COLLECTION_STATUS_OPTIONS,
  SITE_STATUS_OPTIONS,
  matchesCollectionStatus,
  matchesSiteStatus,
  type CollectionStatusFilter,
  type ProjectCollectionSiteFields,
  type SiteStatusFilter,
} from "@/lib/project-collection-site-filter";

const PROJECT_SIZE_RANGES = BWA_PROJECT_SIZE_FILTER_OPTIONS;

/** Fields read by applyProjectFilters — projects and enriched pitch rows. */
export interface ProjectFilterFields extends ProjectCollectionSiteFields {
  id: string;
  status: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  project_type_name: string | null;
  financial_year_name: string | null;
  est_income: number | null;
  project_size?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  /** Optional; ignored by filter (staff bar owns attribution). Kept for search. */
  pm_name?: string | null;
  service_type_id?: string | null;
  project_type_id?: string | null;
  n_financial_year_id?: string | null;
}

export interface ProjectFilterState {
  search: string;
  status: string;
  /** @deprecated Staff attribution moved to StaffFilterBar; always treat as "all". */
  pm: string;
  bu: string;
  serviceType: string;
  projectType: string;
  size: string;
  financialYear: string;
  /** 全部收款 / 未完成收款 — income_amount sum vs payment_amount sum. */
  collectionStatus: CollectionStatusFilter;
  /** 工地狀態 from start_date / handover_date. */
  siteStatus: SiteStatusFilter;
}

export const EMPTY_PROJECT_FILTERS: ProjectFilterState = {
  search: "",
  status: "all",
  pm: "all",
  bu: "all",
  serviceType: "all",
  projectType: "all",
  size: "all",
  financialYear: "all",
  collectionStatus: "all",
  siteStatus: "all",
};

export function applyProjectFilters<T extends ProjectFilterFields>(
  projects: T[],
  f: ProjectFilterState,
): T[] {
  let result = projects;
  if (f.status !== "all") result = result.filter((p) => p.status === f.status);
  if (f.bu !== "all") {
    result = result.filter((p) => p.cost_centre_bu_code === f.bu);
  }
  if (f.serviceType !== "all") {
    result = result.filter(
      (p) =>
        p.service_type_id === f.serviceType ||
        p.service_type_name === f.serviceType,
    );
  }
  if (f.projectType !== "all") {
    result = result.filter(
      (p) =>
        p.project_type_id === f.projectType ||
        p.project_type_name === f.projectType,
    );
  }
  if (f.financialYear !== "all") {
    result = result.filter(
      (p) =>
        p.n_financial_year_id === f.financialYear ||
        p.financial_year_name === f.financialYear,
    );
  }
  if (f.size !== "all") {
    result = result.filter(
      (p) => resolveBwaProjectSize(p.project_size, p.est_income) === f.size,
    );
  }
  if (f.collectionStatus && f.collectionStatus !== "all") {
    result = result.filter((p) =>
      matchesCollectionStatus(
        p.income_amount_sum,
        p.payment_amount_sum,
        f.collectionStatus,
      ),
    );
  }
  if (f.siteStatus && f.siteStatus !== "all") {
    result = result.filter((p) =>
      matchesSiteStatus(p.start_date, p.handover_date, f.siteStatus),
    );
  }
  if (f.search.trim()) {
    const q = f.search.toLowerCase();
    result = result.filter(
      (p) =>
        (p.project_code && p.project_code.toLowerCase().includes(q)) ||
        (p.project_name && p.project_name.toLowerCase().includes(q)) ||
        (p.pm_name && p.pm_name.toLowerCase().includes(q)) ||
        (p.service_type_name && p.service_type_name.toLowerCase().includes(q)) ||
        (p.project_type_name && p.project_type_name.toLowerCase().includes(q)) ||
        (p.cost_centre_bu_code &&
          p.cost_centre_bu_code.toLowerCase().includes(q)),
    );
  }
  return result;
}

interface ProjectFilterBarProps {
  projects: ProjectFilterFields[];
  value: ProjectFilterState;
  onChange: (next: ProjectFilterState) => void;
  /** @deprecated PM select removed; kept so callers compile. */
  hidePmFilter?: boolean;
  className?: string;
}

export default function ProjectFilterBar({
  projects,
  value,
  onChange,
  className,
}: ProjectFilterBarProps) {
  const set = (patch: Partial<ProjectFilterState>) =>
    onChange({ ...value, ...patch, pm: "all" });

  const options = useMemo(() => {
    const uniq = (xs: (string | null)[]) =>
      Array.from(new Set(xs.filter((x): x is string => !!x)));
    // Prefer id as value when present; fall back to display name.
    const idOrName = (
      id: string | null | undefined,
      name: string | null | undefined,
    ): string | null => id || name || null;
    return {
      bus: uniq(projects.map((p) => p.cost_centre_bu_code)).sort(),
      serviceTypes: Array.from(
        new Map(
          projects
            .map((p) => {
              const v = idOrName(p.service_type_id, p.service_type_name);
              return v
                ? ([v, p.service_type_name || v] as [string, string])
                : null;
            })
            .filter((x): x is [string, string] => !!x),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
      projectTypes: Array.from(
        new Map(
          projects
            .map((p) => {
              const v = idOrName(p.project_type_id, p.project_type_name);
              return v
                ? ([v, p.project_type_name || v] as [string, string])
                : null;
            })
            .filter((x): x is [string, string] => !!x),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
      fys: Array.from(
        new Map(
          projects
            .map((p) => {
              const v = idOrName(p.n_financial_year_id, p.financial_year_name);
              return v
                ? ([v, p.financial_year_name || v] as [string, string])
                : null;
            })
            .filter((x): x is [string, string] => !!x),
        ).entries(),
      ).sort((a, b) => b[1].localeCompare(a[1])),
    };
  }, [projects]);

  const hasActive =
    value.search.trim() !== "" ||
    value.status !== "all" ||
    value.bu !== "all" ||
    value.serviceType !== "all" ||
    value.projectType !== "all" ||
    value.size !== "all" ||
    value.financialYear !== "all" ||
    value.collectionStatus !== "all" ||
    value.siteStatus !== "all";

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-500 mr-1">
          <FolderKanban className="w-4 h-4" />
          <span className="text-[13px] font-medium">項目篩選</span>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋項目編號 / 名稱..."
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-9 h-9 text-[14px] bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">項目BU</span>
          <Select value={value.bu} onValueChange={(v) => set({ bu: v })}>
            <SelectTrigger className="w-[130px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="項目BU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有BU</SelectItem>
              {options.bus.map((bu) => (
                <SelectItem key={bu} value={bu}>
                  {bu}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">服務類型</span>
          <Select
            value={value.serviceType}
            onValueChange={(v) => set({ serviceType: v })}
          >
            <SelectTrigger className="w-[140px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="服務類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有服務類型</SelectItem>
              {options.serviceTypes.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">項目類型</span>
          <Select
            value={value.projectType}
            onValueChange={(v) => set({ projectType: v })}
          >
            <SelectTrigger className="w-[140px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="項目類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有項目類型</SelectItem>
              {options.projectTypes.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">項目規模</span>
          <Select value={value.size} onValueChange={(v) => set({ size: v })}>
            <SelectTrigger className="w-[160px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="項目規模" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_SIZE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">財政年度</span>
          <Select
            value={value.financialYear}
            onValueChange={(v) => set({ financialYear: v })}
          >
            <SelectTrigger className="w-[140px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="財政年度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有財政年度</SelectItem>
              {options.fys.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">項目狀態</span>
          <Select value={value.status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger className="w-[220px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="項目狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有狀態</SelectItem>
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {projectStatusFilterLabel(opt.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">收款狀態</span>
          <Select
            value={value.collectionStatus ?? "all"}
            onValueChange={(v) =>
              set({ collectionStatus: v as CollectionStatusFilter })
            }
          >
            <SelectTrigger className="w-[150px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="收款狀態" />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">工地狀態</span>
          <Select
            value={value.siteStatus ?? "all"}
            onValueChange={(v) => set({ siteStatus: v as SiteStatusFilter })}
          >
            <SelectTrigger className="w-[160px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="工地狀態" />
            </SelectTrigger>
            <SelectContent>
              {SITE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_PROJECT_FILTERS)}
            className="h-9 gap-1 text-[14px] text-red-500 hover:text-red-600 hover:bg-red-50 self-end"
          >
            <X className="w-3.5 h-3.5" /> 清除
          </Button>
        )}
      </div>
    </div>
  );
}
