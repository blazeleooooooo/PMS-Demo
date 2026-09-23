"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCasePdfProjects,
  type CasePdfProjectRow,
  type ProjectStaffContext,
} from "@/lib/data-service";
import { resolveCasePdfImageMap } from "@/lib/case-pdf-images";
import {
  casePdfFingerprint,
  DEFAULT_CASE_PDF_TITLE,
  deserializeFilters,
  loadCasePdfDraft,
  saveCasePdfDraft,
  serializeFilters,
} from "@/lib/case-pdf-storage";
import CasePdfFiltersBar, {
  EMPTY_CASE_PDF_FILTERS,
  toCasePdfFilters,
  type CasePdfFilterValues,
} from "./CasePdfFilters";
import CasePdfCard from "./CasePdfCard";

export default function CasePdfPage() {
  const { staff } = useAuth();
  const [filters, setFilters] = useState<CasePdfFilterValues>(
    EMPTY_CASE_PDF_FILTERS,
  );
  const [rows, setRows] = useState<CasePdfProjectRow[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [documentTitle, setDocumentTitle] = useState(DEFAULT_CASE_PDF_TITLE);

  const previewFingerprintRef = useRef<string | null>(null);
  const imageCacheRef = useRef<Record<string, string>>({});
  const previewUrlRef = useRef<string | null>(null);

  // Hydrate draft from sessionStorage once
  useEffect(() => {
    const draft = loadCasePdfDraft();
    if (draft) {
      setFilters(deserializeFilters(draft.filters));
      setRows(draft.rows ?? []);
      setHiddenIds(new Set(draft.hiddenIds ?? []));
      setHasApplied(!!draft.hasApplied && (draft.rows?.length ?? 0) > 0);
      setDocumentTitle(
        draft.documentTitle?.trim() || DEFAULT_CASE_PDF_TITLE,
      );
    }
    setHydrated(true);
  }, []);

  // Persist draft whenever state changes (after hydrate)
  useEffect(() => {
    if (!hydrated) return;
    saveCasePdfDraft({
      filters: serializeFilters(filters),
      rows,
      hiddenIds: Array.from(hiddenIds),
      hasApplied,
      documentTitle,
    });
  }, [hydrated, filters, rows, hiddenIds, hasApplied, documentTitle]);

  // Keep previewUrlRef in sync; revoke only on unmount
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const visibleCount = useMemo(
    () => rows.filter((r) => !hiddenIds.has(r.id)).length,
    [rows, hiddenIds],
  );

  const currentFingerprint = useMemo(
    () => casePdfFingerprint(rows, hiddenIds, documentTitle),
    [rows, hiddenIds, documentTitle],
  );

  // Invalidate cached PDF when content changes
  useEffect(() => {
    if (
      previewFingerprintRef.current != null &&
      previewFingerprintRef.current !== currentFingerprint
    ) {
      setPreviewReady(false);
      previewFingerprintRef.current = null;
      // Keep blob URL until next generate so Export can still use stale? No —
      // mark not ready; revoke old blob to free memory when regenerating.
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
      }
    }
  }, [currentFingerprint]);

  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const staffContext: ProjectStaffContext | undefined = staff?.id
        ? {
            staffId: staff.id,
            role: staff.role || null,
            teamTypeId: staff.n_team_type_id || null,
          }
        : undefined;

      const data = await fetchCasePdfProjects(
        toCasePdfFilters(filters),
        staffContext,
      );
      // Preserve hide state for projects that still exist
      setHiddenIds((prev) => {
        const next = new Set<string>();
        const ids = new Set(data.map((r) => r.id));
        for (const id of prev) {
          if (ids.has(id)) next.add(id);
        }
        return next;
      });
      setRows(data);
      setHasApplied(true);
      setPreviewReady(false);
      previewFingerprintRef.current = null;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
      }
    } catch (err: any) {
      console.error("fetchCasePdfProjects", err);
      setError(err?.message || "載入失敗");
      setRows([]);
      setHasApplied(true);
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (index: number, next: CasePdfProjectRow) => {
    setRows((prev) => prev.map((r, i) => (i === index ? next : r)));
  };

  const moveRow = (index: number, dir: -1 | 1) => {
    setRows((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[target];
      copy[target] = tmp;
      return copy;
    });
  };

  const toggleHidden = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showAllHidden = () => setHiddenIds(new Set());

  const buildPdfBlob = useCallback(async () => {
    const visibleRows = rows.filter((r) => !hiddenIds.has(r.id));
    if (visibleRows.length === 0) {
      throw new Error("沒有可輸出的項目（全部已隱藏）");
    }
    const { byProjectId, bySourceUrl } = await resolveCasePdfImageMap(
      visibleRows,
      imageCacheRef.current,
    );
    imageCacheRef.current = bySourceUrl;

    const { pdf } = await import("@react-pdf/renderer");
    const { CasePdfPDFDocument } = await import("./CasePdfPDFDocument");
    const heading = documentTitle.trim() || DEFAULT_CASE_PDF_TITLE;
    return pdf(
      CasePdfPDFDocument({
        rows: visibleRows,
        imageDataUrls: byProjectId,
        documentTitle: heading,
      }),
    ).toBlob();
  }, [rows, hiddenIds, documentTitle]);

  const ensureCachedPdf = useCallback(async (): Promise<string> => {
    const fp = casePdfFingerprint(rows, hiddenIds, documentTitle);
    if (
      previewReady &&
      previewUrlRef.current &&
      previewFingerprintRef.current === fp
    ) {
      return previewUrlRef.current;
    }

    const blob = await buildPdfBlob();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    previewFingerprintRef.current = fp;
    setPreviewUrl(url);
    setPreviewReady(true);
    return url;
  }, [rows, hiddenIds, previewReady, buildPdfBlob]);

  const handlePreviewPDF = async () => {
    if (visibleCount === 0) return;
    setGenerating(true);
    setError(null);
    try {
      await ensureCachedPdf();
      setShowPreview(true);
    } catch (err: any) {
      console.error("Case PDF preview error:", err);
      setError(err?.message || "PDF 預覽失敗");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (visibleCount === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const url = await ensureCachedPdf();
      const link = document.createElement("a");
      link.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      link.download = `個案參考_${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Case PDF download error:", err);
      setError(err?.message || "PDF 下載失敗");
    } finally {
      setGenerating(false);
    }
  };

  const closePreview = () => {
    // Keep cached blob in memory for fast re-open / export
    setShowPreview(false);
  };

  if (!hydrated) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        載入草稿…
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center">
          <div className="bg-white w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                個案 PDF 預覽
                {previewReady && (
                  <span className="text-xs font-normal text-gray-400">
                    （已快取）
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={handleDownloadPDF}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  下載 PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={closePreview}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Case PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">個案PDF</h1>
          <p className="text-sm text-gray-500 mt-1">
            篩選 BWA 工程項目，預覽後輸出客戶參考 PDF（草稿暫存於本瀏覽器分頁）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={visibleCount === 0 || generating || loading}
            onClick={handlePreviewPDF}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            預覽 PDF
            {visibleCount > 0 ? `（${visibleCount}）` : ""}
            {previewReady ? " · 快取" : ""}
          </Button>
          <Button
            className="bg-bw-blue hover:bg-bw-blue/90"
            disabled={visibleCount === 0 || generating || loading}
            onClick={handleDownloadPDF}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            輸出 PDF
            {visibleCount > 0 ? `（${visibleCount}）` : ""}
          </Button>
        </div>
      </div>

      <CasePdfFiltersBar
        value={filters}
        onChange={setFilters}
        onApply={applyFilters}
        loading={loading}
      />

      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <Label
          htmlFor="case-pdf-document-title"
          className="text-xs text-gray-500"
        >
          PDF 標題
        </Label>
        <Input
          id="case-pdf-document-title"
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          placeholder={DEFAULT_CASE_PDF_TITLE}
          className="mt-1.5 h-10 text-lg font-semibold border-0 border-b border-transparent hover:border-gray-200 focus-visible:ring-0 focus-visible:border-bw-blue rounded-none px-0"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          載入項目中…
        </div>
      )}

      {!loading && hasApplied && rows.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-16 border border-dashed border-gray-200 rounded-lg bg-white">
          沒有符合條件的項目。請調整篩選後再試。
        </div>
      )}

      {!loading && !hasApplied && (
        <div className="text-center text-sm text-gray-400 py-16 border border-dashed border-gray-200 rounded-lg bg-white">
          請設定篩選條件後按「套用篩選」載入項目預覽。
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              可修改欄位、隱藏、切換效果圖；變更與隱藏狀態暫存於本瀏覽器分頁，不會寫回資料庫。
              輸出／預覽只包含未隱藏的 {visibleCount} / {rows.length} 個項目。
              {previewReady
                ? " PDF 已快取——內容未改時再開預覽／輸出會即時完成。"
                : ""}
            </p>
            {hiddenIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={showAllHidden}
              >
                顯示全部隱藏項目（{hiddenIds.size}）
              </Button>
            )}
          </div>
          {rows.map((row, index) => (
            <CasePdfCard
              key={row.id}
              row={row}
              index={index}
              total={rows.length}
              hidden={hiddenIds.has(row.id)}
              onChange={(next) => updateRow(index, next)}
              onMoveUp={() => moveRow(index, -1)}
              onMoveDown={() => moveRow(index, 1)}
              onToggleHidden={() => toggleHidden(row.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
