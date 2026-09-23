"use client";

import React, { useEffect, useState } from "react";
import { HardHat, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  bulkUpdateBWFOrdersInstallation,
  fetchInstallationTeamOptions,
  type LinkOption,
} from "@/lib/data-service";
import { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";

const COMPLETION_STATUS_OPTIONS = [
  "Completed",
  "Awaiting Installation",
];

interface AssignInstallationDialogProps {
  open: boolean;
  orderIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignInstallationDialog({
  open,
  orderIds,
  onClose,
  onSaved,
}: AssignInstallationDialogProps) {
  const [installationTeamId, setInstallationTeamId] = useState("");
  const [installationCompleted, setInstallationCompleted] = useState(false);
  const [completeInstallationDate, setCompleteInstallationDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("Completed");
  const [teamOptions, setTeamOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInstallationTeamId("");
    setInstallationCompleted(false);
    setCompleteInstallationDate("");
    setOrderStatus("Completed");
    setError(null);
    setLoading(true);
    fetchInstallationTeamOptions()
      .then(setTeamOptions)
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!installationTeamId) {
      setError("請選擇安裝團隊 Please select an installation team");
      return;
    }
    if (installationCompleted) {
      if (!completeInstallationDate) {
        setError("請填寫完成安裝日期 Please enter complete installation date");
        return;
      }
      if (!orderStatus) {
        setError("請選擇訂單狀態 Please select order status");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const result = await bulkUpdateBWFOrdersInstallation(orderIds, {
      installation_team_id: installationTeamId,
      installation_completed: installationCompleted,
      complete_installation_date: installationCompleted ? completeInstallationDate : undefined,
      o_order_status: installationCompleted ? orderStatus : undefined,
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
            <HardHat className="w-5 h-5 text-violet-600" />
            安排安裝 Assign Installation
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500 -mt-2">
          將更新已選的 {orderIds.length} 筆訂單的安裝團隊。
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">安裝團隊 Installation Team</Label>
              <Select value={installationTeamId} onValueChange={setInstallationTeamId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="選擇安裝團隊..." />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
              <div>
                <Label className="text-sm font-medium">安裝已完成？</Label>
                <p className="text-xs text-gray-500">Is installation completed?</p>
              </div>
              <Switch
                checked={installationCompleted}
                onCheckedChange={setInstallationCompleted}
              />
            </div>

            {installationCompleted && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm leading-tight block">
                    <span className="text-gray-500">完成安裝(完成項目)日期</span>
                    <span className="block font-medium text-violet-600">Complete Installation Date</span>
                  </Label>
                  <Input
                    type="date"
                    value={completeInstallationDate}
                    onChange={(e) => setCompleteInstallationDate(e.target.value)}
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
                      {COMPLETION_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {getOrderStatusChinese(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

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
            className="bg-violet-600 hover:bg-violet-700"
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
