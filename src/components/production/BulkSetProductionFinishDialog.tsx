"use client";

import React, { useEffect, useState } from "react";
import { CalendarCheck, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { bulkUpdateBWFOrdersProductionFinish } from "@/lib/data-service";

const STATUS_OPTIONS = [
  "Awaiting Installation",
  "Upcoming Deliveries",
  "In Production",
  "Overdue Production",
  "Completed",
];

const STATUS_LABELS: Record<string, string> = {
  "Awaiting Installation": "待安裝 Awaiting Installation",
  "Upcoming Deliveries": "準備送貨 Upcoming Deliveries",
  "In Production": "生產中 In Production",
  "Overdue Production": "過期生產 Overdue Production",
  Completed: "已完成 Completed",
};

interface BulkSetProductionFinishDialogProps {
  open: boolean;
  orderIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BulkSetProductionFinishDialog({
  open,
  orderIds,
  onClose,
  onSaved,
}: BulkSetProductionFinishDialogProps) {
  const [productionFinishDate, setProductionFinishDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("Upcoming Deliveries");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProductionFinishDate("");
    setOrderStatus("Upcoming Deliveries");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    if (!productionFinishDate) {
      setError("請填寫實際生產完結日期 Please enter actual finish date");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await bulkUpdateBWFOrdersProductionFinish(orderIds, {
      production_finish_date: productionFinishDate,
      o_order_status: orderStatus,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
            實際生產完結日期 Actual Finish Date
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500 -mt-2">
          將更新已選的 {orderIds.length} 筆訂單的實際生產完結日期及狀態。
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm leading-tight block">
              <span className="text-gray-500">實際生產完結日期</span>
              <span className="block font-medium text-emerald-600">Actual Finish Date</span>
            </Label>
            <Input
              type="date"
              value={productionFinishDate}
              onChange={(e) => setProductionFinishDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">訂單狀態 Order Status</Label>
            <Select value={orderStatus} onValueChange={setOrderStatus}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s] || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> 取消
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSave}
            disabled={saving || orderIds.length === 0}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            確認設定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
