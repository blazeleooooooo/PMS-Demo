"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save, X, Truck } from "lucide-react";
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
import {
  bulkUpdateBWFOrdersDelivery,
  fetchWarehouseSupplierOptions,
  type LinkOption,
} from "@/lib/data-service";

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

interface ArrangeDeliveryDialogProps {
  open: boolean;
  orderIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ArrangeDeliveryDialog({
  open,
  orderIds,
  onClose,
  onSaved,
}: ArrangeDeliveryDialogProps) {
  const [warehouseId, setWarehouseId] = useState("");
  const [siteArrivalDate, setSiteArrivalDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("Awaiting Installation");
  const [warehouseOptions, setWarehouseOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId("");
    setSiteArrivalDate("");
    setOrderStatus("Awaiting Installation");
    setError(null);
    setLoading(true);
    fetchWarehouseSupplierOptions()
      .then(setWarehouseOptions)
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!warehouseId) {
      setError("請選擇集運倉 Please select a warehouse");
      return;
    }
    if (!siteArrivalDate) {
      setError("請填寫送貨日期（到達工地）Please enter site arrival date");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await bulkUpdateBWFOrdersDelivery(orderIds, {
      warehouse_id: warehouseId,
      site_arrival_date: siteArrivalDate,
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
            <Truck className="w-5 h-5 text-blue-600" />
            安排送貨 Arrange Delivery
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500 -mt-2">
          將更新已選的 {orderIds.length} 筆訂單的集運倉、送貨日期及狀態。
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">集運倉 Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="選擇集運倉..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouseOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">實際送貨日期(到達工地)</span>
                <span className="block font-medium text-blue-600">Site Arrival Date</span>
              </Label>
              <Input
                type="date"
                value={siteArrivalDate}
                onChange={(e) => setSiteArrivalDate(e.target.value)}
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> 取消
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving || loading || orderIds.length === 0}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            確認安排
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
