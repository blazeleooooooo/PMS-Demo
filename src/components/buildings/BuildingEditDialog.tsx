"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBuilding,
  updateBuilding,
  fetchDistrictOptions,
  type BuildingRow,
  type LinkOption,
} from "@/lib/data-service";

export interface BuildingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass null for create mode, or a building object for edit mode */
  building: BuildingRow | null;
  /**
   * Called after a successful save.
   * In create mode, passes the new building id + display label so callers
   * (e.g. pitching/project dialogs) can select the newly created building.
   */
  onSaved: (created?: { id: string; label: string }) => void;
}

const EMPTY_FORM = {
  building_name: "",
  building_name_eng: "",
  address: "",
  address_eng: "",
  district: "",
  first_contact: "",
  second_contact: "",
  third_contact: "",
  delivery_note: "",
  guideline: "",
  noisy_control: "",
  vetting_approval_time: "",
  x_night_works: "",
  x_comment: "",
  remarks: "",
};

function buildingLabel(form: typeof EMPTY_FORM): string {
  return form.building_name.trim() || form.building_name_eng.trim() || "未命名大廈";
}

export default function BuildingEditDialog({
  open,
  onOpenChange,
  building,
  onSaved,
}: BuildingEditDialogProps) {
  const isCreateMode = building === null;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [districtOpts, setDistrictOpts] = useState<LinkOption[]>([]);

  const initializeForm = useCallback(() => {
    setError(null);
    if (isCreateMode) {
      setForm(EMPTY_FORM);
    } else {
      setForm({
        building_name: building.building_name || "",
        building_name_eng: building.building_name_eng || "",
        address: building.address || "",
        address_eng: building.address_eng || "",
        district: building.district || "",
        first_contact: building.first_contact || "",
        second_contact: building.second_contact || "",
        third_contact: building.third_contact || "",
        delivery_note: building.delivery_note || "",
        guideline: building.guideline || "",
        noisy_control: building.noisy_control || "",
        vetting_approval_time: building.vetting_approval_time || "",
        x_night_works: building.x_night_works || "",
        x_comment: building.x_comment || "",
        remarks: building.remarks || "",
      });
    }
  }, [building, isCreateMode]);

  useEffect(() => {
    if (open) {
      initializeForm();
      fetchDistrictOptions().then(setDistrictOpts);
    }
  }, [open, initializeForm]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.building_name.trim() && !form.building_name_eng.trim()) {
      setError("大廈名稱為必填");
      return;
    }

    setSaving(true);
    setError(null);

    if (isCreateMode) {
      const result = await createBuilding(form);
      setSaving(false);
      if (result.success && result.id) {
        onSaved({ id: result.id, label: buildingLabel(form) });
        onOpenChange(false);
      } else {
        setError(result.error || "建立失敗");
      }
    } else {
      const result = await updateBuilding(building.id, form);
      setSaving(false);
      if (result.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(result.error || "更新失敗");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreateMode ? (
              <>
                <Plus className="w-5 h-5 text-bw-blue" />
                新增大廈
              </>
            ) : (
              <>
                <Edit2 className="w-5 h-5 text-bw-blue" />
                編輯大廈
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">大廈名稱 (中文) <span className="text-red-500">*</span></Label>
            <Input
              value={form.building_name}
              onChange={(e) => updateField("building_name", e.target.value)}
              placeholder="大廈中文名稱"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Building Name (Eng)</Label>
            <Input
              value={form.building_name_eng}
              onChange={(e) => updateField("building_name_eng", e.target.value)}
              placeholder="English Name"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-medium">地址 (中文)</Label>
            <Input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="中文地址"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-medium">Address (Eng)</Label>
            <Input
              value={form.address_eng}
              onChange={(e) => updateField("address_eng", e.target.value)}
              placeholder="English Address"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">地區</Label>
            {districtOpts.length > 0 ? (
              <Select
                value={form.district || "none"}
                onValueChange={(v) => updateField("district", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇地區" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未指定</SelectItem>
                  {districtOpts.map((d) => (
                    <SelectItem key={d.id} value={d.label}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.district}
                onChange={(e) => updateField("district", e.target.value)}
                placeholder="地區"
              />
            )}
          </div>

          <div className="col-span-2 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              聯絡資訊
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">第一聯絡人</Label>
            <Input
              value={form.first_contact}
              onChange={(e) => updateField("first_contact", e.target.value)}
              placeholder="姓名 / 電話"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">第二聯絡人</Label>
            <Input
              value={form.second_contact}
              onChange={(e) => updateField("second_contact", e.target.value)}
              placeholder="姓名 / 電話"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">第三聯絡人</Label>
            <Input
              value={form.third_contact}
              onChange={(e) => updateField("third_contact", e.target.value)}
              placeholder="姓名 / 電話"
            />
          </div>

          <div className="col-span-2 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              大廈管控
            </p>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-medium">送貨備註</Label>
            <Textarea
              value={form.delivery_note}
              onChange={(e) => updateField("delivery_note", e.target.value)}
              placeholder="送貨注意事項..."
              rows={2}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-medium">大廈指引</Label>
            <Textarea
              value={form.guideline}
              onChange={(e) => updateField("guideline", e.target.value)}
              placeholder="大廈規則/指引..."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">噪音管控</Label>
            <Input
              value={form.noisy_control}
              onChange={(e) => updateField("noisy_control", e.target.value)}
              placeholder="噪音管控要求"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">審批時間</Label>
            <Input
              value={form.vetting_approval_time}
              onChange={(e) => updateField("vetting_approval_time", e.target.value)}
              placeholder="審批所需時間"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">夜間工程</Label>
            <Input
              value={form.x_night_works}
              onChange={(e) => updateField("x_night_works", e.target.value)}
              placeholder="夜間工程規定"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">備註</Label>
            <Input
              value={form.x_comment}
              onChange={(e) => updateField("x_comment", e.target.value)}
              placeholder="備註"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm font-medium">其他備註</Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => updateField("remarks", e.target.value)}
              placeholder="其他備註..."
              rows={2}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-bw-blue hover:bg-bw-blue/90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : isCreateMode ? (
              <Plus className="w-4 h-4 mr-1.5" />
            ) : (
              <Edit2 className="w-4 h-4 mr-1.5" />
            )}
            {isCreateMode ? "建立" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
