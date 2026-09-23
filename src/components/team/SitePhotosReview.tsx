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
import { PitchingStageBadge } from "@/components/ui/entity-status-badges";
import { AccessDenied } from "@/components/ui/access-denied";
import { parseBubbleImageUrls } from "@/components/ui/multi-image-uploader";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { BWA_PROJECT_SIZE_FILTER_OPTIONS } from "@/lib/bwa-project-size";
import { formatHongKongDate, formatHongKongDateTime } from "@/lib/date-utils";
import {
  fetchBWAPitchingsPaginated,
  fetchPitchingFilterOptions,
  fetchPMStaffOptions,
  type BWAPitchingRow,
  type LinkOption,
  type PitchingFilterOptions,
  type PitchingStaffContext,
} from "@/lib/data-service";

const PAGE_SIZE = 20;

function formatDate(iso: string | null) {
  return formatHongKongDateTime(iso);
}

function formatDateShort(iso: string | null) {
  return formatHongKongDate(iso);
}

export default function SitePhotosReview() {
  const { staff, isLoading: authLoading } = useAuth();
  const { canView, loading: permLoading } = usePermission();
  const [items, setItems] = useState<BWAPitchingRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [financialYearFilter, setFinancialYearFilter] = useState("all");
  const [osMoneySizeFilter, setOsMoneySizeFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [filterOptions, setFilterOptions] = useState<PitchingFilterOptions>({
    stages: [],
    pms: [],
    teams: [],
    serviceTypes: [],
    districts: [],
    financialYears: [],
  });
  const [pmOptions, setPmOptions] = useState<LinkOption[]>([]);
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
    fetchPitchingFilterOptions()
      .then(setFilterOptions)
      .catch(() => {});
    fetchPMStaffOptions()
      .then(setPmOptions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    stageFilter,
    pmFilter,
    teamFilter,
    serviceTypeFilter,
    districtFilter,
    financialYearFilter,
    osMoneySizeFilter,
  ]);

  const load = useCallback(async () => {
    if (!staff?.id) return;
    setLoading(true);
    setError(null);
    try {
      const staffContext: PitchingStaffContext = {
        staffId: staff.id,
        role: (staff as { role?: string | null }).role ?? null,
        teamTypeId:
          (staff as { n_team_type_id?: string | null }).n_team_type_id ?? null,
      };
      const result = await fetchBWAPitchingsPaginated(
        page,
        PAGE_SIZE,
        {
          search: debouncedSearch || undefined,
          stage: stageFilter !== "all" ? stageFilter : undefined,
          pm: pmFilter !== "all" ? pmFilter : undefined,
          team: teamFilter !== "all" ? teamFilter : undefined,
          serviceType:
            serviceTypeFilter !== "all" ? serviceTypeFilter : undefined,
          district: districtFilter !== "all" ? districtFilter : undefined,
          financialYear:
            financialYearFilter !== "all" ? financialYearFilter : undefined,
          osMoneySize:
            osMoneySizeFilter !== "all" ? osMoneySizeFilter : undefined,
          hasSitePhotos: true,
          sortField: "modified_date",
          sortDir: "desc",
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
    stageFilter,
    pmFilter,
    teamFilter,
    serviceTypeFilter,
    districtFilter,
    financialYearFilter,
    osMoneySizeFilter,
  ]);

  useEffect(() => {
    if (authLoading || !staff?.id) return;
    load();
  }, [authLoading, staff?.id, load]);

  const activeFilterCount = [
    stageFilter,
    pmFilter,
    teamFilter,
    serviceTypeFilter,
    districtFilter,
    financialYearFilter,
    osMoneySizeFilter,
  ].filter((f) => f !== "all").length;

  const clearAllFilters = () => {
    setStageFilter("all");
    setPmFilter("all");
    setTeamFilter("all");
    setServiceTypeFilter("all");
    setDistrictFilter("all");
    setFinancialYearFilter("all");
    setOsMoneySizeFilter("all");
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

  if (!canView("site-photos")) {
    return <AccessDenied module="site-photos" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-bw-blue" />
            現場相片
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            檢視各 Pitching 上載的現場相片，確認清晰度與正確性。Site Photos Review
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

      {/* Same filter bar as /proposals (BWAPitchingList) */}
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
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    {filterOptions.stages.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
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
                  團隊
                </label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有團隊" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有團隊</SelectItem>
                    {filterOptions.teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  服務類型
                </label>
                <Select
                  value={serviceTypeFilter}
                  onValueChange={setServiceTypeFilter}
                >
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="所有服務類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有服務類型</SelectItem>
                    {filterOptions.serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  地區
                </label>
                <Select value={districtFilter} onValueChange={setDistrictFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有地區" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有地區</SelectItem>
                    {filterOptions.districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
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
                    {filterOptions.financialYears.map((fy) => (
                      <SelectItem key={fy.id} value={fy.id}>
                        {fy.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">
                  項目規模
                </label>
                <Select
                  value={osMoneySizeFilter}
                  onValueChange={setOsMoneySizeFilter}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="所有項目規模" />
                  </SelectTrigger>
                  <SelectContent>
                    {BWA_PROJECT_SIZE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
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
          載入現場相片…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
          <ImageIcon className="w-10 h-10 opacity-30 mb-3" />
          <p className="text-sm">範圍內尚無已上載現場相片的 Pitching</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            共 {totalCount} 個 Pitching（第 {page} / {totalPages} 頁）
          </p>
          {items.map((p) => {
            const urls = parseBubbleImageUrls(p.site_photos);
            const customer =
              p.real_customer_display_name ||
              p.customer_name ||
              p.real_customer_co_name ||
              "—";
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/proposals/${p.id}`}
                      className="text-base font-semibold text-bw-blue hover:underline"
                    >
                      {p.pitching_code || "（無編號）"}
                    </Link>
                    <PitchingStageBadge stage={p.pitching_stages} />
                    <span className="text-xs text-gray-400">
                      {urls.length} 張相片
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>客戶：{customer}</span>
                    <span>PM：{p.pm_name || "—"}</span>
                    <span>設計師：{p.designer_name || "—"}</span>
                    <span>查詢日：{formatDateShort(p.enquiry_date)}</span>
                    <span>更新：{formatDate(p.modified_date)}</span>
                    {p.os_money_size && <span>規模：{p.os_money_size}</span>}
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
                            code: p.pitching_code,
                          })
                        }
                        className="group relative aspect-square rounded-md overflow-hidden border border-gray-100 bg-gray-50 hover:ring-2 hover:ring-bw-blue/40 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${p.pitching_code || "Site"} photo ${i + 1}`}
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
            alt={`Site photo ${lightbox.index + 1}`}
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
