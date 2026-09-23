"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, Info, Loader2, Save, X } from "lucide-react";
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
import { bulkUpdateBWFOrdersInitialDates } from "@/lib/data-service";

const STATUS_OPTIONS = [
  "Pending Orders",
  "Unpaid Deposits",
  "In Production",
  "Overdue Production",
  "Upcoming Deliveries",
  "Awaiting Installation",
  "Overdue Payment (>90 days)",
  "Confirmed - Unordered",
  "Completed",
];

const STATUS_LABELS: Record<string, string> = {
  "Pending Orders": "待下單 Pending Orders",
  "Unpaid Deposits": "未付訂金 Unpaid Deposits",
  "In Production": "生產中 In Production",
  "Overdue Production": "過期生產 Overdue Production",
  "Upcoming Deliveries": "準備送貨 Upcoming Deliveries",
  "Awaiting Installation": "待安裝 Awaiting Installation",
  "Overdue Payment (>90 days)": "付款逾期 (>90天) Overdue Payment (>90 days)",
  "Confirmed - Unordered": "已取消訂單 Confirmed - Unordered",
  Completed: "已完成 Completed",
};

const DELIVERY_TARGETS = ["Factory", "Warehouse", "Client"];
const DELIVERY_LABELS: Record<string, string> = {
  Factory: "廠商 Factory",
  Warehouse: "倉庫 Warehouse",
  Client: "客戶 Client",
};

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DateField({
  labelZh,
  labelEn,
  color,
  value,
  onChange,
  required,
}: {
  labelZh: string;
  labelEn: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm leading-tight block">
        <span className="text-gray-500">
          {labelZh}
          {required && <span className="text-red-500">*</span>}
        </span>
        <span className={`block font-medium ${color}`}>{labelEn}</span>
      </Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );
}

export interface BulkAssignOrderPreview {
  id: string;
  product_name: string | null;
  factory_name: string | null;
}

interface BWFBulkAssignInitialDateDialogProps {
  open: boolean;
  orders: BulkAssignOrderPreview[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BWFBulkAssignInitialDateDialog({
  open,
  orders,
  onClose,
  onSaved,
}: BWFBulkAssignInitialDateDialogProps) {
  const [productionFinishDateEst, setProductionFinishDateEst] = useState("");
  const [siteArrivalDateEst, setSiteArrivalDateEst] = useState("");
  const [completeInstallationDateEst, setCompleteInstallationDateEst] = useState("");
  const [productionStartDate, setProductionStartDate] = useState("");
  const [productionFinishDate, setProductionFinishDate] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState("");
  const [orderStatus, setOrderStatus] = useState("In Production");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = todayISODate();
    setProductionFinishDateEst(today);
    setSiteArrivalDateEst(today);
    setCompleteInstallationDateEst(today);
    setProductionStartDate(today);
    setProductionFinishDate(today);
    setDeliveryTarget("");
    setOrderStatus("In Production");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    const missing: string[] = [];
    if (!productionFinishDateEst) missing.push("預計生產完結日期 Est. Finish Date");
    if (!siteArrivalDateEst) missing.push("預計送貨日期(到達工地) Est. Site Arrival");
    if (!completeInstallationDateEst) {
      missing.push("預計安裝(完成項目)日期 Est. Complete Installation");
    }
    if (!productionStartDate) missing.push("生產開始日期 Prod. Start Date");
    if (!deliveryTarget) missing.push("生產後送貨到 Factory Delivery Target");
    if (!orderStatus) missing.push("訂單狀態 Order Status");
    if (missing.length > 0) {
      setError(`請填寫以下欄位 Please fill in:\n${missing.join("\n")}`);
      return;
    }
    if (orders.length === 0) {
      setError("請先選取訂單 Please select orders first");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await bulkUpdateBWFOrdersInitialDates(
      orders.map((o) => o.id),
      {
        production_finish_date_est: productionFinishDateEst,
        site_arrival_date_est: siteArrivalDateEst,
        complete_installation_date_est: completeInstallationDateEst,
        production_start_date: productionStartDate,
        production_finish_date: productionFinishDate || null,
        o_delivery_target: deliveryTarget,
        o_order_status: orderStatus,
      },
    );
    setSaving(false);

    if (result.success) {
      onSaved();
      onClose();
    } else {
      setError(result.error || "更新失敗 Update failed");
    }
  };

  const statusLabel = STATUS_LABELS[orderStatus] || orderStatus;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            批量設定初始日期 Bulk Assign Initial Date
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            為所有選取的訂單設定: Setting for all selected orders:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DateField
              labelZh="預計生產完結日期"
              labelEn="Est. Finish Date"
              color="text-emerald-600"
              required
              value={productionFinishDateEst}
              onChange={setProductionFinishDateEst}
            />
            <DateField
              labelZh="預計送貨日期(到達工地)"
              labelEn="Est. Site Arrival"
              color="text-blue-600"
              required
              value={siteArrivalDateEst}
              onChange={setSiteArrivalDateEst}
            />
            <DateField
              labelZh="預計安裝(完成項目)日期"
              labelEn="Est. Complete Installation"
              color="text-violet-600"
              required
              value={completeInstallationDateEst}
              onChange={setCompleteInstallationDateEst}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DateField
              labelZh="生產開始日期"
              labelEn="Prod. Start Date"
              color="text-gray-700"
              required
              value={productionStartDate}
              onChange={setProductionStartDate}
            />
            <DateField
              labelZh="實際生產完結日期"
              labelEn="Actual Finish Date"
              color="text-emerald-600"
              value={productionFinishDate}
              onChange={setProductionFinishDate}
            />
            <div className="space-y-1.5">
              <Label className="text-sm leading-tight block">
                <span className="text-gray-500">
                  生產後送貨到<span className="text-red-500">*</span>
                </span>
                <span className="block font-medium text-gray-700">Factory Delivery Target</span>
              </Label>
              <Select value={deliveryTarget} onValueChange={setDeliveryTarget}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an option..." />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TARGETS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DELIVERY_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-gray-500 pt-1">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
              <span>已選訂單將更改為 &apos;{statusLabel}&apos;</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              選取的訂單 Selected Orders ({orders.length}):
            </Label>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 max-h-36 overflow-y-auto">
              {orders.length === 0 ? (
                <p className="text-sm text-gray-400">無選取訂單</p>
              ) : (
                <ul className="space-y-1">
                  {orders.map((o) => (
                    <li key={o.id} className="text-sm text-gray-700">
                      {[o.product_name || "—", o.factory_name].filter(Boolean).join(" - ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving || orders.length === 0}
          >
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
