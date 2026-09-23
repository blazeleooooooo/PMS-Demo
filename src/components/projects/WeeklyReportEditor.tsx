"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  Save,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  CalendarDays,
  Download,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  updateWeeklyReportContent,
  fetchSingleWeeklyReport,
  createWeeklyReportWithContent,
  fetchCostCentres,
  persistWeeklyReportPdf,
  resolveDefaultReportProjectName,
  normalizeReportProjectName,
  tenDayPeriodLabel,
  tenDayReportName,
  type WeeklyReportRow,
  type CostCentreData,
} from "@/lib/data-service";
import RichTextEditor from "@/components/ui/rich-text-editor";
import WeeklyReportAiChat from "@/components/projects/WeeklyReportAiChat";
import {
  applyWeeklyReportAiFields,
  type WeeklyReportAiFields,
} from "@/lib/weekly-report-ai";

// ─── SECTION DEFINITIONS ─────────────────────────────────

interface SectionDef {
  key: keyof Pick<
    WeeklyReportRow,
    | "za_meeting_team"
    | "zb_key_focus"
    | "zc_completed_work"
    | "zd_next_week_work"
    | "ze_additional_items"
    | "zf_urgent_client_confirm"
    | "zg_site_changes"
    | "zh_factors_affecting_handover"
    | "zi_overall_site_schedule"
    | "zj_payment_schedule"
    | "zk_appendix"
  >;
  label: string;
  sublabel: string;
  color: string;
  isRichText: boolean; // Meeting team is plain text (team members list), others are rich text
}

const SECTIONS: SectionDef[] = [
  {
    key: "za_meeting_team",
    label: "會議參與團隊",
    sublabel: "Meeting Attendees",
    color: "blue",
    isRichText: false,
  },
  {
    key: "zb_key_focus",
    label: "本期重點關注事項",
    sublabel: "Key Focus",
    color: "amber",
    isRichText: true,
  },
  {
    key: "zc_completed_work",
    label: "本期已完成工作",
    sublabel: "Completed Work This Period",
    color: "emerald",
    isRichText: true,
  },
  {
    key: "zd_next_week_work",
    label: "下期工作",
    sublabel: "Next Period's Work",
    color: "violet",
    isRichText: true,
  },
  {
    key: "ze_additional_items",
    label: "後加項目 (需報價)",
    sublabel: "Additional Items (Quotation Required)",
    color: "orange",
    isRichText: true,
  },
  {
    key: "zf_urgent_client_confirm",
    label: "急需客人確定",
    sublabel: "Urgent Client Confirmation Needed",
    color: "red",
    isRichText: true,
  },
  {
    key: "zg_site_changes",
    label: "現場更改項目",
    sublabel: "On-site Changes",
    color: "pink",
    isRichText: true,
  },
  {
    key: "zh_factors_affecting_handover",
    label: "影響交場日的因素",
    sublabel: "Factors Affecting Handover Date",
    color: "rose",
    isRichText: true,
  },
  {
    key: "zi_overall_site_schedule",
    label: "整體工地時間表",
    sublabel: "Overall Site Schedule",
    color: "cyan",
    isRichText: true,
  },
  {
    key: "zj_payment_schedule",
    label: "付款時間表",
    sublabel: "Payment Schedule",
    color: "teal",
    isRichText: true,
  },
  {
    key: "zk_appendix",
    label: "附錄",
    sublabel: "Appendix",
    color: "gray",
    isRichText: true,
  },
];

// ─── PROPS ───────────────────────────────────────────────

interface WeeklyReportEditorProps {
  reportId: string | null; // null = creating new
  projectId: string;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  projectName?: string;
  projectCode?: string;
  pmName?: string;
  designerName?: string;
  /** Project cost centre UUID — drives PDF logo / company names */
  costCentreId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

// ─── COLOR UTILS ─────────────────────────────────────────

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700" },
  pink: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", badge: "bg-pink-100 text-pink-700" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700", badge: "bg-cyan-100 text-cyan-700" },
  teal: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", badge: "bg-teal-100 text-teal-700" },
  gray: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-700" },
};

// ─── COMPONENT ───────────────────────────────────────────

export default function WeeklyReportEditor({
  reportId,
  projectId,
  weekNumber,
  weekStart,
  weekEnd,
  projectName,
  projectCode,
  pmName,
  designerName,
  costCentreId = null,
  onClose,
  onSaved,
}: WeeklyReportEditorProps) {
  const [loading, setLoading] = useState(!!reportId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [report, setReport] = useState<WeeklyReportRow | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(reportId);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [costCentre, setCostCentre] = useState<CostCentreData | null>(null);
  const [meetingDate, setMeetingDate] = useState<string>(
    weekStart.toISOString().split("T")[0]
  );
  /** Report-only title for PDF header/footer — not written to bwa_projects */
  const [displayProjectName, setDisplayProjectName] = useState("");

  // Form state for each section
  const [formData, setFormData] = useState<Record<string, string>>({
    za_meeting_team: "",
    zb_key_focus: "",
    zc_completed_work: "",
    zd_next_week_work: "",
    ze_additional_items: "",
    zf_urgent_client_confirm: "",
    zg_site_changes: "",
    zh_factors_affecting_handover: "",
    zi_overall_site_schedule: "",
    zj_payment_schedule: "",
    zk_appendix: "",
  });

  // Collapsed sections tracking
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [aiOpen, setAiOpen] = useState(true);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [aiEditorEpoch, setAiEditorEpoch] = useState(0);

  // Load cost centre for PDF header (logo / company names)
  useEffect(() => {
    if (!costCentreId) {
      setCostCentre(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const centres = await fetchCostCentres();
      if (cancelled) return;
      setCostCentre(centres.find((c) => c.id === costCentreId) || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [costCentreId]);

  // Load existing report, or default display name for a new report
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (reportId) {
        const data = await fetchSingleWeeklyReport(reportId);
        if (cancelled) return;
        if (data) {
          setReport(data);
          setActiveReportId(data.id);
          setMeetingDate(data.meeting_date ? data.meeting_date.split("T")[0] : "");
          const savedName = data.display_project_name?.trim();
          setDisplayProjectName(
            savedName
              ? normalizeReportProjectName(savedName)
              : await resolveDefaultReportProjectName(projectId, projectName)
          );
          setFormData({
            za_meeting_team: data.za_meeting_team || "",
            zb_key_focus: data.zb_key_focus || "",
            zc_completed_work: data.zc_completed_work || "",
            zd_next_week_work: data.zd_next_week_work || "",
            ze_additional_items: data.ze_additional_items || "",
            zf_urgent_client_confirm: data.zf_urgent_client_confirm || "",
            zg_site_changes: data.zg_site_changes || "",
            zh_factors_affecting_handover: data.zh_factors_affecting_handover || "",
            zi_overall_site_schedule: data.zi_overall_site_schedule || "",
            zj_payment_schedule: data.zj_payment_schedule || "",
            zk_appendix: data.zk_appendix || "",
          });
        }
      } else {
        const defaultName = await resolveDefaultReportProjectName(projectId, projectName);
        if (cancelled) return;
        setDisplayProjectName(defaultName);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, projectId, projectName]);

  const updateField = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleAiApply = useCallback(
    (payload: { fields: WeeklyReportAiFields; filledKeys: string[] }) => {
      setFormData((prev) => applyWeeklyReportAiFields(prev, payload.fields).next);
      if (payload.fields.meeting_date) {
        setMeetingDate(payload.fields.meeting_date);
      }
      setAiEditorEpoch((epoch) => epoch + 1);
      setSaved(false);
      setHighlighted(new Set(payload.filledKeys));
      setCollapsed((prev) => {
        const next = new Set(prev);
        for (const key of payload.filledKeys) next.delete(key);
        return next;
      });
      window.setTimeout(() => setHighlighted(new Set()), 4500);
    },
    []
  );

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    let result;

    const fields = {
      za_meeting_team: formData.za_meeting_team || null,
      zb_key_focus: formData.zb_key_focus || null,
      zc_completed_work: formData.zc_completed_work || null,
      zd_next_week_work: formData.zd_next_week_work || null,
      ze_additional_items: formData.ze_additional_items || null,
      zf_urgent_client_confirm: formData.zf_urgent_client_confirm || null,
      zg_site_changes: formData.zg_site_changes || null,
      zh_factors_affecting_handover: formData.zh_factors_affecting_handover || null,
      zi_overall_site_schedule: formData.zi_overall_site_schedule || null,
      zj_payment_schedule: formData.zj_payment_schedule || null,
      zk_appendix: formData.zk_appendix || null,
      display_project_name: displayProjectName.trim() || null,
    };

    const meetingDateValue = meetingDate.trim() || null;

    if (activeReportId) {
      result = await updateWeeklyReportContent(activeReportId, {
        ...fields,
        meeting_date: meetingDateValue,
      });
    } else {
      result = await createWeeklyReportWithContent(
        projectId,
        weekNumber,
        meetingDateValue,
        fields
      );
      if (result.success && result.id) {
        setActiveReportId(result.id);
      }
    }

    setSaving(false);
    if (result.success) {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    }
  };

  // Preview — generates PDF and shows in iframe overlay (same as InvoiceEditor)
  const handlePreview = async () => {
    setGenerating(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { WeeklyReportPDFDocument } = await import("./WeeklyReportPDFDocument");

      const meetingDateStr = meetingDate.trim()
        ? new Date(meetingDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";
      const createdDateStr = report?.created_date
        ? new Date(report.created_date).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" })
        : new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" });

      const sections = [
        { label: "本期已完成工作", content: formData.zc_completed_work },
        { label: "下期工作", content: formData.zd_next_week_work },
        { label: "後加項目 (需報價)", content: formData.ze_additional_items },
        { label: "急需客人確定的項目", content: formData.zf_urgent_client_confirm },
        { label: "現場更改項目", content: formData.zg_site_changes },
        { label: "影響交場日的因素", content: formData.zh_factors_affecting_handover },
        { label: "整體工地時間表", content: formData.zi_overall_site_schedule },
        { label: "付款時間表", content: formData.zj_payment_schedule },
      ];

      const blob = await pdf(
        WeeklyReportPDFDocument({
          projectName: displayProjectName.trim() || normalizeReportProjectName(projectName) || "",
          projectCode: projectCode || "",
          pmName: pmName || "",
          designerName: designerName || "",
          weekNumber,
          meetingDate: meetingDateStr,
          createdDate: createdDateStr,
          meetingTeam: formData.za_meeting_team || "",
          keyFocus: formData.zb_key_focus || "",
          sections,
          appendix: formData.zk_appendix || "",
          costCentre,
        })
      ).toBlob();

      // Revoke old URL if any
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err: any) {
      console.error("PDF preview error:", err);
    } finally {
      setGenerating(false);
    }
  };

  // Download PDF — also persist generated file back to storage for re-download
  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { WeeklyReportPDFDocument } = await import("./WeeklyReportPDFDocument");

      const meetingDateStr = meetingDate.trim()
        ? new Date(meetingDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";
      const createdDateStr = report?.created_date
        ? new Date(report.created_date).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" })
        : new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" });

      const sections = [
        { label: "本期已完成工作", content: formData.zc_completed_work },
        { label: "下期工作", content: formData.zd_next_week_work },
        { label: "後加項目 (需報價)", content: formData.ze_additional_items },
        { label: "急需客人確定的項目", content: formData.zf_urgent_client_confirm },
        { label: "現場更改項目", content: formData.zg_site_changes },
        { label: "影響交場日的因素", content: formData.zh_factors_affecting_handover },
        { label: "整體工地時間表", content: formData.zi_overall_site_schedule },
        { label: "付款時間表", content: formData.zj_payment_schedule },
      ];

      const blob = await pdf(
        WeeklyReportPDFDocument({
          projectName: displayProjectName.trim() || normalizeReportProjectName(projectName) || "",
          projectCode: projectCode || "",
          pmName: pmName || "",
          designerName: designerName || "",
          weekNumber,
          meetingDate: meetingDateStr,
          createdDate: createdDateStr,
          meetingTeam: formData.za_meeting_team || "",
          keyFocus: formData.zb_key_focus || "",
          sections,
          appendix: formData.zk_appendix || "",
          costCentre,
        })
      ).toBlob();

      const downloadName = `10_Day_Report_${tenDayPeriodLabel(weekNumber, "en").replace(" ", "")}_${projectCode || "project"}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Persist generated PDF so the list "download" button works later
      const persistResult = await persistWeeklyReportPdf(projectId, weekNumber, blob, {
        reportId: activeReportId,
        meetingDate: meetingDate.trim() || null,
        reportName: report?.report_name || tenDayReportName(weekNumber),
        contentFields: {
          za_meeting_team: formData.za_meeting_team || null,
          zb_key_focus: formData.zb_key_focus || null,
          zc_completed_work: formData.zc_completed_work || null,
          zd_next_week_work: formData.zd_next_week_work || null,
          ze_additional_items: formData.ze_additional_items || null,
          zf_urgent_client_confirm: formData.zf_urgent_client_confirm || null,
          zg_site_changes: formData.zg_site_changes || null,
          zh_factors_affecting_handover: formData.zh_factors_affecting_handover || null,
          zi_overall_site_schedule: formData.zi_overall_site_schedule || null,
          zj_payment_schedule: formData.zj_payment_schedule || null,
          zk_appendix: formData.zk_appendix || null,
          display_project_name: displayProjectName.trim() || null,
        },
      });
      if (persistResult.success) {
        if (persistResult.id) setActiveReportId(persistResult.id);
        if (persistResult.url) {
          setReport((prev) =>
            prev
              ? { ...prev, file: persistResult.url!, id: persistResult.id || prev.id }
              : prev
          );
        }
        onSaved();
      } else {
        console.error("Persist PDF error:", persistResult.error);
      }
    } catch (err: any) {
      console.error("PDF download error:", err);
    } finally {
      setGenerating(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ─── RENDER ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">載入報告內容...</span>
      </div>
    );
  }

  const dateRange = `${weekStart.toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
  })} — ${weekEnd.toLocaleDateString("zh-HK", { month: "short", day: "numeric" })}`;

  return (
    <>
    {/* PDF Preview Modal — portaled to document.body for true full-screen */}
    {showPreview && previewUrl && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center">
        <div className="bg-white w-full h-full flex flex-col">
          {/* Preview header — same style as Invoice/Receipt */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              10日報告預覽 10 Day&apos;s Report Preview
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleDownloadPDF}
                disabled={generating}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                下載 PDF
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setShowPreview(false);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {/* PDF iframe — full remaining height */}
          <div className="flex-1 overflow-hidden">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="10 Day's Report PDF Preview"
            />
          </div>
        </div>
      </div>,
      document.body
    )}

    <div className="flex items-start gap-4">
    <div className={cn("min-w-0 flex-1 space-y-4", aiOpen && "pb-[58vh] lg:pb-0")}>
      {/* Header - Row 1: Title + Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
          {tenDayPeriodLabel(weekNumber, "en")} - 工地會議報告
          <Badge className="text-[12px] px-1.5 py-0.5 bg-blue-100 text-blue-700 border-0">
            {dateRange}
          </Badge>
        </h3>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已儲存
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-[13px]",
              aiOpen && "border-violet-300 bg-violet-50 text-violet-700"
            )}
            onClick={() => setAiOpen((open) => !open)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 填寫
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            onClick={handlePreview}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            預覽 PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            onClick={handleDownloadPDF}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            下載
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            儲存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Header - Row 2: Editable report project title + meta */}
      <div className="space-y-2 -mt-1">
        <div className="flex items-start gap-2">
          <label className="text-[11px] text-gray-400 uppercase tracking-wide pt-1.5 shrink-0 w-[72px]">
            項目 Project
          </label>
          <input
            type="text"
            value={displayProjectName}
            onChange={(e) => {
              setDisplayProjectName(e.target.value);
              setSaved(false);
            }}
            placeholder="報告顯示用項目名稱（不寫回項目資料）"
            className="flex-1 min-w-0 text-[15px] font-semibold text-gray-800 border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs pl-[80px]">
          {projectCode && (
            <span className="text-gray-500 font-mono">{projectCode}</span>
          )}
          {pmName && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">PM: {pmName}</span>
            </>
          )}
          {designerName && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">設計師: {designerName}</span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500">會議日期:</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => { setMeetingDate(e.target.value); setSaved(false); }}
              className="text-xs text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Report Sections */}
      <div className="space-y-3">
        {SECTIONS.map((sec) => {
          const colors = colorMap[sec.color] || colorMap.gray;
          const isCollapsed = collapsed.has(sec.key);

          return (
            <div
              key={sec.key}
              className={cn(
                "border rounded-lg overflow-hidden transition-all",
                colors.border,
                highlighted.has(sec.key) && "ring-2 ring-violet-300"
              )}
            >
              {/* Section Header */}
              <button
                type="button"
                onClick={() => toggleCollapsed(sec.key)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                  colors.bg
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("text-[14px] font-semibold", colors.text)}>
                    {sec.label}
                  </span>
                  <span className="text-[12px] text-gray-400">{sec.sublabel}</span>
                </div>
                {isCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>

              {/* Section Content */}
              {!isCollapsed && (
                <div className="p-3 bg-white">
                  {sec.isRichText ? (
                    <RichTextEditor
                      key={`${sec.key}-${aiEditorEpoch}`}
                      content={formData[sec.key] || ""}
                      onChange={(html) => updateField(sec.key, html)}
                      placeholder={`輸入${sec.label}內容...`}
                      minHeight="100px"
                    />
                  ) : (
                    /* Meeting Team — plain textarea with comma-separated names */
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-400 mb-1.5">
                        <Users className="w-3 h-3" />
                        <span>輸入參與人員名稱（以逗號分隔）</span>
                      </div>
                      <textarea
                        value={formData[sec.key] || ""}
                        onChange={(e) => updateField(sec.key, e.target.value)}
                        placeholder="例: 陳大文, 李小明, John Wong"
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[15px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className="text-[12px] text-gray-400">
          所有變更需按「儲存」才會保存到資料庫
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            onClick={handlePreview}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            預覽 PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[13px]"
            onClick={handleDownloadPDF}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            下載 PDF
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            儲存報告
          </Button>
        </div>
      </div>
    </div>
    {aiOpen && (
      <div className="fixed inset-x-0 bottom-0 z-40 h-[55vh] overflow-hidden border-t border-violet-100 bg-white shadow-lg lg:sticky lg:top-0 lg:inset-auto lg:z-auto lg:h-[calc(100vh-140px)] lg:w-[380px] lg:shrink-0 lg:rounded-lg lg:border lg:shadow-sm">
        <WeeklyReportAiChat
          projectId={projectId}
          weekNumber={weekNumber}
          weekStart={weekStart}
          weekEnd={weekEnd}
          meetingDate={meetingDate}
          projectName={displayProjectName || projectName}
          projectCode={projectCode}
          pmName={pmName}
          designerName={designerName}
          currentFields={formData}
          onApply={handleAiApply}
          onClose={() => setAiOpen(false)}
        />
      </div>
    )}
    </div>
    </>
  );
}
