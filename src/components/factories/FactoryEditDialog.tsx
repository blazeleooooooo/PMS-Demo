"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Edit2, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { updateFactory, type FactoryRow } from "@/lib/data-service";

export const FACTORY_LEVEL_OPTIONS = [
  { value: "1st Priority", label: "首選" },
  { value: "2nd Priority", label: "次選" },
  { value: "3rd Priority", label: "後備" },
  { value: "Black Listed", label: "黑名單" },
] as const;

export const DELIVERY_PERIOD_OPTIONS = ["現貨", "可定制", "按單生產"] as const;

export const PRODUCT_QUALITY_OPTIONS = [
  { value: "High", label: "高品質" },
  { value: "Standard", label: "標準" },
  { value: "Economic", label: "經濟型" },
  { value: "Low", label: "低品質" },
] as const;

export type ProductQualityValue = (typeof PRODUCT_QUALITY_OPTIONS)[number]["value"];

export interface FactoryFormState {
  factory_name: string;
  factory_eng_name: string;
  display_name: string;
  factory_code: string;
  category_ids: string[];
  location: string;
  status: string;
  priority: string;
  join_date: string;
  contact_person: string;
  phone: string;
  email: string;
  wechat: string;
  website: string;
  moq: string;
  delivery_periods: string[];
  delivery_days: string;
  manufacture_days: string;
  product_qualities: ProductQualityValue[];
  remarks: string;
  asana_link: string;
}

export function factoryRowToForm(
  factory: FactoryRow,
  categoryOptions: { id: string; name: string }[]
): FactoryFormState {
  const rawIds = (factory.key_product_categories || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const category_ids = rawIds.filter((id) =>
    categoryOptions.some((opt) => opt.id === id)
  );
  const delivery_periods = (factory.delivery_period || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is (typeof DELIVERY_PERIOD_OPTIONS)[number] =>
      DELIVERY_PERIOD_OPTIONS.includes(x as (typeof DELIVERY_PERIOD_OPTIONS)[number])
    );
  const product_qualities = (factory.product_quality || "")
    .split(",")
    .map((x) => x.trim())
    .map((x) =>
      PRODUCT_QUALITY_OPTIONS.find((o) => o.value.toLowerCase() === x.toLowerCase())?.value
    )
    .filter((x): x is ProductQualityValue => !!x);
  return {
    factory_name: factory.factory_name || "",
    factory_eng_name: factory.factory_eng_name || "",
    display_name: factory.display_name || "",
    factory_code: factory.factory_code || "",
    category_ids,
    location: factory.location || "",
    status: factory.status || "Active",
    priority: factory.priority || factory.real_level || "",
    join_date: factory.join_date || "",
    contact_person: factory.contact_person || "",
    phone: factory.phone || "",
    email: factory.email || "",
    wechat: factory.wechat || "",
    website: factory.website || "",
    moq: factory.moq || "",
    delivery_periods,
    delivery_days: factory.delivery_days || "",
    manufacture_days: factory.manufacture_days || "",
    product_qualities,
    remarks: factory.remarks || "",
    asana_link: factory.asana_link || "",
  };
}

export const EMPTY_FACTORY_FORM: FactoryFormState = {
  factory_name: "",
  factory_eng_name: "",
  display_name: "",
  factory_code: "",
  category_ids: [],
  location: "",
  status: "Active",
  priority: "",
  join_date: new Date().toISOString().split("T")[0],
  contact_person: "",
  phone: "",
  email: "",
  wechat: "",
  website: "",
  moq: "",
  delivery_periods: [],
  delivery_days: "",
  manufacture_days: "",
  product_qualities: [],
  remarks: "",
  asana_link: "",
};

export function formToFactoryPayload(form: FactoryFormState) {
  return {
    factory_name: form.factory_name.trim() || undefined,
    factory_eng_name: form.factory_eng_name.trim() || undefined,
    display_name: form.display_name.trim() || undefined,
    factory_code: form.factory_code.trim() || undefined,
    key_product_categories:
      form.category_ids.length > 0 ? form.category_ids.join(",") : undefined,
    location: form.location.trim() || undefined,
    status: form.status || "Active",
    priority: form.priority.trim() || undefined,
    join_date: form.join_date || undefined,
    contact_person: form.contact_person.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    wechat: form.wechat.trim() || undefined,
    website: form.website.trim() || undefined,
    moq: form.moq.trim() || undefined,
    delivery_period:
      form.delivery_periods.length > 0 ? form.delivery_periods.join(",") : undefined,
    delivery_days: form.delivery_days.trim() || undefined,
    manufacture_days: form.manufacture_days.trim() || undefined,
    product_quality:
      form.product_qualities.length > 0 ? form.product_qualities.join(",") : undefined,
    remarks: form.remarks.trim() || undefined,
    asana_link: form.asana_link.trim() || undefined,
  };
}

export function validateFactoryForm(form: FactoryFormState): string | null {
  if (!form.factory_code.trim()) return "工廠編號為必填";
  if (!form.factory_name.trim()) return "工廠中文名稱為必填";
  if (!form.factory_eng_name.trim()) return "工廠英文名稱為必填";
  if (!form.display_name.trim()) return "顯示名稱為必填";
  if (form.category_ids.length === 0) return "產品類型為必填（至少選擇一項）";
  if (!form.join_date.trim()) return "加入日期為必填";
  if (!form.status.trim()) return "狀態為必填";
  return null;
}

interface FactoryFormFieldsProps {
  form: FactoryFormState;
  setForm: React.Dispatch<React.SetStateAction<FactoryFormState>>;
  categoryOptions: { id: string; name: string }[];
  categorySearch: string;
  setCategorySearch: (value: string) => void;
}

export function FactoryFormFields({
  form,
  setForm,
  categoryOptions,
  categorySearch,
  setCategorySearch,
}: FactoryFormFieldsProps) {
  const filteredCategories = categoryOptions.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const toggleCategory = (id: string) => {
    setForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(id)
        ? prev.category_ids.filter((x) => x !== id)
        : [...prev.category_ids, id],
    }));
  };

  const toggleDeliveryPeriod = (option: string) => {
    setForm((prev) => ({
      ...prev,
      delivery_periods: prev.delivery_periods.includes(option)
        ? prev.delivery_periods.filter((x) => x !== option)
        : [...prev.delivery_periods, option],
    }));
  };

  const toggleProductQuality = (value: ProductQualityValue) => {
    setForm((prev) => ({
      ...prev,
      product_qualities: prev.product_qualities.includes(value)
        ? prev.product_qualities.filter((x) => x !== value)
        : [...prev.product_qualities, value],
    }));
  };

  return (
    <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="grid w-full grid-cols-3 shrink-0">
        <TabsTrigger value="basic">基本資料</TabsTrigger>
        <TabsTrigger value="contact">聯絡方式</TabsTrigger>
        <TabsTrigger value="other">其他</TabsTrigger>
      </TabsList>
      <div className="overflow-y-auto flex-1 py-4 pr-1">
        <TabsContent value="basic" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>工廠中文名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={form.factory_name}
                onChange={(e) => setForm((p) => ({ ...p, factory_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>工廠英文名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={form.factory_eng_name}
                onChange={(e) => setForm((p) => ({ ...p, factory_eng_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>顯示名稱 <span className="text-red-500">*</span></Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>工廠編號 <span className="text-red-500">*</span></Label>
              <Input
                value={form.factory_code}
                onChange={(e) => setForm((p) => ({ ...p, factory_code: e.target.value }))}
              />
            </div>
            <div>
              <Label>地點</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div>
              <Label>狀態 <span className="text-red-500">*</span></Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>評級</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {FACTORY_LEVEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        priority: p.priority === opt.value ? "" : opt.value,
                      }))
                    }
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm border transition-all",
                      form.priority === opt.value
                        ? "border-bw-amber bg-amber-50 text-bw-amber font-medium ring-1 ring-bw-amber"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>加入日期 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.join_date}
                onChange={(e) => setForm((p) => ({ ...p, join_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                產品類型（可多選） <span className="text-red-500">*</span>
              </Label>
              <span className="text-xs text-gray-400">{form.category_ids.length} 已選</span>
            </div>
            <div className="border rounded-lg p-3">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search / Create a product type"
                  className="pl-8 h-8 text-xs"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5 max-h-[180px] overflow-y-auto">
                {filteredCategories.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                      form.category_ids.includes(c.id)
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        form.category_ids.includes(c.id)
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                      onClick={() => toggleCategory(c.id)}
                    >
                      {form.category_ids.includes(c.id) && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="truncate" onClick={() => toggleCategory(c.id)}>{c.name}</span>
                  </label>
                ))}
                {categoryOptions.length === 0 && (
                  <span className="text-xs text-gray-400 col-span-4">載入中...</span>
                )}
                {categoryOptions.length > 0 && filteredCategories.length === 0 && (
                  <span className="text-xs text-gray-400 col-span-4">無符合的產品類型</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="contact" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>聯絡人</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
              />
            </div>
            <div>
              <Label>電話</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>電郵</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>微信</Label>
              <Input
                value={form.wechat}
                onChange={(e) => setForm((p) => ({ ...p, wechat: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>網站</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="other" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>MOQ</Label>
              <Input value={form.moq} onChange={(e) => setForm((p) => ({ ...p, moq: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>供貨方式（可多選）</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {DELIVERY_PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleDeliveryPeriod(opt)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm border transition-all",
                      form.delivery_periods.includes(opt)
                        ? "border-bw-amber bg-amber-50 text-bw-amber font-medium ring-1 ring-bw-amber"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>交貨天數</Label>
              <Input
                value={form.delivery_days}
                onChange={(e) => setForm((p) => ({ ...p, delivery_days: e.target.value }))}
              />
            </div>
            <div>
              <Label>生產天數</Label>
              <Input
                value={form.manufacture_days}
                onChange={(e) => setForm((p) => ({ ...p, manufacture_days: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>產品質量（可多選）</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PRODUCT_QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleProductQuality(opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm border transition-all",
                      form.product_qualities.includes(opt.value)
                        ? "border-bw-amber bg-amber-50 text-bw-amber font-medium ring-1 ring-bw-amber"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Asana 連結</Label>
              <Input
                value={form.asana_link}
                onChange={(e) => setForm((p) => ({ ...p, asana_link: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>備註</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

interface FactoryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factory: FactoryRow | null;
  categoryOptions: { id: string; name: string }[];
  onSaved: () => void;
}

export default function FactoryEditDialog({
  open,
  onOpenChange,
  factory,
  categoryOptions,
  onSaved,
}: FactoryEditDialogProps) {
  const [form, setForm] = useState<FactoryFormState>(EMPTY_FACTORY_FORM);
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && factory) {
      setForm(factoryRowToForm(factory, categoryOptions));
      setCategorySearch("");
      setError(null);
    }
  }, [open, factory, categoryOptions]);

  const handleSave = async () => {
    if (!factory) return;
    const validationError = validateFactoryForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateFactory(factory.id, formToFactoryPayload(form));
    setSaving(false);
    if (result.success) {
      onOpenChange(false);
      onSaved();
    } else {
      setError(result.error || "更新失敗");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-bw-amber" />
            編輯工廠
          </DialogTitle>
        </DialogHeader>
        <FactoryFormFields
          form={form}
          setForm={setForm}
          categoryOptions={categoryOptions}
          categorySearch={categorySearch}
          setCategorySearch={setCategorySearch}
        />
        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
