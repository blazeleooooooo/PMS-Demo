"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type IncomeBelowEstimatedReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedLabel?: string;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
  onConfirm: () => void;
};

export function IncomeBelowEstimatedReasonField({
  value,
  onChange,
  error,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">
        收入少於預計之原因
        {required && <span className="text-red-500"> *</span>}
      </label>
      <Textarea
        placeholder="請說明項目收入總額少於預計收入的原因..."
        className="text-sm min-h-[88px] resize-y"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="text-[11px] text-red-500 mt-1">{error}</p>
      ) : (
        <p className="text-[11px] text-gray-500 mt-1">已填寫後不可清空</p>
      )}
    </div>
  );
}

export function IncomeBelowEstimatedReasonDialog({
  open,
  onOpenChange,
  estimatedLabel,
  value,
  error,
  onChange,
  onConfirm,
}: IncomeBelowEstimatedReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            收入總額少於預計收入
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            項目收入總額少於預計收入
            {estimatedLabel ? ` ${estimatedLabel}` : ""}
            ，請填寫原因後才能儲存。
          </p>
          <IncomeBelowEstimatedReasonField
            value={value}
            onChange={onChange}
            error={error}
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={onConfirm}>
            確認並儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
