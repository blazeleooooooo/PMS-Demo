"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNavigate } from "@/hooks/use-navigate";
import {
  Truck,
  Search,
  Phone,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  DollarSign,
  FolderOpen,
  Award,
  User,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Upload,
  ImageIcon,
  FileText} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchSuppliersPage,
  fetchSupplierStats,
  fetchSupplierFilterOptions,
  createSupplier,
  deleteSupplier,
  uploadSupplierNameCard,
  type SupplierRow,
  type SupplierStats,
  type SupplierFilterOptions} from "@/lib/data-service";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import SupplierEditDialog from "@/components/suppliers/SupplierEditDialog";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { useSupplierDuplicateCheck } from "@/hooks/use-supplier-duplicate-check";
import { DuplicateWarning } from "@/components/suppliers/DuplicateWarning";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";

type SortField = "name" | "n_type_name" | "real_level" | "project_number" | "amount" | "join_date" | "status";
type SortDir = "asc" | "desc";

// ─── STAT CARD ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-[15px] text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

import { formatDate } from "@/lib/date-utils";

// ─── LEVEL DISPLAY ─────────────────────────────────────
function LevelBadge({ avgScore }: { avgScore: number | null }) {
  if (avgScore == null) return <span className="text-xs text-gray-300">-</span>;
  // avgScore is typically 1-5; render filled stars for the rounded value
  const roundedStars = Math.round(avgScore);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < roundedStars ? "fill-bw-amber text-bw-amber" : "text-gray-200"}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{avgScore.toFixed(1)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-300">-</span>;
  const lower = status.toLowerCase();
  if (lower === "active" || lower === "approved") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs">{status}</Badge>;
  }
  if (lower === "inactive" || lower === "suspended") {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-xs">{status}</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

// ─── EMPTY FORM ─────────────────────────────────────────
const EMPTY_FORM = {
  // Company Info
  name: "",
  display_name: "",
  chinese_name: "",
  account_description: "",
  n_type_ids: [] as string[],
  district_id: "",
  status: "Active",
  account_status: "",
  // Contact Info
  email: "",
  phone: "",
  fax_no: "",
  address: "",
  website: "",
  contact_persons: "",
  // Contact Person 1
  contact1_chn_surname: "",
  contact1_chn_given_name: "",
  contact1_chn_nickname: "",
  contact1_eng_surname: "",
  contact1_eng_givenname: "",
  contact1_eng_nickname: "",
  contact1_gender: "",
  contact1_phone: "",
  contact1_job_title: "",
  // Contact Person 2
  contact2_chn_surname: "",
  contact2_chn_given_name: "",
  contact2_chn_nickname: "",
  contact2_eng_surname: "",
  contact2_eng_givenname: "",
  contact2_eng_nickname: "",
  contact2_gender: "",
  contact2_phone: "",
  contact2_job_title: "",
  // Name Cards
  contact1_name_card: "",
  contact2_name_card: "",
  // Business & Legal
  establish_year: "",
  join_date: new Date().toISOString().substring(0, 10),
  director_hkid: "",
  referer_name: "",
  referer_set: "",
  asana_link: "",
  professional_skill: "",
  moq: "",
  order_days: "",
  // Remarks
  remark: ""};

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function SuppliersManagement() {
  const router = useRouter();
  const { navigate } = useNavigate();
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const { formatMoney } = useFinancialFormat();
  // ─── Paginated data state ──────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 50;

  // ─── Filter state ──────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ─── KPI & filter options (lightweight, separate load) ─────
  const [stats, setStats] = useState<SupplierStats>({ total: 0, active: 0, levelA: 0, totalAmount: 0 });
  const [filterOptions, setFilterOptions] = useState<SupplierFilterOptions>({ types: [], levels: [], statuses: [] });

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name card file state for create dialog
  const [nameCard1File, setNameCard1File] = useState<File | null>(null);
  const [nameCard1Preview, setNameCard1Preview] = useState<string | null>(null);
  const [nameCard2File, setNameCard2File] = useState<File | null>(null);
  const [nameCard2Preview, setNameCard2Preview] = useState<string | null>(null);

  // BR document upload state for create dialog
  const brFileInputRef = useRef<HTMLInputElement>(null);
  const [brFile, setBrFile] = useState<File | null>(null);
  const [brForm, setBrForm] = useState({
    file_name: "商業登記證明",
    expiry_date: "",
    institution: "稅務局",
    code_number: ""});

  // Average score map: supplier_id → average point from staff_supplier_comments
  const [avgScoreMap, setAvgScoreMap] = useState<Record<string, number>>({});
  const [typeSearch, setTypeSearch] = useState("");

  // Duplicate check for create dialog
  const duplicateCheck = useSupplierDuplicateCheck();

  // Lookup data for form dropdowns
  const [supplierTypes, setSupplierTypes] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

  // ─── Debounce search input ─────────────────────────
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(0); // reset to first page on search change
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  // ─── Load paginated data ───────────────────────────
  const loadPage = useCallback(async (pageNum?: number) => {
    setLoading(true);
    const pg = pageNum ?? currentPage;
    const result = await fetchSuppliersPage({
      page: pg,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      typeFilter: typeFilter !== "all" ? typeFilter : undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
      levelFilter: levelFilter !== "all" ? levelFilter : undefined,
      sortField,
      sortDir});
    setSuppliers(result.data);
    setTotalCount(result.totalCount);
    setLoading(false);

    // Fetch avg scores for this page's suppliers
    if (result.data.length > 0) {
      try {
        const supabase = createClient();
        const supplierIds = result.data.map(s => s.id);
        const { data: comments } = await supabase
          .from("staff_supplier_comments")
          .select("supplier_id, point")
          .in("supplier_id", supplierIds)
          .not("point", "is", null);

        if (comments) {
          const scoreAccum: Record<string, { total: number; count: number }> = {};
          for (const row of comments) {
            if (row.supplier_id && row.point != null) {
              if (!scoreAccum[row.supplier_id]) scoreAccum[row.supplier_id] = { total: 0, count: 0 };
              scoreAccum[row.supplier_id].total += row.point;
              scoreAccum[row.supplier_id].count += 1;
            }
          }
          const map: Record<string, number> = {};
          for (const [suppId, { total, count }] of Object.entries(scoreAccum)) {
            map[suppId] = total / count;
          }
          setAvgScoreMap(prev => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error("Failed to load supplier avg scores", e);
      }
    }
  }, [currentPage, debouncedSearch, typeFilter, statusFilter, levelFilter, sortField, sortDir]);

  // ─── Load stats & filter options (once + on refresh) ────
  const loadMetadata = useCallback(async () => {
    const optionsResult = await fetchSupplierFilterOptions();
    setFilterOptions(optionsResult);
    setSupplierTypes(optionsResult.types);

    // Also load districts for create form
    try {
      const supabase = createClient();
      const { data: dists } = await supabase.from("districts").select("id, name").order("name");
      setDistricts((dists ?? []).map((d: any) => ({ id: d.id, name: d.name || d.id })));
    } catch (e) {
      console.error("Failed to load districts", e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const statsResult = await fetchSupplierStats({
      search: debouncedSearch || undefined,
      typeFilter: typeFilter !== "all" ? typeFilter : undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
      levelFilter: levelFilter !== "all" ? levelFilter : undefined});
    setStats(statsResult);
  }, [debouncedSearch, typeFilter, statusFilter, levelFilter]);

  // ─── Initial load ──────────────────────────────────
  useEffect(() => { loadMetadata(); }, [loadMetadata]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ─── Reload page data when params change ───────────
  useEffect(() => { loadPage(); }, [loadPage]);

  // ─── Reset to page 0 when filters change ──────────
  useEffect(() => { setCurrentPage(0); }, [typeFilter, levelFilter, statusFilter, sortField, sortDir]);

  // ─── Refresh all ───────────────────────────────────
  const handleRefresh = () => {
    loadMetadata();
    loadStats();
    loadPage();
  };

  // Derived values
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasMore = (currentPage + 1) * PAGE_SIZE < totalCount;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // ─── CRUD HANDLERS ──────────────────────────────────────
  const handleCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setTypeSearch("");
    setNameCard1File(null);
    setNameCard1Preview(null);
    setNameCard2File(null);
    setNameCard2Preview(null);
    duplicateCheck.reset();
    setShowCreateDialog(true);
  };

  const handleEdit = (supplier: SupplierRow) => {
    setSelectedSupplier(supplier);
    setShowEditDialog(true);
  };

  const handleDelete = (supplier: SupplierRow) => {
    setSelectedSupplier(supplier);
    setError(null);
    setShowDeleteDialog(true);
  };

  const handleSaveCreate = async () => {
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
    if (brFile) {
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
    const result = await createSupplier(form);
    if (result.success && result.id) {
      // Upload name card files if selected
      if (nameCard1File) {
        await uploadSupplierNameCard(result.id, 1, nameCard1File);
      }
      if (nameCard2File) {
        await uploadSupplierNameCard(result.id, 2, nameCard2File);
      }
      // Upload BR document if file selected
      if (brFile) {
        await handleBrFileCreate(result.id);
      }
      setSaving(false);
      setShowCreateDialog(false);
      setNameCard1File(null);
      setNameCard1Preview(null);
      setNameCard2File(null);
      setNameCard2Preview(null);
      setBrFile(null);
      setBrForm({ file_name: "商業登記證明", expiry_date: "", institution: "稅務局", code_number: "" });
      duplicateCheck.reset();
      handleRefresh();
    } else {
      setSaving(false);
      setError(result.error || "建立失敗");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    setError(null);
    const result = await deleteSupplier(selectedSupplier.id);
    setSaving(false);
    if (result.success) {
      setShowDeleteDialog(false);
      handleRefresh();
    } else {
      setError(result.error || "刪除失敗");
    }
  };

  // BR file upload helper for create flow
  async function handleBrFileCreate(supplierId: string) {
    if (!brFile) return;
    const supabase = createClient();
    const filePath = buildStorageObjectKey(supplierId, brFile.name);
    const { error: uploadError } = await supabase.storage
      .from("supplier-files")
      .upload(filePath, brFile);

    if (uploadError) {
      console.error("BR upload error:", uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("supplier-files")
      .getPublicUrl(filePath);

    const record = {
      supplier_id: supplierId,
      file_name: brForm.file_name || "商業登記證明",
      type_name: "BR",
      type_id: "37b3e05b-dd02-4a8b-b143-712eb8a02eb5",
      code_number: brForm.code_number || null,
      expiry_date: brForm.expiry_date || null,
      institution: brForm.institution || null,
      remarks: null,
      file: publicUrlData.publicUrl,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString()};

    const { error: insertError } = await supabase
      .from("supplier_files")
      .insert(record);

    if (insertError) {
      console.error("BR file record insert error:", insertError);
    }
  }

  const updateField = (field: string, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Trigger duplicate check for monitored fields
    if (field === "display_name" && typeof value === "string") {
      duplicateCheck.checkDisplayName(value);
    }
    if (field === "phone" && typeof value === "string") {
      duplicateCheck.checkPhone("phone", value);
    }
    if (field === "contact1_phone" && typeof value === "string") {
      duplicateCheck.checkPhone("contact1_phone", value);
    }
    if (field === "contact2_phone" && typeof value === "string") {
      duplicateCheck.checkPhone("contact2_phone", value);
    }
  };

  const toggleTypeId = (typeId: string) => {
    setForm((prev) => {
      const current = prev.n_type_ids || [];
      const next = current.includes(typeId)
        ? current.filter((id) => id !== typeId)
        : [...current, typeId];
      return { ...prev, n_type_ids: next };
    });
  };

  // ─── FORM FIELDS (Tabbed layout matching Edit dialog) ────────────────────────
  const renderCreateFormTabs = () => (
    <Tabs defaultValue="company" className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="company" className="text-xs">公司資料</TabsTrigger>
        <TabsTrigger value="contact" className="text-xs">聯絡方式</TabsTrigger>
        <TabsTrigger value="contact1" className="text-xs">聯絡人 1</TabsTrigger>
        <TabsTrigger value="contact2" className="text-xs">聯絡人 2</TabsTrigger>
        <TabsTrigger value="business" className="text-xs">商業資料</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto pr-2 mt-2 max-h-[55vh]">
        {/* ─── TAB: COMPANY INFO ──────────────── */}
        <TabsContent value="company" className="mt-0">
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
                <span className="text-xs text-gray-400">{(form.n_type_ids || []).length} 已選</span>
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
                          (form.n_type_ids || []).includes(t.id)
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            (form.n_type_ids || []).includes(t.id)
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300"
                          }`}
                          onClick={() => toggleTypeId(t.id)}
                        >
                          {(form.n_type_ids || []).includes(t.id) && (
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
        </TabsContent>

        {/* ─── TAB: CONTACT INFO ──────────────── */}
        <TabsContent value="contact" className="mt-0">
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
        </TabsContent>

        {/* ─── TAB: CONTACT PERSON 1 ──────────────── */}
        <TabsContent value="contact1" className="mt-0">
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
              <Label className="text-sm font-medium">電話{[
                form.contact1_chn_surname,
                form.contact1_chn_given_name,
                form.contact1_chn_nickname,
                form.contact1_eng_surname,
                form.contact1_eng_givenname,
                form.contact1_eng_nickname,
              ].some((v) => v?.trim()) ? <span className="text-red-500"> *</span> : null}</Label>
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
        </TabsContent>

        {/* ─── TAB: CONTACT PERSON 2 ──────────────── */}
        <TabsContent value="contact2" className="mt-0">
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
        </TabsContent>

        {/* ─── TAB: BUSINESS & LEGAL ──────────────── */}
        <TabsContent value="business" className="mt-0">
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
                    /* File selected - show document preview */
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
                {brFile && (
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
        </TabsContent>
      </div>
    </Tabs>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-bw-amber" />
            供應商管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理供應商資料、評級、專業技能及交易記錄</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {canCreate("suppliers") && (
          <Button size="sm" onClick={handleCreate} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
            <Plus className="w-4 h-4 mr-1.5" />
            新增供應商
          </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Truck} label="總供應商" value={stats.total} color="bg-bw-amber" />
        <StatCard icon={Award} label="活躍供應商" value={stats.active} color="bg-bw-teal" />
        <StatCard icon={Star} label="A 級供應商" value={stats.levelA} color="bg-emerald-500" />
        <StatCard icon={DollarSign} label="總交易額" value={formatMoney(stats.totalAmount)} color="bg-bw-blue" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋供應商名稱、電郵、電話、類型..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="所有類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有類型</SelectItem>
            {filterOptions.types.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="所有評級" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有評級</SelectItem>
            {filterOptions.levels.map((l) => (
              <SelectItem key={l} value={l}>等級 {l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            {filterOptions.statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-900">{totalCount}</span> 筆
          {totalCount > PAGE_SIZE && (
            <span className="ml-1 text-xs text-gray-400">
              (第 {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} 筆)
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-bw-amber mr-2" />
            <span className="text-gray-500">載入供應商資料中...</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>無符合條件的供應商</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[220px]">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 font-semibold">
                      供應商名稱 <SortIcon field="name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("n_type_name")} className="flex items-center gap-1 font-semibold">
                      類型 <SortIcon field="n_type_name" />
                    </button>
                  </TableHead>
                  <TableHead>聯絡方式</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("real_level")} className="flex items-center gap-1 font-semibold">
                      評分 <SortIcon field="real_level" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("status")} className="flex items-center gap-1 font-semibold">
                      狀態 <SortIcon field="status" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("project_number")} className="flex items-center gap-1 font-semibold ml-auto">
                      項目數 <SortIcon field="project_number" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("amount")} className="flex items-center gap-1 font-semibold ml-auto">
                      交易額 <SortIcon field="amount" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("join_date")} className="flex items-center gap-1 font-semibold">
                      加入日期 <SortIcon field="join_date" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[110px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => {
                  const displayName = s.display_name || s.chinese_name || s.name || "未命名";
                  const engName = s.name && s.name !== displayName ? s.name : null;
                  const contact1Name = [s.contact1_chn_surname, s.contact1_chn_given_name].filter(Boolean).join("") ||
                    [s.contact1_eng_surname, s.contact1_eng_givenname].filter(Boolean).join(" ");
                  return (
                    <TableRow
                      key={s.id}
                      className="group hover:bg-amber-50/30 transition-colors cursor-pointer"
                      onClick={(e) => navigate(`/suppliers/${s.id}`, e)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-bw-amber transition-colors">
                            {displayName}
                          </p>
                          {engName && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{engName}</p>
                          )}
                          {s.professional_skill && (
                            <p className="text-[12px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                              {s.professional_skill}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(s.n_type_names && s.n_type_names.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {s.n_type_names.map((typeName, idx) => (
                              <Badge key={idx} variant="outline" className="border-gray-200 text-gray-600 text-xs">
                                {typeName}
                              </Badge>
                            ))}
                          </div>
                        ) : s.n_type_name ? (
                          <Badge variant="outline" className="border-gray-200 text-gray-600 text-xs">
                            {s.n_type_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {contact1Name && (
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0 text-gray-400" /> {contact1Name}
                              {s.contact1_job_title && <span className="text-gray-400">({s.contact1_job_title})</span>}
                            </p>
                          )}
                          {(s.phone || s.contact1_phone) && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" /> {s.contact1_phone || s.phone}
                            </p>
                          )}
                          {s.email && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 shrink-0" /> {s.email}
                            </p>
                          )}
                          {!contact1Name && !s.phone && !s.contact1_phone && !s.email && (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <LevelBadge avgScore={avgScoreMap[s.id] ?? null} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {s.project_number != null && s.project_number > 0 ? s.project_number : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMoney(s.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(s.join_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <AsanaLinkButton href={s.asana_link} />
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit("suppliers") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                            className="p-1.5 rounded-md hover:bg-amber-100 text-gray-400 hover:text-bw-amber transition-colors"
                            title="編輯"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                          {canDelete("suppliers") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                            className="p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              顯示 {currentPage * PAGE_SIZE + 1} - {Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} 筆，共 {totalCount} 筆
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 text-sm text-gray-700 font-medium">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={!hasMore}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={!hasMore}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── CREATE DIALOG ──────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-bw-amber" />
              新增供應商
            </DialogTitle>
          </DialogHeader>
          {renderCreateFormTabs()}
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSaveCreate} disabled={saving || duplicateCheck.isBlocked} className="bg-bw-amber hover:bg-bw-amber/90 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT DIALOG (Shared Component) ──────────────────────────────── */}
      <SupplierEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        supplier={selectedSupplier}
        onSaved={() => handleRefresh()}
      />

      {/* ─── DELETE DIALOG ──────────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              確認刪除
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              確定要刪除供應商 <span className="font-semibold text-gray-900">{selectedSupplier?.display_name || selectedSupplier?.chinese_name || selectedSupplier?.name || "未命名"}</span> 嗎？
            </p>
            <p className="text-xs text-gray-400 mt-2">此操作無法復原。</p>
          </div>
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={saving}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
