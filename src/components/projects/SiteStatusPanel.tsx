"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  Check,
  Plus,
  Minus,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";

import type {
  SiteStatus,
  SiteStatusQuestion,
  QuestionnaireSection,
  AnswerValue,
  QuantityEntry,
  AreaEntry,
} from "@/types/site-status";
import {
  fetchSiteStatus,
  fetchSiteStatusByPitching,
  fetchEntityQuoteProjectTypeId,
  fetchQuestionnaire,
  fetchAnswers,
  upsertSiteStatus,
  saveAnswers,
} from "@/lib/site-status-service";

// ─── Props ─────────────────────────────────────────────────
interface SiteStatusPanelProps {
  projectId: string;
  entityType?: "project" | "pitching";
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
}

// ─── Answer "is filled" helper ─────────────────────────────
function isFilled(v: AnswerValue | undefined): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export default function SiteStatusPanel({
  projectId,
  entityType = "project",
  permissionModule = "projects",
}: SiteStatusPanelProps) {
  const { toast } = useToast();
  const { canEdit: canEditPerm } = usePermission();
  const _canEdit = canEditPerm(permissionModule);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  // ─── Load Data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ss, typeId] = await Promise.all([
        entityType === "pitching"
          ? fetchSiteStatusByPitching(projectId)
          : fetchSiteStatus(projectId),
        fetchEntityQuoteProjectTypeId(projectId, entityType),
      ]);
      setSiteStatus(ss);

      const [questionnaire, savedAnswers] = await Promise.all([
        fetchQuestionnaire(typeId),
        ss ? fetchAnswers(ss.id) : Promise.resolve({} as Record<string, AnswerValue>),
      ]);

      setSections(questionnaire);
      setAnswers(savedAnswers);
      setDirty(false);

      // Expand the first section by default.
      if (questionnaire.length > 0) {
        setExpandedSections({ [questionnaire[0].id]: true });
      }
    } catch (err) {
      console.error("Failed to load site status:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setDirty(true);
  }, []);

  // ─── Save All ───────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure the parent row exists.
      let ss = siteStatus;
      if (!ss) {
        ss = await upsertSiteStatus(projectId, entityType);
        if (!ss) {
          toast({ title: "儲存失敗", description: "無法建立工地狀況記錄", variant: "destructive" });
          return;
        }
        setSiteStatus(ss);
      }

      const result = await saveAnswers(ss.id, answers);
      if (!result.success) {
        toast({ title: "儲存失敗", description: result.error || "未知錯誤", variant: "destructive" });
        return;
      }

      setDirty(false);
      toast({ title: "已儲存", description: "工地狀況資料已成功更新" });
      await loadData();
    } catch (err: any) {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">載入工地狀況資料...</span>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        此項目類型尚未設定任何工地狀況問題。
        <div className="text-xs text-gray-300 mt-1">
          請於「設定 → 工地狀況問卷」新增問題，或為項目選擇報價項目類型。
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[12px] ${
              siteStatus
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            {siteStatus ? "已填寫" : "未填寫"}
          </Badge>
          {dirty && (
            <Badge variant="outline" className="text-[12px] bg-amber-50 text-amber-700 border-amber-200">
              未儲存更改
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={saving} className="h-8 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            重新載入
          </Button>
          {_canEdit && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              儲存
            </Button>
          )}
        </div>
      </div>

      {/* Sections Accordion */}
      {sections.map((section) => {
        const isExpanded = !!expandedSections[section.id];
        return (
          <Card key={section.id} className="border border-gray-100 shadow-sm overflow-hidden">
            <CardHeader
              className="py-3 px-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {section.icon && (
                    <div
                      className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-base leading-none"
                      style={{
                        fontFamily:
                          '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif',
                      }}
                    >
                      {section.icon}
                    </div>
                  )}
                  <CardTitle className="text-sm font-semibold text-gray-800">{section.title_zh}</CardTitle>
                  <SectionCompletionBadge section={section} answers={answers} />
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4">
                <Separator className="mb-4" />
                <div className="space-y-5">
                  {section.questions.map((question) => (
                    <QuestionInput
                      key={question.id}
                      question={question}
                      value={answers[question.id]}
                      disabled={!_canEdit}
                      onChange={(v) => setAnswer(question.id, v)}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Sticky Save Footer */}
      {dirty && _canEdit && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 p-3 -mx-4 flex items-center justify-between rounded-b-lg">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">有未儲存的更改</span>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            儲存所有更改
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section Completion Badge ─────────────────────────────
function SectionCompletionBadge({
  section,
  answers,
}: {
  section: QuestionnaireSection;
  answers: Record<string, AnswerValue>;
}) {
  const total = section.questions.length;
  const filled = section.questions.filter((q) => isFilled(answers[q.id])).length;
  if (filled === 0) return null;
  return (
    <Badge
      variant="outline"
      className={`text-[11px] ${
        filled === total
          ? "bg-green-50 text-green-600 border-green-200"
          : "bg-blue-50 text-blue-600 border-blue-200"
      }`}
    >
      {filled}/{total}
    </Badge>
  );
}

// ─── Per-answer-type input dispatcher ─────────────────────
function QuestionInput({
  question,
  value,
  disabled,
  onChange,
}: {
  question: SiteStatusQuestion;
  value: AnswerValue | undefined;
  disabled: boolean;
  onChange: (v: AnswerValue) => void;
}) {
  const options = question.options ?? [];
  const cfg = question.config ?? {};

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-2 block">
        {question.label_zh}
        {question.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* TEXT */}
      {question.answer_type === "text" && (
        <Input
          value={(value as string) ?? ""}
          disabled={disabled}
          placeholder={cfg.placeholder}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 text-[13px]"
        />
      )}

      {/* TEXTAREA */}
      {question.answer_type === "textarea" && (
        <Textarea
          value={(value as string) ?? ""}
          disabled={disabled}
          placeholder={cfg.placeholder}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-[13px] min-h-[72px]"
        />
      )}

      {/* NUMBER */}
      {question.answer_type === "number" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value == null ? "" : (value as number)}
            disabled={disabled}
            min={cfg.min}
            max={cfg.max}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === "" ? null : Number(raw));
            }}
            className="h-8 text-[13px] w-32"
          />
          {cfg.unit && <span className="text-[13px] text-gray-400">{cfg.unit}</span>}
        </div>
      )}

      {/* DATE */}
      {question.answer_type === "date" && (
        <Input
          type="date"
          value={(value as string) ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 text-[13px] w-44"
        />
      )}

      {/* YES / NO */}
      {question.answer_type === "yes_no" && (
        <div className="flex gap-1.5">
          {[
            { label: "是", v: true },
            { label: "否", v: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value === opt.v ? null : opt.v)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-all ${
                value === opt.v
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* SINGLE SELECT */}
      {question.answer_type === "single_select" && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const selected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(selected ? null : opt.id)}
                className={`px-2.5 py-1.5 rounded-md text-[13px] font-medium border transition-all ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                {selected && <Check className="w-3 h-3 inline mr-1" />}
                {opt.label_zh}
              </button>
            );
          })}
        </div>
      )}

      {/* MULTI SELECT */}
      {question.answer_type === "multi_select" && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const selected = arr.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = selected ? arr.filter((x) => x !== opt.id) : [...arr, opt.id];
                  onChange(next);
                }}
                className={`px-2.5 py-1.5 rounded-md text-[13px] font-medium border transition-all ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                {selected && <Check className="w-3 h-3 inline mr-1" />}
                {opt.label_zh}
              </button>
            );
          })}
        </div>
      )}

      {/* QUANTITY LIST */}
      {question.answer_type === "quantity_list" && (
        <QuantityListInput
          options={options}
          value={Array.isArray(value) ? (value as QuantityEntry[]) : []}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {/* SELECT WITH AREA */}
      {question.answer_type === "select_with_area" && (
        <SelectWithAreaInput
          options={options}
          areaOptions={cfg.areaOptions ?? []}
          value={Array.isArray(value) ? (value as AreaEntry[]) : []}
          disabled={disabled}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// ─── Quantity list (option + numeric qty) ─────────────────
function QuantityListInput({
  options,
  value,
  disabled,
  onChange,
}: {
  options: SiteStatusQuestion["options"];
  value: QuantityEntry[];
  disabled: boolean;
  onChange: (v: AnswerValue) => void;
}) {
  const qtyById = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of value) m.set(e.option_id, e.qty);
    return m;
  }, [value]);

  const setQty = (optionId: string, qty: number) => {
    const next = value.filter((e) => e.option_id !== optionId);
    if (qty > 0) next.push({ option_id: optionId, qty });
    onChange(next);
  };

  if (!options || options.length === 0) {
    return <div className="text-[13px] text-gray-400 italic py-2">沒有可選項目</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((item) => {
        const qty = qtyById.get(item.id) ?? 0;
        return (
          <div
            key={item.id}
            className={`flex items-center justify-between px-3 py-2 rounded-md border transition-all ${
              qty > 0 ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-white"
            }`}
          >
            <span className="text-[13px] text-gray-700 font-medium truncate mr-2">{item.label_zh}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                disabled={disabled || qty <= 0}
                onClick={() => setQty(item.id, Math.max(0, qty - 1))}
                className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-40"
              >
                <Minus className="w-3 h-3" />
              </button>
              <Input
                type="number"
                value={qty}
                disabled={disabled}
                onChange={(e) => setQty(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-12 h-6 text-center text-[13px] font-mono px-1 border-gray-200"
                min={0}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setQty(item.id, qty + 1)}
                className="w-6 h-6 rounded flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Select-with-area (toggle option + area dropdown) ─────
function SelectWithAreaInput({
  options,
  areaOptions,
  value,
  disabled,
  onChange,
}: {
  options: SiteStatusQuestion["options"];
  areaOptions: string[];
  value: AreaEntry[];
  disabled: boolean;
  onChange: (v: AnswerValue) => void;
}) {
  const byId = useMemo(() => {
    const m = new Map<string, AreaEntry>();
    for (const e of value) m.set(e.option_id, e);
    return m;
  }, [value]);

  const toggle = (optionId: string) => {
    if (byId.has(optionId)) onChange(value.filter((e) => e.option_id !== optionId));
    else onChange([...value, { option_id: optionId, area: null }]);
  };
  const setArea = (optionId: string, area: string) => {
    onChange(value.map((e) => (e.option_id === optionId ? { ...e, area } : e)));
  };

  if (!options || options.length === 0) {
    return <div className="text-[13px] text-gray-400 italic py-2">沒有可選項目</div>;
  }

  return (
    <div className="space-y-2">
      {options.map((item) => {
        const entry = byId.get(item.id);
        const isActive = !!entry;
        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${
              isActive ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-white"
            }`}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggle(item.id)}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                isActive ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 hover:border-blue-400"
              }`}
            >
              {isActive && <Check className="w-3 h-3" />}
            </button>
            <span className="text-[13px] text-gray-700 font-medium flex-1 truncate">{item.label_zh}</span>
            {isActive && areaOptions.length > 0 && (
              <Select value={entry?.area || ""} disabled={disabled} onValueChange={(v) => setArea(item.id, v)}>
                <SelectTrigger className="w-24 h-7 text-[12px] border-gray-200">
                  <SelectValue placeholder="範圍" />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((area) => (
                    <SelectItem key={area} value={area} className="text-[13px]">
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </div>
  );
}
