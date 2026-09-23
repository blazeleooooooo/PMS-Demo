"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import type {
  SiteStatusSection,
  SiteStatusQuestion,
  SiteStatusOption,
  AnswerType,
  QuestionConfig,
} from "@/types/site-status";
import {
  fetchQuestionnaireAdmin,
  fetchQuoteProjectTypes,
  createSection,
  updateSection,
  deleteSection,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  createOption,
  updateOption,
  deleteOption,
  setQuestionProjectTypes,
} from "@/lib/site-status-service";

// ─── Answer-type metadata ─────────────────────────────────
const ANSWER_TYPES: { value: AnswerType; label: string; hasOptions: boolean; hasArea?: boolean }[] = [
  { value: "text", label: "單行文字 Text", hasOptions: false },
  { value: "textarea", label: "多行文字 Textarea", hasOptions: false },
  { value: "number", label: "數字 Number", hasOptions: false },
  { value: "date", label: "日期 Date", hasOptions: false },
  { value: "yes_no", label: "是/否 Yes/No", hasOptions: false },
  { value: "single_select", label: "單選 Single select", hasOptions: true },
  { value: "multi_select", label: "多選 Multi select", hasOptions: true },
  { value: "quantity_list", label: "數量清單 Quantity list", hasOptions: true },
  { value: "select_with_area", label: "選項 + 範圍 Select with area", hasOptions: true, hasArea: true },
];

function typeMeta(t: AnswerType) {
  return ANSWER_TYPES.find((a) => a.value === t) ?? ANSWER_TYPES[0];
}

export default function SiteStatusQuestionnaireSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<SiteStatusSection[]>([]);
  const [questions, setQuestions] = useState<SiteStatusQuestion[]>([]);
  const [quoteTypes, setQuoteTypes] = useState<{ id: string; name: string }[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Section dialog
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; editing: SiteStatusSection | null }>({
    open: false,
    editing: null,
  });
  // Question dialog
  const [questionDialog, setQuestionDialog] = useState<{
    open: boolean;
    sectionId: string | null;
    editing: SiteStatusQuestion | null;
  }>({ open: false, sectionId: null, editing: null });
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "section"; row: SiteStatusSection }
    | { kind: "question"; row: SiteStatusQuestion }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ sections: secs, questions: qs }, qt] = await Promise.all([
      fetchQuestionnaireAdmin(),
      fetchQuoteProjectTypes(),
    ]);
    setSections(secs);
    setQuestions(qs);
    setQuoteTypes(qt);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const questionsBySection = useCallback(
    (sectionId: string) => questions.filter((q) => q.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order),
    [questions]
  );

  // ── Delete handler ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "section") {
      const childCount = questions.filter((q) => q.section_id === deleteTarget.row.id).length;
      if (childCount > 0) {
        toast({ title: "無法刪除", description: `此分區仍有 ${childCount} 條問題，請先移除問題。`, variant: "destructive" });
        setDeleteTarget(null);
        return;
      }
      const { error } = await deleteSection(deleteTarget.row.id);
      if (error) toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    } else {
      const { error } = await deleteQuestion(deleteTarget.row.id);
      if (error) toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    }
    setDeleteTarget(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-bw-blue mr-2" />
        <span className="text-sm text-gray-500">載入問卷設定...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          管理工地狀況問卷的分區、問題與選項。每條問題可指定適用的報價項目類型（不選 = 適用全部）。
        </p>
        <Button
          size="sm"
          onClick={() => setSectionDialog({ open: true, editing: null })}
          className="h-8 text-xs bg-bw-blue hover:bg-bw-blue/90"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新增分區
        </Button>
      </div>

      {sections.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">尚未有任何分區，請先新增分區。</div>
      )}

      {sections
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((section) => {
          const isOpen = expanded[section.id] ?? true;
          const secQuestions = questionsBySection(section.id);
          return (
            <Card key={section.id} className="border border-gray-100 shadow-sm">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [section.id]: !isOpen }))}
                    className="flex items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    {section.icon && (
                      <span
                        className="text-base leading-none"
                        style={{
                          fontFamily:
                            '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif',
                        }}
                      >
                        {section.icon}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-800">{section.title_zh}</span>
                    {!section.is_active && (
                      <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-400 border-gray-200">
                        停用
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                      {secQuestions.length} 題
                    </Badge>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuestionDialog({ open: true, sectionId: section.id, editing: null })}
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSectionDialog({ open: true, editing: section })}
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeleteTarget({ kind: "section", row: section })}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isOpen && (
                <CardContent className="pt-0 pb-3 px-4 space-y-1.5">
                  {secQuestions.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">此分區尚未有問題。</p>
                  ) : (
                    secQuestions.map((q) => {
                      const meta = typeMeta(q.answer_type);
                      const typeNames = (q.projectTypeIds ?? [])
                        .map((id) => quoteTypes.find((t) => t.id === id)?.name)
                        .filter(Boolean);
                      return (
                        <div
                          key={q.id}
                          className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-100 bg-white hover:bg-gray-50/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-medium text-gray-700 truncate">
                                  {q.label_zh}
                                </span>
                                {q.is_required && <span className="text-red-500 text-xs">*</span>}
                                {!q.is_active && (
                                  <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-400 border-gray-200">
                                    停用
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-gray-400">{meta.label}</span>
                                {meta.hasOptions && (
                                  <span className="text-[11px] text-gray-300">· {q.options?.length ?? 0} 選項</span>
                                )}
                                <span className="text-[11px] text-gray-300">·</span>
                                <span className="text-[11px] text-teal-600 truncate">
                                  {typeNames.length === 0 ? "全部類型" : typeNames.join("、")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setQuestionDialog({ open: true, sectionId: section.id, editing: q })}
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteTarget({ kind: "question", row: q })}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

      {/* Section dialog */}
      {sectionDialog.open && (
        <SectionDialog
          editing={sectionDialog.editing}
          nextSort={sections.length}
          onClose={() => setSectionDialog({ open: false, editing: null })}
          onSaved={async () => {
            setSectionDialog({ open: false, editing: null });
            await load();
          }}
        />
      )}

      {/* Question dialog */}
      {questionDialog.open && questionDialog.sectionId && (
        <QuestionDialog
          sectionId={questionDialog.sectionId}
          editing={questionDialog.editing}
          quoteTypes={quoteTypes}
          nextSort={questionsBySection(questionDialog.sectionId).length}
          onClose={() => setQuestionDialog({ open: false, sectionId: null, editing: null })}
          onSaved={async () => {
            setQuestionDialog({ open: false, sectionId: null, editing: null });
            await load();
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "section"
                ? `確定要刪除分區「${deleteTarget?.row && (deleteTarget.row as SiteStatusSection).title_zh}」嗎？`
                : `確定要刪除問題「${deleteTarget?.row && (deleteTarget.row as SiteStatusQuestion).label_zh}」嗎？此問題的所有選項及已填寫答案將一併刪除。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Section dialog
// ═══════════════════════════════════════════════════════════
function SectionDialog({
  editing,
  nextSort,
  onClose,
  onSaved,
}: {
  editing: SiteStatusSection | null;
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [titleZh, setTitleZh] = useState(editing?.title_zh ?? "");
  const [titleEn, setTitleEn] = useState(editing?.title_en ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? nextSort + 1);
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);

  const handleSave = async () => {
    if (!titleZh.trim()) {
      toast({ title: "錯誤", description: "分區名稱不能為空", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title_zh: titleZh.trim(),
      title_en: titleEn.trim() || null,
      icon: icon.trim() || null,
      sort_order: sortOrder,
      is_active: isActive,
    };
    const { error } = editing
      ? await updateSection(editing.id, payload)
      : await createSection(payload);
    setSaving(false);
    if (error) {
      toast({ title: "儲存失敗", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "已更新" : "已新增", description: `分區「${titleZh}」` });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "編輯分區" : "新增分區"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">名稱 <span className="text-red-500">*</span></Label>
            <Input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">圖示 (emoji)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="h-9" placeholder="🏗️" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">排序</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs text-gray-500">啟用</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-9">
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-bw-blue hover:bg-bw-blue/90">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Question dialog
// ═══════════════════════════════════════════════════════════
interface DraftOption {
  id?: string; // existing option id
  label_zh: string;
  label_en: string;
  sort_order: number;
}

function QuestionDialog({
  sectionId,
  editing,
  quoteTypes,
  nextSort,
  onClose,
  onSaved,
}: {
  sectionId: string;
  editing: SiteStatusQuestion | null;
  quoteTypes: { id: string; name: string }[];
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [labelZh, setLabelZh] = useState(editing?.label_zh ?? "");
  const [labelEn, setLabelEn] = useState(editing?.label_en ?? "");
  const [answerType, setAnswerType] = useState<AnswerType>(editing?.answer_type ?? "text");
  const [isRequired, setIsRequired] = useState(editing?.is_required ?? false);
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(editing?.sort_order ?? nextSort + 1);

  const cfg: QuestionConfig = editing?.config ?? {};
  const [placeholder, setPlaceholder] = useState(cfg.placeholder ?? "");
  const [unit, setUnit] = useState(cfg.unit ?? "");
  const [areaOptionsText, setAreaOptionsText] = useState((cfg.areaOptions ?? []).join("\n"));

  const [options, setOptions] = useState<DraftOption[]>(
    (editing?.options ?? []).map((o) => ({
      id: o.id,
      label_zh: o.label_zh,
      label_en: o.label_en ?? "",
      sort_order: o.sort_order,
    }))
  );
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(editing?.projectTypeIds ?? []);

  const meta = typeMeta(answerType);

  const addOption = () =>
    setOptions((prev) => [...prev, { label_zh: "", label_en: "", sort_order: prev.length + 1 }]);
  const updateOpt = (i: number, patch: Partial<DraftOption>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const removeOpt = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!labelZh.trim()) {
      toast({ title: "錯誤", description: "問題名稱不能為空", variant: "destructive" });
      return;
    }
    if (meta.hasOptions && options.filter((o) => o.label_zh.trim()).length === 0) {
      toast({ title: "錯誤", description: "此問題類型需要至少一個選項", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Build config.
    const newConfig: QuestionConfig = {};
    if (placeholder.trim()) newConfig.placeholder = placeholder.trim();
    if (answerType === "number" && unit.trim()) newConfig.unit = unit.trim();
    if (answerType === "select_with_area") {
      const areas = areaOptionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (areas.length) newConfig.areaOptions = areas;
    }

    try {
      // 1. Upsert the question row.
      let questionId = editing?.id;
      if (editing) {
        const { error } = await updateQuestion(editing.id, {
          label_zh: labelZh.trim(),
          label_en: labelEn.trim() || null,
          answer_type: answerType,
          config: newConfig,
          sort_order: sortOrder,
          is_required: isRequired,
          is_active: isActive,
        } as Partial<SiteStatusQuestion>);
        if (error) throw error;
      } else {
        const { data, error } = await createQuestion({
          section_id: sectionId,
          label_zh: labelZh.trim(),
          label_en: labelEn.trim() || null,
          answer_type: answerType,
          config: newConfig,
          sort_order: sortOrder,
          is_required: isRequired,
        });
        if (error) throw error;
        questionId = (data as SiteStatusQuestion).id;
      }
      if (!questionId) throw new Error("找不到問題 ID");

      // 2. Sync options (only for option-bearing types).
      if (meta.hasOptions) {
        const existingIds = new Set((editing?.options ?? []).map((o) => o.id));
        const keptIds = new Set<string>();
        for (let i = 0; i < options.length; i++) {
          const o = options[i];
          if (!o.label_zh.trim()) continue;
          if (o.id) {
            keptIds.add(o.id);
            const { error } = await updateOption(o.id, {
              label_zh: o.label_zh.trim(),
              label_en: o.label_en.trim() || null,
              sort_order: i + 1,
            });
            if (error) throw error;
          } else {
            const { error } = await createOption({
              question_id: questionId,
              label_zh: o.label_zh.trim(),
              label_en: o.label_en.trim() || null,
              sort_order: i + 1,
            });
            if (error) throw error;
          }
        }
        // Delete removed options.
        for (const id of existingIds) {
          if (id && !keptIds.has(id)) await deleteOption(id);
        }
      }

      // 3. Sync project-type mapping.
      const res = await setQuestionProjectTypes(questionId, selectedTypeIds);
      if (!res.success) throw new Error(res.error);

      toast({ title: editing ? "已更新" : "已新增", description: `問題「${labelZh}」` });
      onSaved();
    } catch (err: any) {
      toast({ title: "儲存失敗", description: err?.message ?? "未知錯誤", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
          <DialogTitle>{editing ? "編輯問題" : "新增問題"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500 mb-1 block">問題 <span className="text-red-500">*</span></Label>
              <Input value={labelZh} onChange={(e) => setLabelZh(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">答案類型 <span className="text-red-500">*</span></Label>
              <Select value={answerType} onValueChange={(v) => setAnswerType(v as AnswerType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">排序</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>

          {/* Type-specific config */}
          {(answerType === "text" || answerType === "textarea") && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">提示文字 Placeholder</Label>
              <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="h-9" />
            </div>
          )}
          {answerType === "number" && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">單位 Unit (例如 mm、米)</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="h-9 w-40" />
            </div>
          )}
          {answerType === "select_with_area" && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">範圍選項 (每行一個，例如 全場 / 大部分 / 少量)</Label>
              <textarea
                value={areaOptionsText}
                onChange={(e) => setAreaOptionsText(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-bw-blue/30"
              />
            </div>
          )}

          {/* Options editor */}
          {meta.hasOptions && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-gray-500">選項</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addOption}>
                  <Plus className="w-3 h-3 mr-1" />
                  新增選項
                </Button>
              </div>
              <div className="space-y-1.5">
                {options.length === 0 && <p className="text-xs text-gray-400">尚未有選項。</p>}
                {options.map((o, i) => (
                  <div key={o.id ?? `new-${i}`} className="flex items-center gap-2">
                    <Input
                      value={o.label_zh}
                      onChange={(e) => updateOpt(i, { label_zh: e.target.value })}
                      placeholder="中文名稱"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={o.label_en}
                      onChange={(e) => updateOpt(i, { label_en: e.target.value })}
                      placeholder="English"
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeOpt(i)}>
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project-type assignment */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">
              適用報價項目類型（不選 = 適用全部類型）
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {quoteTypes.length === 0 && (
                <p className="text-xs text-gray-400">沒有報價項目類型。</p>
              )}
              {quoteTypes.map((t) => {
                const sel = selectedTypeIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedTypeIds((prev) =>
                        sel ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                      )
                    }
                    className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-all ${
                      sel
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <Label className="text-xs text-gray-500">必填</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-xs text-gray-500">啟用</Label>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-9">
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-bw-blue hover:bg-bw-blue/90">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
