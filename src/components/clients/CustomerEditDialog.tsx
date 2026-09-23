"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  Plus,
  Edit2,
  AlertTriangle,
  Upload,
  X,
  ImageIcon,
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
  createCustomer,
  updateCustomer,
  uploadCustomerLogo,
  fetchTagCollectionsAll,
  fetchCustomerTagsGrouped,
  saveCustomerTags,
  type TagCollection,
  type CustomerTagEntry,
} from "@/lib/data-service";
import { useCustomerPhoneDuplicateCheck } from "@/hooks/use-customer-phone-duplicate-check";
import { DuplicateWarning } from "@/components/suppliers/DuplicateWarning";
import {
  CUSTOMER_RECORD_STATUSES,
  CUSTOMER_RECORD_STATUS_LABELS,
  type CustomerRecordStatus,
} from "@/lib/customer-record-status";

// ─── TYPES ─────────────────────────────────────────
export interface CustomerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass null for create mode, or a customer object for edit mode */
  customer: {
    id: string;
    customer_name?: string | null;
    display_name?: string | null;
    company_name?: string | null;
    brand_name_cn?: string | null;
    brand_name_en?: string | null;
    email?: string | null;
    phone_display?: string | null;
    phone_number_a?: string | null;
    phone_number_b?: string | null;
    address?: string | null;
    tags?: string | null;
    view_system?: string | null;
    remark?: string | null;
    asana?: string | null;
    enquiry_create_date?: string | null;
    created_date?: string | null;
    branding_icon?: string | null;
    status?: string | null;
  } | null;
  /**
   * Called after a successful save.
   * In create mode, passes the new customer id + display label so callers
   * (e.g. pitching dialogs) can select the newly created customer.
   */
  onSaved: (created?: { id: string; label: string }) => void;
}

const EMPTY_FORM = {
  customer_name: "",
  display_name: "",
  company_name: "",
  brand_name_cn: "",
  brand_name_en: "",
  email: "",
  phone_display: "",
  phone_number_a: "",
  phone_number_b: "",
  address: "",
  tags: "",
  view_system: "",
  remark: "",
  asana: "",
  enquiry_create_date: new Date().toISOString().split("T")[0],
  status: "Active",
};

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function CustomerEditDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: CustomerEditDialogProps) {
  const isCreateMode = customer === null;

  // ─── FORM STATE ──────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── TAG STATE ──────────────────────────────────
  const [tagCollections, setTagCollections] = useState<TagCollection[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [existingCustomerTags, setExistingCustomerTags] = useState<CustomerTagEntry[]>([]);
  const [tagSearch, setTagSearch] = useState("");

  // ─── LOGO STATE ──────────────────────────────────
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Phone duplicate check — exclude current customer when editing
  const phoneDuplicateCheck = useCustomerPhoneDuplicateCheck({
    excludeId: customer?.id,
  });

  // ─── INITIALIZE FORM ON OPEN ──────────────────────────────────
  const initializeForm = useCallback(async () => {
    setError(null);
    setTagSearch("");
    setLogoFile(null);
    setUploadingLogo(false);

    if (isCreateMode) {
      setForm(EMPTY_FORM);
      setSelectedTagIds(new Set());
      setExistingCustomerTags([]);
      setLogoPreview(null);
    } else {
      setForm({
        customer_name: customer.customer_name || "",
        display_name: customer.display_name || "",
        company_name: customer.company_name || "",
        brand_name_cn: customer.brand_name_cn || "",
        brand_name_en: customer.brand_name_en || "",
        email: customer.email || "",
        phone_display: customer.phone_display || "",
        phone_number_a: customer.phone_number_a || "",
        phone_number_b: customer.phone_number_b || "",
        address: customer.address || "",
        tags: customer.tags || "",
        view_system: (() => {
          const vs = customer.view_system || "";
          if (vs === "PMS") return "BWA";
          if (vs === "BWF2") return "BWF";
          if (vs === "PMS,BWF2" || vs === "BWF2,PMS") return "Both";
          return vs;
        })(),
        remark: customer.remark || "",
        asana: customer.asana || "",
        status: customer.status || "Active",
        enquiry_create_date: customer.enquiry_create_date
          ? new Date(customer.enquiry_create_date).toISOString().split("T")[0]
          : customer.created_date
          ? new Date(customer.created_date).toISOString().split("T")[0]
          : "",
      });
      setLogoPreview(customer.branding_icon || null);

      // Load existing tags for this customer
      const { customerTags } = await fetchCustomerTagsGrouped(customer.id);
      setExistingCustomerTags(customerTags);
      setSelectedTagIds(new Set(customerTags.map((ct) => ct.tag_uuid)));
    }

    // Load tag collections
    const collections = await fetchTagCollectionsAll();
    setTagCollections(collections);
  }, [customer, isCreateMode]);

  useEffect(() => {
    if (open) {
      phoneDuplicateCheck.reset();
      initializeForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open, initializeForm]);

  // ─── HELPERS ──────────────────────────────────
  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (
      field === "phone_display" ||
      field === "phone_number_a" ||
      field === "phone_number_b"
    ) {
      phoneDuplicateCheck.checkPhone(field, value);
    }
  };

  const toggleTag = (tagId: string, collectionId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      const collection = tagCollections.find((c) => c.id === collectionId);
      if (collection?.isSingleSelect) {
        collection.tags.forEach((t) => next.delete(t.id));
      }
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // ─── VALIDATION ──────────────────────────────────
  // All fields marked with * in the form are required (create AND edit).
  const validateRequired = (): string | null => {
    if (!form.view_system.trim()) return "檢示系統 View System 為必填";
    if (!form.display_name.trim()) return "顯示名稱 Display Name 為必填";
    if (!form.company_name.trim()) return "公司名稱 Company Name 為必填";
    if (!form.customer_name.trim()) return "聯絡人名稱 Customer Name 為必填";
    if (!form.phone_display.trim()) return "主要電話號碼 Primary Phone 為必填";
    if (!form.enquiry_create_date.trim()) return "查詢日期 Enquiry Date 為必填";
    // Industry Tag — the single-select tag collection must have a selection.
    const industryCollection = tagCollections.find((c) => c.isSingleSelect);
    const hasIndustryTag = industryCollection
      ? industryCollection.tags.some((t) => selectedTagIds.has(t.id))
      : true; // if no industry collection exists, don't block
    if (!hasIndustryTag) return "客戶產業 Industry Tag 為必填";
    return null;
  };

  // ─── SAVE HANDLER ──────────────────────────────────
  const handleSave = async () => {
    const validationError = validateRequired();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (phoneDuplicateCheck.isBlocked) {
      setError("此電話號碼已被其他客戶使用，無法提交");
      return;
    }

    if (isCreateMode) {
      // CREATE MODE
      setSaving(true);
      setError(null);
      const result = await createCustomer(form);
      if (result.success && result.id) {
        // Save selected tags for the new customer
        if (selectedTagIds.size > 0) {
          const toAdd = Array.from(selectedTagIds)
            .map((tagId) => {
              const collection = tagCollections.find((c) =>
                c.tags.some((t) => t.id === tagId)
              );
              return { tag_uuid: tagId, collection_uuid: collection?.id || "" };
            })
            .filter((t) => t.collection_uuid);
          await saveCustomerTags(result.id, toAdd, []);
        }

        // Upload logo if selected during create
        if (logoFile && result.id) {
          await uploadCustomerLogo(result.id, logoFile);
        }

        setSaving(false);
        onOpenChange(false);
        onSaved({
          id: result.id,
          label: form.display_name.trim() || form.customer_name.trim(),
        });
      } else {
        setSaving(false);
        setError(result.error || "建立失敗");
      }
    } else {
      // EDIT MODE
      setSaving(true);
      setError(null);

      // Upload logo if a new file was selected
      let brandingIconUrl: string | undefined = undefined;
      if (logoFile) {
        setUploadingLogo(true);
        const uploadResult = await uploadCustomerLogo(customer.id, logoFile);
        setUploadingLogo(false);
        if (!uploadResult.success) {
          setSaving(false);
          setError(uploadResult.error || "商標上傳失敗");
          return;
        }
        brandingIconUrl = uploadResult.url;
      } else if (logoPreview === null && customer.branding_icon) {
        // User removed the logo
        brandingIconUrl = "";
      }

      const payload = {
        ...form,
        ...(brandingIconUrl !== undefined ? { branding_icon: brandingIconUrl } : {}),
      };
      const result = await updateCustomer(customer.id, payload);
      if (result.success) {
        // Calculate tag diffs
        const oldTagIds = new Set(existingCustomerTags.map((ct) => ct.tag_uuid));
        const toAdd = Array.from(selectedTagIds)
          .filter((id) => !oldTagIds.has(id))
          .map((tagId) => {
            const collection = tagCollections.find((c) =>
              c.tags.some((t) => t.id === tagId)
            );
            return { tag_uuid: tagId, collection_uuid: collection?.id || "" };
          })
          .filter((t) => t.collection_uuid);
        const toRemove = existingCustomerTags
          .filter((ct) => !selectedTagIds.has(ct.tag_uuid))
          .map((ct) => ct.id);
        if (toAdd.length > 0 || toRemove.length > 0) {
          await saveCustomerTags(customer.id, toAdd, toRemove);
        }
        setSaving(false);
        onOpenChange(false);
        onSaved();
      } else {
        setSaving(false);
        setError(result.error || "儲存失敗");
      }
    }
  };

  // ─── RENDER ──────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreateMode ? (
              <>
                <Plus className="w-5 h-5 text-bw-violet" />
                新增客戶
              </>
            ) : (
              <>
                <Edit2 className="w-5 h-5 text-bw-blue" />
                編輯客戶
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* ── Branding Icon (公司商標) ──────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              公司商標 Business Logo
            </Label>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                {logoPreview ? (
                  <>
                    <img
                      src={logoPreview.startsWith("//") ? `https:${logoPreview}` : logoPreview}
                      alt="商標預覽"
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden flex-col items-center justify-center w-full h-full">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                      <span className="text-[12px] text-gray-400 mt-0.5">載入失敗</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview(null);
                        setLogoFile(null);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                    <span className="text-[12px] text-gray-400 mt-0.5">無商標</span>
                  </div>
                )}
              </div>
              {/* Upload button */}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  選擇圖片
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400">
                  支援 JPG / PNG / SVG / WebP，建議 200×200 以上
                </p>
                {uploadingLogo && (
                  <p className="text-xs text-blue-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> 上傳中...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── View System Toggle ──────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              檢示系統 View System<span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              {(
                [
                  { label: "BWA", value: "BWA" },
                  { label: "BWF", value: "BWF" },
                  { label: "Both", value: "Both" },
                ] as const
              ).map((sys) => (
                <button
                  key={sys.value}
                  type="button"
                  onClick={() =>
                    updateField("view_system", form.view_system === sys.value ? "" : sys.value)
                  }
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    form.view_system === sys.value
                      ? sys.value === "BWA"
                        ? "bg-blue-500 text-white border-blue-500"
                        : sys.value === "BWF"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-violet-500 text-white border-violet-500"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {sys.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Account Status Toggle ──────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              帳戶狀態 Account Status
            </Label>
            <div className="flex gap-2">
              {CUSTOMER_RECORD_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField("status", s)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    form.status === s
                      ? s === "Active"
                        ? "bg-green-600 text-white border-green-600"
                        : s === "Blacklist"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-gray-600 text-white border-gray-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {CUSTOMER_RECORD_STATUS_LABELS[s as CustomerRecordStatus]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Display Name ──────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">
              顯示名稱 Display Name<span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-blue-500">
              ⓘ 此欄位用於搜尋用途，請加入更多說明以便日後搜尋
            </p>
            <Input
              value={form.display_name}
              onChange={(e) => updateField("display_name", e.target.value)}
              placeholder="Display Name"
            />
          </div>

          {/* ── Company Name + Customer Name ──────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                公司(商業登記)名稱 Company Name<span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="Company Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                聯絡人名稱 Customer Name<span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.customer_name}
                onChange={(e) => updateField("customer_name", e.target.value)}
                placeholder="Customer Name"
              />
            </div>
          </div>

          {/* ── Brand Name ──────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">此客戶是否為知明品牌?</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">
                  知名品牌名稱(中文) Brand Name (Chinese)
                </Label>
                <Input
                  value={form.brand_name_cn}
                  onChange={(e) => updateField("brand_name_cn", e.target.value)}
                  placeholder="Chinese Brand Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">
                  知名品牌名稱(英文) Brand Name (English)
                </Label>
                <Input
                  value={form.brand_name_en}
                  onChange={(e) => updateField("brand_name_en", e.target.value)}
                  placeholder="English Brand Name"
                />
              </div>
            </div>
          </div>

          {/* ── Phone + Email Row ──────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                主要電話號碼 Primary Phone<span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.phone_display}
                onChange={(e) => updateField("phone_display", e.target.value)}
                placeholder="Primary Phone"
              />
              <DuplicateWarning
                result={phoneDuplicateCheck.phoneDisplayResult}
                fieldLabel="主要電話"
                entityLabel="客戶"
                isPhoneField
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                後備電話號碼 Secondary Phone
              </Label>
              <Input
                value={form.phone_number_a}
                onChange={(e) => updateField("phone_number_a", e.target.value)}
                placeholder="Secondary Phone"
              />
              <DuplicateWarning
                result={phoneDuplicateCheck.phoneNumberAResult}
                fieldLabel="後備電話"
                entityLabel="客戶"
                isPhoneField
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">電郵 Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="Email"
              />
            </div>
          </div>

          {/* ── Asana + Industry Tag + Enquiry Date ──────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">Asana 連結</Label>
              <Input
                value={form.asana}
                onChange={(e) => updateField("asana", e.target.value)}
                placeholder="Asana Link"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                客戶產業 Industry Tag<span className="text-red-500">*</span>
              </Label>
              {(() => {
                const industryCollection = tagCollections.find((c) => c.isSingleSelect);
                const selectedIndustryTag = industryCollection?.tags.find((t) =>
                  selectedTagIds.has(t.id)
                );
                return (
                  <Select
                    value={selectedIndustryTag?.id || "none"}
                    onValueChange={(v) => {
                      if (!industryCollection) return;
                      setSelectedTagIds((prev) => {
                        const next = new Set(prev);
                        industryCollection.tags.forEach((t) => next.delete(t.id));
                        if (v !== "none") next.add(v);
                        return next;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an option..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose an option...</SelectItem>
                      {industryCollection?.tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.display}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                查詢日期 Enquiry Date<span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.enquiry_create_date}
                onChange={(e) => updateField("enquiry_create_date", e.target.value)}
              />
            </div>
          </div>

          {/* ── Address + Remarks ──────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">通訊地址 Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Address"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">備註 Remarks</Label>
              <Textarea
                value={form.remark}
                onChange={(e) => updateField("remark", e.target.value)}
                placeholder="Remarks"
                rows={3}
              />
            </div>
          </div>

          {/* ── Customer Tags Section ──────────────────── */}
          <div className="border-t pt-4 space-y-4">
            <Label className="text-sm font-semibold text-gray-700">客戶標籤 Customer Tag</Label>
            {tagCollections
              .filter((c) => !c.isSingleSelect)
              .map((collection) => (
                <div key={collection.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">
                      {collection.display}
                    </Label>
                    <span className="text-xs text-gray-400">
                      {collection.tags.filter((t) => selectedTagIds.has(t.id)).length} 已選
                    </span>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        placeholder="Search / Create a customer tags"
                        className="pl-8 h-8 text-xs"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto">
                      {collection.tags
                        .filter(
                          (t) =>
                            !tagSearch ||
                            t.display.toLowerCase().includes(tagSearch.toLowerCase())
                        )
                        .map((tag) => (
                          <label
                            key={tag.id}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                              selectedTagIds.has(tag.id)
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                selectedTagIds.has(tag.id)
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300"
                              }`}
                              onClick={() => toggleTag(tag.id, collection.id)}
                            >
                              {selectedTagIds.has(tag.id) && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span onClick={() => toggleTag(tag.id, collection.id)}>
                              {tag.display}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || phoneDuplicateCheck.isBlocked}
            className={isCreateMode ? "bg-bw-violet hover:bg-bw-violet/90" : "bg-bw-blue hover:bg-bw-blue/90"}
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
