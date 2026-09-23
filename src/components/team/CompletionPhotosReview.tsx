"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { AccessDenied } from "@/components/ui/access-denied";
import { parseBubbleImageUrls } from "@/components/ui/multi-image-uploader";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { formatHongKongDate, formatHongKongDateTime } from "@/lib/date-utils";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status-rules";
import {
  fetchBWFProjectsWithCompletionPhotos,
  fetchFinancialYearOptions,
  fetchPMStaffOptions,
  type BWFCompletionPhotoProjectRow,
  type LinkOption,
} from "@/lib/data-service";
import type { StaffDataScope } from "@/lib/staff-data-scope";

const PAGE_SIZE = 20;

function formatDate(iso: string | null) {
  return formatHongKongDateTime(iso);
}

function formatDateShort(iso: string | null) {
  return formatHongKongDate(iso);
}

export default function CompletionPhotosReview() {
  const { staff, isLoading: authLoading } = useAuth();
  const { canView, loading: permLoading } = usePermission();
  const [items, setItems] = useState<BWFCompletionPhotoProjectRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [financialYearFilter, setFinancialYearFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [pmOptions, setPmOptions] = useState<LinkOption[]>([]);
  const [fyOptions, setFyOptions] = useState<LinkOption[]>([]);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
    code: string | null;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPMStaffOptions()
      .then(setPmOptions)
      .catch(() => {});
    fetchFinancialYearOptions()
      .then((rows) =>
        setFyOptions(rows.map((r) => ({ id: r.id, label: r.label })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pmFilter, financialYearFilter]);

  const load = useCallback(async () => {
    if (!staff?.id) return;
    setLoading(true);
    setError(null);
    try {
      const staffContext: StaffDataScope = {
        staffId: staff.id,
        role: (staff as { role?: string | null }).role ?? null,
        teamTypeId:
          (staff as { n_team_type_id?: string | null }).n_team_type_id ?? null,
      };
      const result = await fetchBWFProjectsWithCompletionPhotos(
        page,
        PAGE_SIZE,
        {
          search: debouncedSearch || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          pm: pmFilter !== "all" ? pmFilter : undefined,
          financialYear:
            financialYearFilter !== "all" ? financialYearFilter : undefined,
        },
        staffContext
      );
      setItems(result.data);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
      setItems([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    staff,
    page,
    debouncedSearch,
    statusFilter,
    pmFilter,
    financialYearFilter,
  ]);

  useEffect(() => {
    if (authLoading || !staff?.id) return;
    load();
  }, [authLoading, staff?.id, load]);

  const activeFilterCount = [statusFilter, pmFilter, financialYearFilter].filter(
    (f) => f !== "all"
  ).length;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setPmFilter("all");
    setFinancialYearFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  if (authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        載入中…
      </div>
    );
  }

  if (!canView("completion-photos")) {
    return <AccessDenied module="completion-photos" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-bw-blue" />
            完成項目相片
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            檢視各 BWF Project 上載的完工相片，確認清晰度與正確性。Completion Photos Review
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className={`h-9 shrink-0 ${showAdvancedFilters ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            高級篩選
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-white/20 text-[13px] rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search all columns..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {(activeFilterCount > 0 || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
              onClick={clearAllFilters}
            >
              <X className="w-4 h-4 mr-1" /> 清除篩選
            </Button>
          )}
        </div>

        {showAdvancedFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  狀態
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="所有狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    {PROJECT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.labelZh} {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  PM
                </label>
                <Select value={pmFilter} onValueChange={setPmFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有PM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有PM</SelectItem>
                    {pmOptions.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        <span
                          className={
                            pm.status === "Inactive"
                              ? "line-through text-muted-foreground"
                              : ""
                          }
                        >
                          {pm.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  財政年度
                </label>
                <Select
                  value={financialYearFilter}
                  onValueChange={setFinancialYearFilter}
                >
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="所有財政年度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有財政年度</SelectItem>
                    {fyOptions.map((fy) => (
                      <SelectItem key={fy.id} value={fy.id}>
                        {fy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          載入完工相片…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
          <ImageIcon className="w-10 h-10 opacity-30 mb-3" />
          <p className="text-sm">範圍內尚無已上載完工相片的 BWF Project</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            共 {totalCount} 個項目（第 {page} / {totalPages} 頁）
          </p>
          {items.map((p) => {
            const urls = parseBubbleImageUrls(p.completion_photos);
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/bwf/projects/${p.id}`}
                      className="text-base font-semibold text-bw-blue hover:underline"
                    >
                      {p.project_code || "（無編號）"}
                    </Link>
                    <ProjectStatusBadge status={p.status} />
                    <span className="text-xs text-gray-400">
                      {urls.length} 張相片
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>客戶：{p.customer_name || "—"}</span>
                    <span>PM：{p.pm_name || "—"}</span>
                    <span>設計師：{p.designer_name || "—"}</span>
                    <span>完工日：{formatDateShort(p.handover_date)}</span>
                    <span>更新：{formatDate(p.modified_date)}</span>
                    {p.project_name && <span>{p.project_name}</span>}
                  </div>
                  {p.site_address && (
                    <p className="text-xs text-gray-400 truncate">
                      {p.site_address}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {urls.map((url, i) => (
                      <button
                        key={`${p.id}-${i}`}
                        type="button"
                        onClick={() =>
                          setLightbox({
                            urls,
                            index: i,
                            code: p.project_code,
                          })
                        }
                        className="group relative aspect-square rounded-md overflow-hidden border border-gray-100 bg-gray-50 hover:ring-2 hover:ring-bw-blue/40 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${p.project_code || "Completion"} photo ${i + 1}`}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一頁
              </Button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一頁
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {lightbox && lightbox.urls[lightbox.index] && (
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
          {lightbox.code && (
            <div className="absolute top-4 left-4 text-white/90 text-sm font-medium">
              {lightbox.code}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.urls[lightbox.index]}
            alt={`Completion photo ${lightbox.index + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/90 text-sm">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({
                    ...lightbox,
                    index:
                      (lightbox.index - 1 + lightbox.urls.length) %
                      lightbox.urls.length,
                  });
                }}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                ‹
              </button>
              <span>
                {lightbox.index + 1} / {lightbox.urls.length}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({
                    ...lightbox,
                    index: (lightbox.index + 1) % lightbox.urls.length,
                  });
                }}
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
