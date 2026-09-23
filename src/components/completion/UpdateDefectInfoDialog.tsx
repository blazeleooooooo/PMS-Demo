"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  fetchCompletionDefectOrderDetail,
  fetchDefectCauseOptions,
  updateCompletionDefectOrder,
  type DefectCauseOption,
} from "@/lib/data-service";
import {
  DEFECT_SOURCE_OPTIONS,
  DEFECT_STATUS_OPTIONS,
} from "@/lib/bwf-defect-options";

const EMPTY = "__empty__";

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  return value.trim() ? value : null;
}

interface UpdateDefectInfoDialogProps {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UpdateDefectInfoDialog({
  open,
  orderId,
  onClose,
  onSaved,
}: UpdateDefectInfoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleLabel, setTitleLabel] = useState("");
  const [causeOptions, setCauseOptions] = useState<DefectCauseOption[]>([]);

  const [defectStatus, setDefectStatus] = useState("");
  const [defectSource, setDefectSource] = useState("");
  const [defectCauseId, setDefectCauseId] = useState("");
  const [defectNotes, setDefectNotes] = useState("");
  const [defectFixedDate, setDefectFixedDate] = useState("");

  useEffect(() => {
    if (!open || !orderId) return;
    setError(null);
    setLoading(true);

    Promise.all([fetchCompletionDefectOrderDetail(orderId), fetchDefectCauseOptions()])
      .then(([detail, causes]) => {
        setCauseOptions(causes);
        if (!detail) {
          setError("找不到訂單 Order not found");
          return;
        }
        const label = detail.project_code || detail.product_name || "訂單";
        setTitleLabel(label);
        setDefectStatus(detail.o_defect_status || "");
        setDefectSource(detail.o_defect_source || "");
        setDefectCauseId(detail.n_defect_cause_id || "");
        setDefectNotes(detail.defect_notes || "");
        setDefectFixedDate(toDateInput(detail.defect_fixed_date));
      })
      .finally(() => setLoading(false));
  }, [open, orderId]);

  const handleSave = async () => {
    if (!orderId) return;
    setSaving(true);
    setError(null);
    const result = await updateCompletionDefectOrder(orderId, {
      o_defect_status: defectStatus || null,
      o_defect_source: defectSource || null,
      n_defect_cause_id: defectCauseId || null,
      defect_notes: defectNotes.trim() || null,
      defect_fixed_date: fromDateInput(defectFixedDate),
    });
    setSaving(false);
    if (result.success) {
      onSaved();
      onClose();
    } else {
      setError(result.error || "更新失敗 Update failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Update Defect Info for {titleLabel}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">執漏狀態</span>
                <span className="block font-medium">Defect Status</span>
              </Label>
              <Select
                value={defectStatus || EMPTY}
                onValueChange={(v) => setDefectStatus(v === EMPTY ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Choose an option...</SelectItem>
                  {DEFECT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.labelZh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">事件責任</span>
                <span className="block font-medium">Responsibility Taker</span>
              </Label>
              <Select
                value={defectSource || EMPTY}
                onValueChange={(v) => setDefectSource(v === EMPTY ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Choose an option...</SelectItem>
                  {DEFECT_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.labelZh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">執漏成因</span>
                <span className="block font-medium">Cause of Defect</span>
              </Label>
              <Select
                value={defectCauseId || EMPTY}
                onValueChange={(v) => setDefectCauseId(v === EMPTY ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY}>Choose an option...</SelectItem>
                  {causeOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">執漏記錄 / 發生情況</span>
                <span className="block font-medium">Defect Notes / Happening Situation</span>
              </Label>
              <Textarea
                value={defectNotes}
                onChange={(e) => setDefectNotes(e.target.value)}
                placeholder="e.g. Customer reported a scratch on main desk surface..."
                rows={4}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">安排維修日期</span>
                <span className="block font-medium">Planned Fix Date</span>
              </Label>
              <Input
                type="date"
                value={defectFixedDate}
                onChange={(e) => setDefectFixedDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !orderId}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
