"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Edit2,
  Plus,
  Loader2,
  AlertTriangle,
  X,
  Search,
  Upload,
  ImageIcon,
  FileText,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createSupplier,
  updateSupplier,
  uploadSupplierNameCard,
  fetchSupplierTypes,
  type SupplierRow,
} from "@/lib/data-service";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { useSupplierDuplicateCheck } from "@/hooks/use-supplier-duplicate-check";
import { DuplicateWarning } from "@/components/suppliers/DuplicateWarning";

// ─── FORM TYPE ─────────────────────────────────────────
export interface SupplierEditForm {
  // Company Info
  name: string;
  display_name: string;
  chinese_name: string;
  account_description: string;
  n_type_ids: string[];
  district_id: string;
  status: string;
  account_status: string;
  // Contact Info
  email: string;
  phone: string;
  fax_no: string;
  address: string;
  website: string;
  contact_persons: string;
  // Contact Person 1
  contact1_chn_surname: string;
  contact1_chn_given_name: string;
  contact1_chn_nickname: string;
  contact1_eng_surname: string;
  contact1_eng_givenname: string;
  contact1_eng_nickname: string;
  contact1_gender: string;
  contact1_phone: string;
  contact1_job_title: string;
  // Contact Person 2
  contact2_chn_surname: string;
  contact2_chn_given_name: string;
  contact2_chn_nickname: string;
  contact2_eng_surname: string;
  contact2_eng_givenname: string;
  contact2_eng_nickname: string;
  contact2_gender: string;
  contact2_phone: string;
  contact2_job_title: string;
  // Business & Legal
  establish_year: string;
  join_date: string;
  director_hkid: string;
  referer_name: string;
  referer_set: string;
  asana_link: string;
  professional_skill: string;
  moq: string;
  order_days: string;
  // Remarks
  remark: string;
}

const EMPTY_FORM: SupplierEditForm = {
  name: "",
  display_name: "",
  chinese_name: "",
  account_description: "",
  n_type_ids: [],
  district_id: "",
  status: "Active",
  account_status: "",
  email: "",
  phone: "",
  fax_no: "",
  address: "",
  website: "",
  contact_persons: "",
  contact1_chn_surname: "",
  contact1_chn_given_name: "",
  contact1_chn_nickname: "",
  contact1_eng_surname: "",
  contact1_eng_givenname: "",
  contact1_eng_nickname: "",
  contact1_gender: "",
  contact1_phone: "",
  contact1_job_title: "",
  contact2_chn_surname: "",
  contact2_chn_given_name: "",
  contact2_chn_nickname: "",
  contact2_eng_surname: "",
  contact2_eng_givenname: "",
  contact2_eng_nickname: "",
  contact2_gender: "",
  contact2_phone: "",
  contact2_job_title: "",
  establish_year: "",
  join_date: "",
  director_hkid: "",
  referer_name: "",
  referer_set: "",
  asana_link: "",
  professional_skill: "",
  moq: "",
  order_days: "",
  remark: "",
};

// ─── PROPS ─────────────────────────────────────────────
interface SupplierEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass null for create mode, or a supplier object for edit mode. */
  supplier: SupplierRow | null;
  /**
   * Called after a successful save.
   * Always receives the supplier id; in create mode also passes a display label
   * so callers (e.g. expense dialogs) can select the newly created supplier.
   */
  onSaved?: (supplierId: string, created?: { id: string; label: string }) => void;
}

function supplierLabel(form: SupplierEditForm): string {
  return form.display_name.trim() || form.chinese_name.trim() || form.name.trim() || "未命名供應商";
}

// ─── MAIN COMPONENT ────────────────────────────────────
export default function SupplierEditDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: SupplierEditDialogProps) {
  const isCreateMode = supplier === null;
  const [form, setForm] = useState<SupplierEditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState("");

  // Name card file state for edit dialog
  const [nameCard1File, setNameCard1File] = useState<File | null>(null);
  const [nameCard1Preview, setNameCard1Preview] = useState<string | null>(null);
  const [nameCard2File, setNameCard2File] = useState<File | null>(null);
  const [nameCard2Preview, setNameCard2Preview] = useState<string | null>(null);

  // BR document upload state
  const brFileInputRef = useRef<HTMLInputElement>(null);
  const [brFile, setBrFile] = useState<File | null>(null);
  const [brUploading, setBrUploading] = useState(false);
  const [brForm, setBrForm] = useState({
    file_name: "商業登記證明",
    expiry_date: "",
    institution: "稅務局",
    code_number: "",
  });
  const [existingBrFile, setExistingBrFile] = useState<{ id: string; file: string | null; file_name: string | null; expiry_date: string | null; institution: string | null; code_number: string | null } | null>(null);

  // Duplicate check — exclude the current supplier when editing
  const duplicateCheck = useSupplierDuplicateCheck({ excludeId: supplier?.id });

  // Lookup data
  const [supplierTypes, setSupplierTypes] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

  // Load lookup tables
  useEffect(() => {
    async function loadLookups() {
      try {
        const supabase = createClient();
        const includeIds = supplier?.n_type_ids ?? (supplier?.n_type_id ? [supplier.n_type_id] : []);
        const [{ data: dists }, types] = await Promise.all([
          supabase.from("districts").select("id, name").order("name"),
          fetchSupplierTypes(includeIds),
        ]);
        setSupplierTypes(
          types.map((t) => ({ id: t.id, name: t.display || t.id }))
        );
        setDistricts(
          (dists ?? []).map((d: any) => ({ id: d.id, name: d.name || d.id }))
        );
      } catch (e) {
        console.error("Failed to load lookup tables for edit dialog", e);
      }
    }
    loadLookups();
  }, [supplier?.id, supplier?.n_type_id]);

  // Pre-fill form when supplier changes or dialog opens
  useEffect(() => {
    if (!open) return;

    if (isCreateMode) {
      setForm({
        ...EMPTY_FORM,
        join_date: new Date().toISOString().split("T")[0],
      });
      setError(null);
      setTypeSearch("");
      duplicateCheck.reset();
      setNameCard1File(null);
      setNameCard1Preview(null);
      setNameCard2File(null);
      setNameCard2Preview(null);
      setBrFile(null);
      setExistingBrFile(null);
      setBrForm({
        file_name: "商業登記證明",
        expiry_date: "",
        institution: "稅務局",
        code_number: "",
      });
      return;
    }

    setForm({
      name: supplier.name || "",
      display_name: supplier.display_name || "",
      chinese_name: supplier.chinese_name || "",
      account_description: (supplier as any).account_description || "",
      n_type_ids: (supplier as any).n_type_ids ?? (supplier.n_type_id ? [supplier.n_type_id] : []),
      district_id: supplier.district_id || "",
      status: supplier.status || "Active",
      account_status: (supplier as any).account_status || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      fax_no: supplier.fax_no || "",
      address: supplier.address || "",
      website: supplier.website || "",
      contact_persons: (supplier as any).contact_persons || "",
      contact1_chn_surname: supplier.contact1_chn_surname || "",
      contact1_chn_given_name: supplier.contact1_chn_given_name || "",
      contact1_chn_nickname: (supplier as any).contact1_chn_nickname || "",
      contact1_eng_surname: supplier.contact1_eng_surname || "",
      contact1_eng_givenname: supplier.contact1_eng_givenname || "",
      contact1_eng_nickname: (supplier as any).contact1_eng_nickname || "",
      contact1_gender: (supplier as any).contact1_gender || "",
      contact1_phone: supplier.contact1_phone || "",
      contact1_job_title: supplier.contact1_job_title || "",
      contact2_chn_surname: (supplier as any).contact2_chn_surname || "",
      contact2_chn_given_name: (supplier as any).contact2_chn_given_name || "",
      contact2_chn_nickname: (supplier as any).contact2_chn_nickname || "",
      contact2_eng_surname: supplier.contact2_eng_surname || "",
      contact2_eng_givenname: supplier.contact2_eng_givenname || "",
      contact2_eng_nickname: (supplier as any).contact2_eng_nickname || "",
      contact2_gender: (supplier as any).contact2_gender || "",
      contact2_phone: supplier.contact2_phone || "",
      contact2_job_title: supplier.contact2_job_title || "",
      establish_year: supplier.establish_year || "",
      join_date: supplier.join_date ? supplier.join_date.substring(0, 10) : "",
      director_hkid: (supplier as any).director_hkid || "",
      referer_name: (supplier as any).referer_name || "",
      referer_set: (supplier as any).referer_set || "",
      asana_link: (supplier as any).asana_link || "",
      professional_skill: supplier.professional_skill || "",
      moq: supplier.moq || "",
      order_days: supplier.order_days || "",
      remark: supplier.remark || "",
    });
    setError(null);
    setTypeSearch("");
    duplicateCheck.reset();
    // Pre-fill existing name card images
    setNameCard1File(null);
    setNameCard1Preview((supplier as any).contact1_name_card || null);
    setNameCard2File(null);
    setNameCard2Preview((supplier as any).contact2_name_card || null);
    // Load existing BR file
    setBrFile(null);
    loadExistingBrFile(supplier.id);
  }, [supplier, open, isCreateMode]);

  // Load existing BR file for this supplier
  async function loadExistingBrFile(supplierId: string) {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("supplier_files")
        .select("id, file, file_name, expiry_date, institution, code_number")
        .eq("supplier_id", supplierId)
        .eq("type_id", "37b3e05b-dd02-4a8b-b143-712eb8a02eb5")
        .order("created_date", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setExistingBrFile(data);
        setBrForm({
          file_name: data.file_name || "商業登記證明",
          expiry_date: data.expiry_date ? data.expiry_date.split("T")[0] : "",
          institution: data.institution || "稅務局",
          code_number: data.code_number || "",
        });
      } else {
        setExistingBrFile(null);
        setBrForm({
          file_name: "商業登記證明",
          expiry_date: "",
          institution: "稅務局",
          code_number: "",
        });
      }
    } catch (e) {
      setExistingBrFile(null);
    }
  }

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Trigger duplicate check for monitored fields
    if (field === "display_name") {
      duplicateCheck.checkDisplayName(value);
    }
    if (field === "phone") {
      duplicateCheck.checkPhone("phone", value);
    }
    if (field === "contact1_phone") {
      duplicateCheck.checkPhone("contact1_phone", value);
    }
    if (field === "contact2_phone") {
      duplicateCheck.checkPhone("contact2_phone", value);
    }
  };

  const toggleTypeId = (typeId: string) => {
    setForm((prev) => {
      const current = prev.n_type_ids;
      const exists = current.includes(typeId);
      return {
        ...prev,
        n_type_ids: exists ? current.filter(id => id !== typeId) : [...current, typeId],
      };
    });
  };

  const handleSave = async () => {
    // Duplicate check blocking
    if (duplicateCheck.isBlocked) {
      const phoneBlocked =
        duplicateCheck.phoneResult.isBlocked ||
        duplicateCheck.contact1PhoneResult.isBlocked ||
        duplicateCheck.contact2PhoneResult.isBlocked;
      setError(
        phoneBlocked
          ? "此電話號碼已被其他供應商使用，無法提交"
          : "存在完全相同的顯示名稱記錄，無法提交"
      );
      return;
    }
    // Validation: 英文公司名稱 or 中文公司名稱 at least one required
    if (!form.name.trim() && !form.chinese_name.trim()) {
      setError("英文公司名稱 或 中文公司名稱 至少需填寫一項");
      return;
    }
    // 顯示名稱 required
    if (!form.display_name.trim()) {
      setError("顯示名稱為必填");
      return;
    }
    // 供應商類型 at least one
    if (!form.n_type_ids || form.n_type_ids.length === 0) {
      setError("供應商類型至少需選擇一項");
      return;
    }
    // 帳戶狀態 (optional)
    // 電話 required (contact info tab)
    if (!form.phone || !form.phone.trim()) {
      setError("電話為必填（聯絡方式）");
      return;
    }
    // 聯絡人顯示名稱 required
    if (!form.contact_persons || !form.contact_persons.trim()) {
      setError("聯絡人顯示名稱為必填（聯絡方式）");
      return;
    }
    // 聯絡人1 電話: required only when any Chinese/English name field is filled
    const contact1HasName = [
      form.contact1_chn_surname,
      form.contact1_chn_given_name,
      form.contact1_chn_nickname,
      form.contact1_eng_surname,
      form.contact1_eng_givenname,
      form.contact1_eng_nickname,
    ].some((v) => v?.trim());
    if (contact1HasName && (!form.contact1_phone || !form.contact1_phone.trim())) {
      setError("聯絡人 1 電話為必填");
      return;
    }
    // 加入日期 required
    if (!form.join_date || !form.join_date.trim()) {
      setError("加入日期為必填（商業資料）");
      return;
    }
    // BR document: if file is uploaded, required fields must be filled
    if (brFile || existingBrFile?.file) {
      if (!brForm.file_name.trim()) {
        setError("BR 檔案名稱為必填");
        return;
      }
      if (!brForm.expiry_date) {
        setError("BR 到期日為必填");
        return;
      }
    }
    setSaving(true);
    setError(null);
    const { n_type_ids, ...restForm } = form;
    const label = supplierLabel(form);

    if (isCreateMode) {
      const result = await createSupplier({ ...restForm, n_type_ids });
      if (result.success && result.id) {
        if (nameCard1File) {
          await uploadSupplierNameCard(result.id, 1, nameCard1File);
        }
        if (nameCard2File) {
          await uploadSupplierNameCard(result.id, 2, nameCard2File);
        }
        await handleBrFileSave(result.id);
        setSaving(false);
        setNameCard1File(null);
        setNameCard1Preview(null);
        setNameCard2File(null);
        setNameCard2Preview(null);
        setBrFile(null);
        onOpenChange(false);
        onSaved?.(result.id, { id: result.id, label });
      } else {
        setSaving(false);
        setError(result.error || "建立失敗");
      }
      return;
    }

    const result = await updateSupplier(supplier.id, { ...restForm, n_type_ids });
    if (result.success) {
      // Upload name card files if new ones were selected
      if (nameCard1File) {
        await uploadSupplierNameCard(supplier.id, 1, nameCard1File);
      }
      if (nameCard2File) {
        await uploadSupplierNameCard(supplier.id, 2, nameCard2File);
      }
      // Handle BR document upload/update
      await handleBrFileSave(supplier.id);
      setSaving(false);
      setNameCard1File(null);
      setNameCard1Preview(null);
      setNameCard2File(null);
      setNameCard2Preview(null);
      onOpenChange(false);
      onSaved?.(supplier.id, { id: supplier.id, label });
    } else {
      setSaving(false);
      setError(result.error || "更新失敗");
    }
  };

  // BR document save helper
  async function handleBrFileSave(supplierId: string) {
    const supabase = createClient();
    let fileUrl = existingBrFile?.file || null;

    // Upload new BR file if selected
    if (brFile) {
      setBrUploading(true);
      const filePath = buildStorageObjectKey(supplierId, brFile.name);
      const { error: uploadError } = await supabase.storage
        .from("supplier-files")
        .upload(filePath, brFile);

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("supplier-files")
          .getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      }
      setBrUploading(false);
    }

    // Only save if there's something to save (new file, or form fields changed)
    const hasChanges = brFile || brForm.expiry_date || brForm.code_number || brForm.institution !== "稅務局" || brForm.file_name !== "商業登記證明";
    if (!hasChanges && !existingBrFile) return;

    const record: Record<string, any> = {
      file_name: brForm.file_name || "商業登記證明",
      type_name: "BR",
      type_id: "37b3e05b-dd02-4a8b-b143-712eb8a02eb5",
      code_number: brForm.code_number || null,
      expiry_date: brForm.expiry_date || null,
      institution: brForm.institution || null,
      remarks: null,
      modified_date: new Date().toISOString(),
    };

    if (fileUrl) {
      record.file = fileUrl;
    }

    if (existingBrFile) {
      // Update existing BR record
      await supabase
        .from("supplier_files")
        .update(record)
        .eq("id", existingBrFile.id);
    } else if (brFile) {
      // Create new BR record only if a file was uploaded
      record.supplier_id = supplierId;
      record.created_date = new Date().toISOString();
      await supabase
        .from("supplier_files")
        .insert(record);
    }
  }

  // ─── TAB: COMPANY INFO ────────────────────────────────
  const renderCompanyTab = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      {/* Row 1: 顯示名稱, 帳戶狀態 */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">顯示名稱 <span className="text-red-500">*</span></Label>
        <Input value={form.display_name} onChange={(e) => updateField("display_name", e.target.value)} placeholder="列表/下拉選單中的顯示名稱" />
        <DuplicateWarning result={duplicateCheck.displayNameResult} fieldLabel="顯示名稱" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">帳戶狀態 <span className="text-red-500">*</span></Label>
        <Select value={form.status || "Active"} onValueChange={(v) => updateField("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">啟用 Active</SelectItem>
            <SelectItem value="Inactive">停用 Inactive</SelectItem>
            <SelectItem value="Blacklist">黑名單 Blacklist</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Row 2: 英文公司名稱, 中文公司名稱 */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">英文公司名稱 <span className="text-red-500">*</span></Label>
        <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="English Company Name" />
        <p className="text-[13px] text-gray-400">英文或中文公司名稱至少填寫一項</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">中文公司名稱 <span className="text-red-500">*</span></Label>
        <Input value={form.chinese_name} onChange={(e) => updateField("chinese_name", e.target.value)} placeholder="中文公司名稱" />
        <p className="text-[13px] text-gray-400">英文或中文公司名稱至少填寫一項</p>
      </div>
      {/* Row 3: 供應商類型 - full width */}
      <div className="col-span-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">供應商類型（可多選） <span className="text-red-500">*</span></Label>
          <span className="text-xs text-gray-400">{form.n_type_ids.length} 已選</span>
        </div>
        <div className="border rounded-lg p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search / Create a supplier type"
              className="pl-8 h-8 text-xs"
              value={typeSearch}
              onChange={(e) => setTypeSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-[180px] overflow-y-auto">
            {supplierTypes
              .filter((t) => !typeSearch || t.name.toLowerCase().includes(typeSearch.toLowerCase()))
              .map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    form.n_type_ids.includes(t.id)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      form.n_type_ids.includes(t.id)
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                    onClick={() => toggleTypeId(t.id)}
                  >
                    {form.n_type_ids.includes(t.id) && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="truncate" onClick={() => toggleTypeId(t.id)}>{t.name}</span>
                </label>
              ))}
            {supplierTypes.length === 0 && <span className="text-xs text-gray-400 col-span-4">載入中...</span>}
          </div>
        </div>
      </div>
      {/* Row 4: 地區, 註冊審批狀態 */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">地區</Label>
        <Select value={form.district_id || "none"} onValueChange={(v) => updateField("district_id", v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="選擇地區" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">未設定</SelectItem>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">註冊審批狀態</Label>
        <Select value={form.account_status || "__empty__"} onValueChange={(v) => updateField("account_status", v === "__empty__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="選擇狀態" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">未設定</SelectItem>
            <SelectItem value="Information Incomplete">資料不完整</SelectItem>
            <SelectItem value="Pending Approval">待審批</SelectItem>
            <SelectItem value="Approved">已批准</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Row 5: 公司簡介 - full width */}
      <div className="col-span-2 space-y-1.5">
        <Label className="text-sm font-medium">公司簡介 / 描述</Label>
        <Textarea value={form.account_description} onChange={(e) => updateField("account_description", e.target.value)} placeholder="供應商自我介紹..." rows={3} />
      </div>
    </div>
  );

  // ─── TAB: CONTACT INFO ────────────────────────────────
  const renderContactTab = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">電郵</Label>
        <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">電話 <span className="text-red-500">*</span></Label>
        <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="電話號碼" />
        <DuplicateWarning
          result={duplicateCheck.phoneResult}
          fieldLabel="電話"
          entityLabel="供應商"
          isPhoneField
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">傳真</Label>
        <Input value={form.fax_no} onChange={(e) => updateField("fax_no", e.target.value)} placeholder="傳真號碼" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">網站</Label>
        <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://..." />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label className="text-sm font-medium">地址</Label>
        <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="公司地址" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label className="text-sm font-medium">聯絡人顯示名稱 <span className="text-red-500">*</span></Label>
        <Input value={form.contact_persons} onChange={(e) => updateField("contact_persons", e.target.value)} placeholder="方便辨識的聯絡人名稱" />
      </div>
    </div>
  );

  // ─── TAB: CONTACT PERSON 1 ────────────────────────────
  const renderContact1Tab = () => {
    const contact1PhoneRequired = [
      form.contact1_chn_surname,
      form.contact1_chn_given_name,
      form.contact1_chn_nickname,
      form.contact1_eng_surname,
      form.contact1_eng_givenname,
      form.contact1_eng_nickname,
    ].some((v) => v?.trim());

    return (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="col-span-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">中文姓名</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">姓氏</Label>
        <Input value={form.contact1_chn_surname} onChange={(e) => updateField("contact1_chn_surname", e.target.value)} placeholder="姓" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">名字</Label>
        <Input value={form.contact1_chn_given_name} onChange={(e) => updateField("contact1_chn_given_name", e.target.value)} placeholder="名" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">暱稱 (中)</Label>
        <Input value={form.contact1_chn_nickname} onChange={(e) => updateField("contact1_chn_nickname", e.target.value)} placeholder="中文暱稱" />
      </div>
      <div className="space-y-1.5" />

      <div className="col-span-2 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">English Name</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Surname</Label>
        <Input value={form.contact1_eng_surname} onChange={(e) => updateField("contact1_eng_surname", e.target.value)} placeholder="Surname" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Given Name</Label>
        <Input value={form.contact1_eng_givenname} onChange={(e) => updateField("contact1_eng_givenname", e.target.value)} placeholder="Given Name" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Nickname (Eng)</Label>
        <Input value={form.contact1_eng_nickname} onChange={(e) => updateField("contact1_eng_nickname", e.target.value)} placeholder="Nickname" />
      </div>
      <div className="space-y-1.5" />

      <div className="col-span-2 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">其他資料</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">性別</Label>
        <div className="flex gap-0 border rounded-md overflow-hidden w-fit">
          {[{ value: "", label: "未設定" }, { value: "Male", label: "男" }, { value: "Female", label: "女" }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField("contact1_gender", opt.value)}
              className={`px-4 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors ${form.contact1_gender === opt.value ? "bg-[#1A2035] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">電話{contact1PhoneRequired ? <span className="text-red-500"> *</span> : null}</Label>
        <Input value={form.contact1_phone} onChange={(e) => updateField("contact1_phone", e.target.value)} placeholder="聯絡人電話" />
        <DuplicateWarning
          result={duplicateCheck.contact1PhoneResult}
          fieldLabel="聯絡人 1 電話"
          entityLabel="供應商"
          isPhoneField
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">職稱</Label>
        <Input value={form.contact1_job_title} onChange={(e) => updateField("contact1_job_title", e.target.value)} placeholder="Job Title" />
      </div>

      {/* Name Card Upload */}
      <div className="col-span-2 mt-3 space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          名片 Name Card
        </Label>
        <div className="flex items-start gap-3">
          {nameCard1Preview ? (
            <div className="relative group">
              <img src={nameCard1Preview} alt="Contact 1 name card" className="w-40 h-24 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => { setNameCard1File(null); setNameCard1Preview(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-40 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">上傳名片</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setNameCard1File(file);
                    setNameCard1Preview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
    );
  };

  // ─── TAB: CONTACT PERSON 2 ────────────────────────────
  const renderContact2Tab = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="col-span-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">中文姓名</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">姓氏</Label>
        <Input value={form.contact2_chn_surname} onChange={(e) => updateField("contact2_chn_surname", e.target.value)} placeholder="姓" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">名字</Label>
        <Input value={form.contact2_chn_given_name} onChange={(e) => updateField("contact2_chn_given_name", e.target.value)} placeholder="名" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">暱稱 (中)</Label>
        <Input value={form.contact2_chn_nickname} onChange={(e) => updateField("contact2_chn_nickname", e.target.value)} placeholder="中文暱稱" />
      </div>
      <div className="space-y-1.5" />

      <div className="col-span-2 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">English Name</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Surname</Label>
        <Input value={form.contact2_eng_surname} onChange={(e) => updateField("contact2_eng_surname", e.target.value)} placeholder="Surname" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Given Name</Label>
        <Input value={form.contact2_eng_givenname} onChange={(e) => updateField("contact2_eng_givenname", e.target.value)} placeholder="Given Name" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Nickname (Eng)</Label>
        <Input value={form.contact2_eng_nickname} onChange={(e) => updateField("contact2_eng_nickname", e.target.value)} placeholder="Nickname" />
      </div>
      <div className="space-y-1.5" />

      <div className="col-span-2 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">其他資料</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">性別</Label>
        <div className="flex gap-0 border rounded-md overflow-hidden w-fit">
          {[{ value: "", label: "未設定" }, { value: "Male", label: "男" }, { value: "Female", label: "女" }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField("contact2_gender", opt.value)}
              className={`px-4 py-1.5 text-sm font-medium border-r last:border-r-0 transition-colors ${form.contact2_gender === opt.value ? "bg-[#1A2035] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">電話</Label>
        <Input value={form.contact2_phone} onChange={(e) => updateField("contact2_phone", e.target.value)} placeholder="聯絡人電話" />
        <DuplicateWarning
          result={duplicateCheck.contact2PhoneResult}
          fieldLabel="聯絡人 2 電話"
          entityLabel="供應商"
          isPhoneField
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">職稱</Label>
        <Input value={form.contact2_job_title} onChange={(e) => updateField("contact2_job_title", e.target.value)} placeholder="Job Title" />
      </div>

      {/* Name Card Upload */}
      <div className="col-span-2 mt-3 space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-gray-400" />
          名片 Name Card
        </Label>
        <div className="flex items-start gap-3">
          {nameCard2Preview ? (
            <div className="relative group">
              <img src={nameCard2Preview} alt="Contact 2 name card" className="w-40 h-24 object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => { setNameCard2File(null); setNameCard2Preview(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-40 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <Upload className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-xs text-gray-500">上傳名片</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setNameCard2File(file);
                    setNameCard2Preview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );

  // ─── TAB: BUSINESS & LEGAL ────────────────────────────
  const renderBusinessTab = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">加入日期 <span className="text-red-500">*</span></Label>
        <Input type="date" value={form.join_date} onChange={(e) => updateField("join_date", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">成立年份</Label>
        <Input value={form.establish_year} onChange={(e) => updateField("establish_year", e.target.value)} placeholder="例：2010" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">董事身份證號碼</Label>
        <Input value={form.director_hkid} onChange={(e) => updateField("director_hkid", e.target.value)} placeholder="HKID" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">最低訂單量 (MOQ)</Label>
        <Input value={form.moq} onChange={(e) => updateField("moq", e.target.value)} placeholder="最低訂單要求" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">落單至交貨天數</Label>
        <Input value={form.order_days} onChange={(e) => updateField("order_days", e.target.value)} placeholder="例：14" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Asana 連結</Label>
        <Input value={form.asana_link} onChange={(e) => updateField("asana_link", e.target.value)} placeholder="https://app.asana.com/..." />
      </div>

      <div className="col-span-2 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">介紹人資料</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">介紹人名稱</Label>
        <Input value={form.referer_name} onChange={(e) => updateField("referer_name", e.target.value)} placeholder="介紹人姓名" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">介紹人類別</Label>
        <Select value={form.referer_set || "none"} onValueChange={(v) => updateField("referer_set", v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="選擇類別" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">未設定</SelectItem>
            <SelectItem value="Company">公司 Company</SelectItem>
            <SelectItem value="User">個人 User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 space-y-1.5 mt-2">
        <Label className="text-sm font-medium">專業技能 / 服務範圍</Label>
        <Textarea value={form.professional_skill} onChange={(e) => updateField("professional_skill", e.target.value)} placeholder="詳細描述供應商的專業能力和服務範圍..." rows={4} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label className="text-sm font-medium">備註</Label>
        <Textarea value={form.remark} onChange={(e) => updateField("remark", e.target.value)} placeholder="備註..." rows={3} />
      </div>

      {/* ─── BR Document Upload Section ─── */}
      <div className="col-span-2 mt-4 border-t pt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          商業登記 BR Document
          <span className="text-[10px] font-normal text-gray-400 ml-1">(Optional)</span>
        </p>
        <div className="flex gap-4">
          {/* Left: PDF Uploader / Document Preview - tall rectangle */}
          <div className="w-[180px] shrink-0">
            <input
              type="file"
              ref={brFileInputRef}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setBrFile(file);
              }}
            />
            {brFile ? (
              /* New file selected - show preview */
              <div
                className="w-full h-[220px] rounded-xl border-2 border-solid border-bw-teal/30 bg-gray-50 overflow-hidden flex flex-col items-center justify-center cursor-pointer relative group"
                onClick={() => brFileInputRef.current?.click()}
              >
                {brFile.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(brFile)}
                    alt="BR preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center">
                    <FileText className="w-12 h-12 text-bw-teal" />
                    <span className="text-xs text-gray-700 font-medium truncate max-w-[140px]">{brFile.name}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-white text-xs font-medium">點擊更換</span>
                </div>
              </div>
            ) : existingBrFile?.file ? (
              /* Existing file from DB - show preview */
              <div
                className="w-full h-[220px] rounded-xl border-2 border-solid border-emerald-200 bg-gray-50 overflow-hidden flex flex-col items-center justify-center cursor-pointer relative group"
                onClick={() => brFileInputRef.current?.click()}
              >
                {existingBrFile.file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={existingBrFile.file}
                    alt="BR document"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center">
                    <FileText className="w-12 h-12 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">已有檔案</span>
                    <span className="text-[10px] text-gray-500 truncate max-w-[140px]">{existingBrFile.file_name || "BR Document"}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-white text-xs font-medium">點擊更換</span>
                </div>
              </div>
            ) : (
              /* Empty state - uploader */
              <div
                className="w-full h-[220px] rounded-xl border-2 border-dashed border-gray-200 hover:border-bw-teal/50 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50/50 group"
                onClick={() => brFileInputRef.current?.click()}
              >
                <Upload className="w-7 h-7 text-gray-300 group-hover:text-bw-teal/60 transition-colors" />
                <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">上傳 BR 文件</span>
                <span className="text-[10px] text-gray-300">PDF / 圖片</span>
              </div>
            )}
          </div>

          {/* Right: 4 input fields in a column - only visible when file is uploaded */}
          {(brFile || existingBrFile?.file) && (
            <div className="flex-1 space-y-3">
              {/* File Display Name */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  File Display 檔案名稱<span className="text-red-500">*</span>
                </Label>
                <Input
                  value={brForm.file_name}
                  onChange={(e) => setBrForm((prev) => ({ ...prev, file_name: e.target.value }))}
                  placeholder="File Display"
                />
              </div>

              {/* Expiry Date (Required) */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  到期日 Expiry Date<span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={brForm.expiry_date}
                  onChange={(e) => setBrForm((prev) => ({ ...prev, expiry_date: e.target.value }))}
                />
              </div>

              {/* Institution */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Institution (發證機構)</Label>
                <Input
                  value={brForm.institution}
                  onChange={(e) => setBrForm((prev) => ({ ...prev, institution: e.target.value }))}
                  placeholder="Type here..."
                />
              </div>

              {/* Certificate Code */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Certificate Code (用於檢查資料真確性)</Label>
                <Input
                  value={brForm.code_number}
                  onChange={(e) => setBrForm((prev) => ({ ...prev, code_number: e.target.value }))}
                  placeholder="Code for BR"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreateMode ? (
              <>
                <Plus className="w-5 h-5 text-bw-amber" />
                新增供應商
              </>
            ) : (
              <>
                <Edit2 className="w-5 h-5 text-bw-amber" />
                編輯供應商
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="company" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="company" className="text-xs">公司資料</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">聯絡方式</TabsTrigger>
            <TabsTrigger value="contact1" className="text-xs">聯絡人 1</TabsTrigger>
            <TabsTrigger value="contact2" className="text-xs">聯絡人 2</TabsTrigger>
            <TabsTrigger value="business" className="text-xs">商業資料</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto pr-2 mt-2">
            <TabsContent value="company" className="mt-0">{renderCompanyTab()}</TabsContent>
            <TabsContent value="contact" className="mt-0">{renderContactTab()}</TabsContent>
            <TabsContent value="contact1" className="mt-0">{renderContact1Tab()}</TabsContent>
            <TabsContent value="contact2" className="mt-0">{renderContact2Tab()}</TabsContent>
            <TabsContent value="business" className="mt-0">{renderBusinessTab()}</TabsContent>
          </div>
        </Tabs>

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving || duplicateCheck.isBlocked} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
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
