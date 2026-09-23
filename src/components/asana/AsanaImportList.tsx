"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  FolderOpen,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
  Import,
  Layers,
} from "lucide-react";
import BWAPitchingDialog from "@/components/pitching/BWAPitchingDialog";
import type { BwaPitchingImportPrefill } from "@/lib/asana-import-map";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { formatDateOnly } from "@/lib/date-utils";
import { enquiryDateFromAsanaCreatedAt } from "@/lib/asana-import-map";
import {
  ASANA_IMPORT_PROJECTS,
  type AsanaImportProjectKey,
  type AsanaImportTask,
} from "@/lib/asana-import-projects";

type ProjectFilter = "all" | AsanaImportProjectKey;
type SortField = "createdAt" | "name" | "assigneeName" | "dueOn" | "projectShortName" | "completed";
type SortDir = "asc" | "desc";

type ApiTask = AsanaImportTask;

function compareNullable(a: string | null, b: string | null, dir: SortDir): number {
  if (a && b && a !== b) {
    const cmp = a.localeCompare(b, "zh-HK");
    return dir === "asc" ? cmp : -cmp;
  }
  if (a && !b) return -1;
  if (!a && b) return 1;
  return 0;
}

export default function AsanaImportList() {
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [hiddenImportedCount, setHiddenImportedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("dueOn");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importingGid, setImportingGid] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<BwaPitchingImportPrefill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        project: "all",
        includeCompleted: includeCompleted ? "1" : "0",
      });
      const res = await fetch(`/api/asana/import-tasks?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        tasks?: ApiTask[];
        hiddenImportedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `載入失敗 (${res.status})`);
      }
      setTasks(json.tasks ?? []);
      setHiddenImportedCount(json.hiddenImportedCount ?? 0);
    } catch (err) {
      setTasks([]);
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [includeCompleted]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "createdAt" ? "desc" : "asc");
  };

  const scopedTasks = useMemo(() => {
    if (projectFilter === "all") return tasks;
    return tasks.filter((task) => task.projectKey === projectFilter);
  }, [tasks, projectFilter]);

  const metrics = useMemo(() => {
    const byKey = (key: AsanaImportProjectKey) =>
      tasks.filter((task) => task.projectKey === key).length;
    return {
      total: tasks.length,
      "active-1": byKey("active-1"),
      "active-2": byKey("active-2"),
      "active-2a": byKey("active-2a"),
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedTasks;
    return scopedTasks.filter((task) => {
      const hay = [
        task.name,
        task.assigneeName ?? "",
        task.projectName,
        task.projectShortName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [scopedTasks, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortField === "completed") {
        if (a.completed === b.completed) return 0;
        const cmp = a.completed ? 1 : -1;
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "name") {
        const cmp = a.name.localeCompare(b.name, "zh-HK");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "projectShortName") {
        const cmp = a.projectShortName.localeCompare(b.projectShortName, "zh-HK");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "assigneeName") {
        return compareNullable(a.assigneeName, b.assigneeName, sortDir);
      }
      if (sortField === "createdAt") {
        return compareNullable(
          enquiryDateFromAsanaCreatedAt(a.createdAt) || null,
          enquiryDateFromAsanaCreatedAt(b.createdAt) || null,
          sortDir
        );
      }
      return compareNullable(a.dueOn, b.dueOn, sortDir);
    });
    return rows;
  }, [filtered, sortField, sortDir]);

  const handleImport = async (task: ApiTask) => {
    setImportingGid(task.gid);
    setImportError(null);
    try {
      const res = await fetch(
        `/api/asana/import-prefill?task=${encodeURIComponent(task.gid)}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        prefill?: BwaPitchingImportPrefill;
        error?: string;
      };
      if (!res.ok || !json.prefill) {
        throw new Error(json.error || `無法讀取任務 (${res.status})`);
      }
      setPrefill(json.prefill);
      setDialogOpen(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      setImportingGid(null);
    }
  };

  const openCount = scopedTasks.filter((task) => !task.completed).length;
  const hasFilters = search.trim() !== "" || includeCompleted || projectFilter !== "all";

  const SortHead = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => {
    const active = sortField === field;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className="inline-flex items-center gap-1 whitespace-nowrap hover:text-gray-900"
        >
          {children}
          <Icon className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <AsanaIcon size={24} />
            Asana 匯入
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            從 Chi Fung Group 三個 BWA Active 專案讀取任務。目前只顯示清單，尚未寫入
            PMS。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1.5" />
          )}
          重新整理
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          label="待匯入總數"
          value={loading ? "—" : metrics.total}
          subLabel={hiddenImportedCount > 0 ? `已匯入隱藏 ${hiddenImportedCount}` : "尚未寫入 PMS"}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
          active={projectFilter === "all"}
          onClick={() => setProjectFilter("all")}
        />
        {ASANA_IMPORT_PROJECTS.map((project, index) => {
          const colors = [
            { color: "bg-amber-500", borderColor: "border-l-amber-500" },
            { color: "bg-violet-500", borderColor: "border-l-violet-500" },
            { color: "bg-emerald-500", borderColor: "border-l-emerald-500" },
          ][index] ?? { color: "bg-slate-500", borderColor: "border-l-slate-500" };
          return (
            <StatCard
              key={project.key}
              icon={FolderOpen}
              label={project.shortName}
              value={loading ? "—" : metrics[project.key]}
              subLabel={project.name}
              color={colors.color}
              borderColor={colors.borderColor}
              active={projectFilter === project.key}
              onClick={() => setProjectFilter(project.key)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill
          active={projectFilter === "all"}
          onClick={() => setProjectFilter("all")}
          label="全部專案"
        />
        {ASANA_IMPORT_PROJECTS.map((project) => (
          <FilterPill
            key={project.key}
            active={projectFilter === project.key}
            onClick={() => setProjectFilter(project.key)}
            label={project.shortName}
            title={project.name}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋任務、負責人、專案…"
            className="pl-9"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
            className="rounded border-gray-300"
          />
          顯示已完成
        </label>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setIncludeCompleted(false);
              setProjectFilter("all");
            }}
          >
            <X className="w-4 h-4 mr-1" /> 清除
          </Button>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {loading
            ? "載入中…"
            : `${sorted.length} 筆${includeCompleted ? ` · 未完成 ${openCount}` : ""}${
                hiddenImportedCount > 0 ? ` · 已匯入隱藏 ${hiddenImportedCount}` : ""
              }`}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            載入 Asana 任務…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 px-6 text-center">
            <FolderOpen className="w-10 h-10 mb-2 opacity-40" />
            <p className="font-medium text-gray-700">無法讀取 Asana</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <FolderOpen className="w-10 h-10 mb-2 opacity-40" />
            <p>沒有符合的任務</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36 whitespace-nowrap">匯入</TableHead>
                  <SortHead field="createdAt">查詢日期</SortHead>
                  <SortHead field="projectShortName">專案</SortHead>
                  <SortHead field="name">任務</SortHead>
                  <SortHead field="assigneeName">負責人</SortHead>
                  <SortHead field="dueOn">到期日</SortHead>
                  <SortHead field="completed">Asana 狀態</SortHead>
                  <TableHead className="w-12 text-center">Asana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((task) => (
                  <TableRow key={`${task.projectKey}-${task.gid}`}>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={importingGid === task.gid}
                        onClick={() => void handleImport(task)}
                      >
                        {importingGid === task.gid ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Import className="w-3.5 h-3.5 mr-1" />
                        )}
                        轉成Pitching
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {task.createdAt
                        ? formatDateOnly(enquiryDateFromAsanaCreatedAt(task.createdAt), {
                            format: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      <span title={task.projectName}>{task.projectShortName}</span>
                    </TableCell>
                    <TableCell className="min-w-[280px] text-sm text-gray-900">
                      {task.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {task.assigneeName || "未指派"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {task.dueOn ? formatDateOnly(task.dueOn, { format: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          task.completed
                            ? "bg-gray-50 text-gray-500 border-gray-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {task.completed ? "已完成" : "未完成"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <AsanaLinkButton href={task.permalinkUrl} title="開啟 Asana 任務" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {importError && (
        <p className="text-sm text-red-600">{importError}</p>
      )}

      <BWAPitchingDialog
        open={dialogOpen}
        prefill={prefill}
        onClose={() => {
          setDialogOpen(false);
          setPrefill(null);
        }}
        onSaved={() => {
          const importedGid = prefill?.asanaTaskGid;
          setDialogOpen(false);
          setPrefill(null);
          if (importedGid) {
            setTasks((prev) => prev.filter((task) => task.gid !== importedGid));
            setHiddenImportedCount((n) => n + 1);
          }
          void loadData();
        }}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  borderColor: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md ${
        active ? "ring-2 ring-bw-blue/30" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && (
            <p className="text-[13px] text-gray-400 mt-0.5 truncate" title={subLabel}>
              {subLabel}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-bw-blue text-white border-bw-blue"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
