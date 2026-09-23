"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Trash2,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Upload,
  Download,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  fetchWeeklyReports,
  uploadWeeklyReportFile,
  createWeeklyReport,
  updateWeeklyReportContent,
  deleteWeeklyReport,
  deleteWeeklyReportFile,
  tenDayPeriodLabel,
  tenDayReportName,
  buildTenDayPeriodSlots,
  type WeeklyReportRow,
} from "@/lib/data-service";
import { usePermission } from "@/hooks/use-permission";
import { formatDate as formatDateFull } from "@/lib/date-utils";

// ─── TYPES ──────────────────────────────────────────────

interface WeeklyReportPanelProps {
  projectId: string;
  startDate: string | null;
  handoverDate: string | null;
  projectName?: string;
  projectCode?: string;
  pmName?: string;
  designerName?: string;
  /** Project cost centre UUID — passed to report editor for PDF branding */
  costCentreId?: string | null;
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
}

interface WeekSlot {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  label: string;
  report: WeeklyReportRow | null;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

// ─── HELPERS ────────────────────────────────────────────

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
  });
}

function generateWeekSlots(
  startDate: string | null,
  handoverDate: string | null,
  reports: WeeklyReportRow[]
): WeekSlot[] {
  const reportMap = new Map<number, WeeklyReportRow>();
  for (const r of reports) {
    if (r.week_number != null) {
      reportMap.set(r.week_number, r);
    }
  }

  return buildTenDayPeriodSlots(
    startDate,
    handoverDate,
    reports.map((r) => r.week_number)
  ).map((slot) => ({
    weekNumber: slot.weekNumber,
    weekStart: slot.weekStart,
    weekEnd: slot.weekEnd,
    label: tenDayPeriodLabel(slot.weekNumber, "zh"),
    report: reportMap.get(slot.weekNumber) || null,
    isPast: slot.isPast,
    isCurrent: slot.isCurrent,
    isFuture: slot.isFuture,
  }));
}

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function WeeklyReportPanel({
  projectId,
  startDate,
  handoverDate,
  projectName,
  projectCode,
  pmName,
  designerName,
  costCentreId = null,
  permissionModule = "projects",
}: WeeklyReportPanelProps) {
  const router = useRouter();
  const { canCreate, canEdit, canDelete } = usePermission();
  const _canCreate = canCreate(permissionModule);
  const _canEdit = canEdit(permissionModule);
  const _canDelete = canDelete(permissionModule);
  const [reports, setReports] = useState<WeeklyReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);

  // Upload PDF dialog
  const [uploadSlot, setUploadSlot] = useState<WeekSlot | null>(null);
  const [uploadReportName, setUploadReportName] = useState("");
  const [uploadMeetingDate, setUploadMeetingDate] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openReportEditor = (slot: WeekSlot, event?: React.MouseEvent) => {
    const params = new URLSearchParams();
    if (slot.report?.id) params.set("reportId", slot.report.id);
    params.set("weekStart", slot.weekStart.toISOString());
    params.set("weekEnd", slot.weekEnd.toISOString());
    if (projectName) params.set("projectName", projectName);
    if (projectCode) params.set("projectCode", projectCode);
    if (pmName) params.set("pmName", pmName);
    if (designerName) params.set("designerName", designerName);
    if (costCentreId) params.set("costCentreId", costCentreId);
    const href = `/projects/bwa/${projectId}/report/${slot.weekNumber}?${params.toString()}`;
    handleNavClick(href, event, (next) => router.push(next));
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    const data = await fetchWeeklyReports(projectId);
    setReports(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const weekSlots = generateWeekSlots(startDate, handoverDate, reports);

  const totalWeeks = weekSlots.length;
  const uploaded = weekSlots.filter((s) => s.report !== null).length;
  const missing = weekSlots.filter((s) => s.isPast && !s.report).length;
  const pending = weekSlots.filter((s) => (s.isCurrent || s.isFuture) && !s.report).length;

  const displaySlots = showAll
    ? weekSlots
    : (() => {
        const currentIdx = weekSlots.findIndex((s) => s.isCurrent);
        if (currentIdx === -1) return weekSlots.slice(-8);
        const start = Math.max(0, currentIdx - 4);
        const end = Math.min(weekSlots.length, currentIdx + 4);
        return weekSlots.slice(start, end);
      })();

  const openUploadDialog = (slot: WeekSlot) => {
    setUploadSlot(slot);
    setUploadReportName(slot.report?.report_name || tenDayReportName(slot.weekNumber));
    setUploadMeetingDate(
      slot.report?.meeting_date?.split("T")[0] || toDateString(slot.weekStart)
    );
    setPendingFile(null);
    setError(null);
  };

  const closeUploadDialog = () => {
    setUploadSlot(null);
    setUploadReportName("");
    setUploadMeetingDate("");
    setPendingFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadSubmit = async () => {
    if (!uploadSlot || !pendingFile) {
      setError("請選擇要上載的 PDF 檔案");
      return;
    }
    if (!uploadReportName.trim()) {
      setError("請填寫報告名稱");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadResult = await uploadWeeklyReportFile(
        projectId,
        uploadSlot.weekNumber,
        pendingFile
      );
      if (!uploadResult.success || !uploadResult.url) {
        setError(uploadResult.error || "上傳失敗");
        setUploading(false);
        return;
      }

      const meetingDate = uploadMeetingDate || toDateString(uploadSlot.weekStart);
      const reportName = uploadReportName.trim();

      if (uploadSlot.report) {
        if (uploadSlot.report.file) {
          await deleteWeeklyReportFile(uploadSlot.report.file);
        }
        const updateResult = await updateWeeklyReportContent(uploadSlot.report.id, {
          file: uploadResult.url,
          report_name: reportName,
          meeting_date: meetingDate,
        });
        if (!updateResult.success) {
          setError(updateResult.error || "更新記錄失敗");
          setUploading(false);
          return;
        }
      } else {
        const createResult = await createWeeklyReport(
          projectId,
          uploadSlot.weekNumber,
          meetingDate,
          uploadResult.url,
          reportName,
          null,
          projectName
        );
        if (!createResult.success) {
          setError(createResult.error || "建立記錄失敗");
          setUploading(false);
          return;
        }
      }

      closeUploadDialog();
      await loadReports();
    } catch (err: any) {
      setError(err.message || "上傳失敗");
    }
    setUploading(false);
  };

  const handleDownloadFile = (report: WeeklyReportRow) => {
    if (!report.file) return;
    const link = document.createElement("a");
    link.href = report.file;
    link.download = `${report.report_name || tenDayReportName(report.week_number || 1)}.pdf`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (report: WeeklyReportRow) => {
    if (!confirm("確定要刪除此10日報告？")) return;
    setDeleting(report.id);

    if (report.file) {
      await deleteWeeklyReportFile(report.file);
    }

    const result = await deleteWeeklyReport(report.id);
    if (!result.success) {
      setError(result.error || "刪除失敗");
    }

    await loadReports();
    setDeleting(null);
  };

  if (!startDate || !handoverDate) {
    return (
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="flex items-center gap-2 text-[16px] font-semibold text-gray-800">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-50">
              <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
            </div>
            每10天工地報告
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-1">
          <Separator className="mb-3" />
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">未設定項目日期範圍</p>
            <p className="text-xs text-gray-400">
              請先設定項目的「開始日期」及「交場日期」
              <br />
              才能產生每10日報告時間表
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="flex items-center gap-2 text-[16px] font-semibold text-gray-800">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-50">
            <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
          </div>
          每10天工地報告
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-1">
        <Separator className="mb-3" />

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>開始日期:</span>
            <span className="font-medium text-gray-700">{formatDateFull(startDate)}</span>
          </div>
          <span className="text-gray-300">→</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            <span>交場日期:</span>
            <span className="font-medium text-gray-700">{formatDateFull(handoverDate)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700 font-mono-num">{totalWeeks}</p>
            <p className="text-[12px] text-blue-500 mt-0.5">總期數</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-emerald-700 font-mono-num">{uploaded}</p>
            <p className="text-[12px] text-emerald-500 mt-0.5">已上傳</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-700 font-mono-num">{missing}</p>
            <p className="text-[12px] text-red-500 mt-0.5">逾期未交</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-700 font-mono-num">{pending}</p>
            <p className="text-[12px] text-amber-500 mt-0.5">待上傳</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>上傳進度</span>
            <span className="font-mono">
              {totalWeeks > 0 ? Math.round((uploaded / totalWeeks) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${totalWeeks > 0 ? (uploaded / totalWeeks) * 100 : 0}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-600 text-xs mb-4">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入10日報告記錄...</span>
          </div>
        ) : weekSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
              <ClipboardList className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">無需上傳報告</p>
            <p className="text-xs text-gray-300">項目日期範圍無效</p>
          </div>
        ) : (
          <>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[100px_180px_100px_1fr_minmax(320px,auto)] bg-gray-50 text-xs text-gray-500 font-medium px-4 py-2.5 border-b border-gray-100">
                <span>期次</span>
                <span>日期範圍</span>
                <span>狀態</span>
                <span>報告文件</span>
                <span className="text-right">操作</span>
              </div>

              {displaySlots.map((slot) => {
                const isDeleting = slot.report ? deleting === slot.report.id : false;
                const hasContent = slot.report && (
                  slot.report.zb_key_focus || slot.report.zc_completed_work ||
                  slot.report.zd_next_week_work || slot.report.za_meeting_team
                );
                const periodLabel = tenDayPeriodLabel(slot.weekNumber, "en");

                return (
                  <div
                    key={slot.weekNumber}
                    className={cn(
                      "grid grid-cols-[100px_180px_100px_1fr_minmax(320px,auto)] items-center px-4 py-3.5 border-b border-gray-50 last:border-b-0 text-sm transition-colors",
                      slot.isCurrent && "bg-blue-50/50",
                      slot.isPast && !slot.report && "bg-red-50/30"
                    )}
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={cn(
                        "font-mono font-semibold text-xs",
                        slot.isCurrent ? "text-blue-600" : "text-gray-700"
                      )}>
                        {periodLabel}
                      </span>
                      {slot.isCurrent && (
                        <Badge className="text-[12px] px-1.5 py-0.5 bg-blue-100 text-blue-600 border-0">
                          本期
                        </Badge>
                      )}
                    </div>

                    <div className="text-gray-500">
                      {formatDateShort(slot.weekStart)} — {formatDateShort(slot.weekEnd)}
                    </div>

                    <div>
                      {slot.report ? (
                        <Badge className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 border-0 gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 已上傳
                        </Badge>
                      ) : slot.isPast ? (
                        <Badge className="text-xs px-2 py-0.5 bg-red-100 text-red-600 border-0 gap-1">
                          <XCircle className="w-3.5 h-3.5" /> 逾期
                        </Badge>
                      ) : slot.isCurrent ? (
                        <Badge className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 border-0 gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> 待上傳
                        </Badge>
                      ) : (
                        <Badge className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 border-0 gap-1">
                          <Calendar className="w-3.5 h-3.5" /> 尚未到期
                        </Badge>
                      )}
                    </div>

                    <div className="truncate flex items-center gap-2">
                      {slot.report?.file ? (
                        <a
                          href={slot.report.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[160px]">
                            {slot.report.report_name || tenDayReportName(slot.weekNumber)}
                          </span>
                        </a>
                      ) : slot.report ? (
                        <span className="text-xs text-gray-500">
                          {slot.report.report_name || tenDayReportName(slot.weekNumber)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                      {hasContent && (
                        <Badge className="text-[12px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border-0">
                          有內容
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 justify-end flex-nowrap">
                      {(slot.report ? _canEdit : _canCreate) && (
                        <Button
                          variant={slot.report ? "ghost" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 gap-1 text-xs px-2.5",
                            slot.report
                              ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              : "border-blue-200 text-blue-600 hover:bg-blue-50"
                          )}
                          disabled={slot.isFuture}
                          onClick={(e) => openReportEditor(slot, e)}
                        >
                          {slot.report ? (
                            <>
                              <Edit3 className="w-3 h-3" />
                              編輯
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              新增
                            </>
                          )}
                        </Button>
                      )}

                      {((_canCreate && !slot.report) || (_canEdit && !!slot.report)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          disabled={slot.isFuture}
                          onClick={() => openUploadDialog(slot)}
                        >
                          <Upload className="w-3 h-3" />
                          上載PDF
                        </Button>
                      )}

                      {slot.report ? (
                        <>
                          {slot.report.file && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="預覽"
                                onClick={() =>
                                  window.open(slot.report!.file!, "_blank")
                                }
                              >
                                <Eye className="w-3.5 h-3.5 text-gray-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="下載"
                                onClick={() => handleDownloadFile(slot.report!)}
                              >
                                <Download className="w-3.5 h-3.5 text-blue-500" />
                              </Button>
                            </>
                          )}
                          {_canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={isDeleting}
                              onClick={() => handleDelete(slot.report!)}
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </Button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {weekSlots.length > 8 && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-[13px] text-gray-500"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> 收起 (顯示最近)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> 顯示全部 {totalWeeks} 期
                    </>
                  )}
                </Button>
              </div>
            )}

            {_canEdit && (
              <div className="flex justify-end mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[13px]"
                  disabled={weekSlots.length === 0}
                  onClick={(e) => {
                    const currentSlot = weekSlots.find((s) => s.isCurrent) || weekSlots[0];
                    if (currentSlot) openReportEditor(currentSlot, e);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" /> 編輯10日報告
                </Button>
              </div>
            )}

          </>
        )}
      </CardContent>
    </Card>

    {/* Upload PDF dialog */}
    <Dialog
      open={!!uploadSlot}
      onOpenChange={(open) => {
        if (!open && !uploading) closeUploadDialog();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            上載PDF
            {uploadSlot && (
              <Badge className="text-[11px] px-1.5 py-0.5 bg-blue-100 text-blue-700 border-0 font-normal">
                {tenDayPeriodLabel(uploadSlot.weekNumber, "en")}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {uploadSlot && (
            <p className="text-xs text-gray-500">
              日期範圍：{formatDateShort(uploadSlot.weekStart)} — {formatDateShort(uploadSlot.weekEnd)}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              報告名稱 <span className="text-red-400">*</span>
            </label>
            <Input
              value={uploadReportName}
              onChange={(e) => setUploadReportName(e.target.value)}
              placeholder="例如：10天報告"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">會議日期</label>
            <Input
              type="date"
              value={uploadMeetingDate}
              onChange={(e) => setUploadMeetingDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              PDF 檔案 <span className="text-red-400">*</span>
            </label>
            {pendingFile ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-800 truncate flex-1">{pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-1 rounded hover:bg-emerald-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-emerald-500" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
              >
                <Upload className="w-6 h-6 text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">點擊選擇 PDF 檔案</p>
                <p className="text-[12px] text-gray-300 mt-0.5">僅支援 PDF</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                  setError("請上載 PDF 檔案");
                  setPendingFile(null);
                  return;
                }
                setError(null);
                setPendingFile(file);
              }}
            />
          </div>

          {error && uploadSlot && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-600 text-xs">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeUploadDialog} disabled={uploading}>
            取消
          </Button>
          <Button
            onClick={handleUploadSubmit}
            disabled={uploading || !pendingFile || !uploadReportName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                上載中...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                上載
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
