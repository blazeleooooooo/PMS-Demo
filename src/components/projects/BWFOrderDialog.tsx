"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Save, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchBWFOrderDetail,
  fetchInstallationTeamOptions,
  searchBWFProjectOptions,
  searchBWFPitchingOptions,
  searchBWFProductTypeOptions,
  searchBWFProductOptionsByType,
  searchFactoryOptions,
  fetchBWFProjectLabel,
  fetchBWFPitchingLabel,
  fetchBWFProjectIdByPitching,
  fetchBWFPitchingIdByProject,
  verifyBWFOrderLinkAlignment,
  fetchBWFProductLabel,
  fetchBWFProductTypeForProduct,
  fetchBWFProductTypeLabel,
  fetchFactoryLabel,
  createBWFOrder,
  updateBWFOrder,
  type LinkOption,
} from "@/lib/data-service";
import { useAuth } from "@/hooks/use-auth";

interface BWFOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, edit this order; otherwise create a new one. */
  orderId?: string | null;
  /** Pre-fill project when creating from project detail. */
  defaultProjectId?: string;
  defaultProjectLabel?: string;
  lockProject?: boolean;
  defaultPitchingId?: string;
  defaultPitchingLabel?: string;
  lockPitching?: boolean;
}

/** Backend-only status — displayable, not user-selectable. */
export const ORDER_STATUS_TEMP_COMPLETED = "暫時完結";

// User-selectable order status options (excludes backend-only values).
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
  [ORDER_STATUS_TEMP_COMPLETED]: "暫時完結（系統）",
};

export const ORDER_STATUS_CHINESE: Record<string, string> = {
  "Pending Orders": "待下單",
  "Unpaid Deposits": "未付訂金",
  "In Production": "生產中",
  "Overdue Production": "過期生產",
  "Upcoming Deliveries": "準備送貨",
  "Awaiting Installation": "待安裝",
  "Overdue Payment (>90 days)": "付款逾期 (>90天)",
  "Confirmed - Unordered": "已取消訂單",
  Completed: "已完成",
  [ORDER_STATUS_TEMP_COMPLETED]: "暫時完結",
};

export function getOrderStatusChinese(status: string | null | undefined): string {
  if (!status) return "未設定";
  return ORDER_STATUS_CHINESE[status] || status;
}

export function isBackendOnlyOrderStatus(status: string | null | undefined): boolean {
  return status === ORDER_STATUS_TEMP_COMPLETED;
}
const DELIVERY_TARGETS = ["Factory", "Warehouse", "Client"];
const DELIVERY_LABELS: Record<string, string> = {
  Factory: "廠商 Factory",
  Warehouse: "倉庫 Warehouse",
  Client: "客戶 Client",
};

const EMPTY = {
  bwf_pitching_id: "",
  bwf_project_id: "",
  product_id: "",
  factory_id: "",
  quantity: "",
  o_order_status: "Pending Orders",
  o_delivery_target: "",
  installation_team_id: "",
  installer_needed: false,
  production_start_date: "",
  production_finish_date_est: "",
  production_finish_date: "",
  site_arrival_date_est: "",
  site_arrival_date: "",
  complete_installation_date_est: "",
  complete_installation_date: "",
  remarks: "",
};

type FormState = typeof EMPTY;
type LinkMode = "pitching" | "project";

// ─── Searchable select (server-side search), mirrors BWFPitchingDialog ─────
function SearchableSelect({
  value,
  onChange,
  placeholder,
  searchFn,
  initialLabel,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}: {
  value: string;
  onChange: (id: string, label: string) => void;
  placeholder: string;
  searchFn: (term: string) => Promise<LinkOption[]>;
  initialLabel?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = useCallback((next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }, [isControlled, onOpenChange]);
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel || "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (initialLabel) setSelectedLabel(initialLabel); }, [initialLabel]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setLoading(true);
      searchFn("").then((opts) => { setOptions(opts); setLoading(false); });
    }
  }, [isOpen, searchFn]);

  useEffect(() => {
    if (!isOpen || !searchTerm) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setOptions(await searchFn(searchTerm));
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, isOpen, searchFn]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen, setIsOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          setSearchTerm("");
        }}
      >
        <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {value && selectedLabel ? selectedLabel : placeholder}
        </span>
        <Search className="w-4 h-4 shrink-0 opacity-50" />
      </button>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          <div className="p-2 border-b">
            <Input autoFocus placeholder="搜尋..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="ml-2 text-xs text-gray-500">搜尋中...</span>
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">沒有找到相關結果</div>
            )}
            {!loading && options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${value === opt.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                onClick={() => { onChange(opt.id, opt.label); setSelectedLabel(opt.label); setIsOpen(false); }}
              >
                <span className="block truncate">{opt.label}</span>
                {opt.sublabel && <span className="block text-[13px] text-gray-400 truncate">{opt.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Coloured date-field label (matches the bubble colour coding).
function DateField({
  labelZh, labelEn, color, value, onChange, required = false,
}: {
  labelZh: string; labelEn: string; color: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm leading-tight block">
        <span className="text-gray-500">{labelZh}{required && <span className="text-red-500">*</span>}</span>
        <span className={`block font-medium ${color}`}>{labelEn}</span>
      </Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

export default function BWFOrderDialog({
  open,
  onClose,
  onSaved,
  orderId,
  defaultProjectId,
  defaultProjectLabel,
  lockProject = false,
  defaultPitchingId,
  defaultPitchingLabel,
  lockPitching = false,
}: BWFOrderDialogProps) {
  const { profile } = useAuth();
  const isEdit = !!orderId;
  const isPreset = lockPitching || lockProject;
  const fieldsLocked = isEdit || isPreset;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>("pitching");
  const [presetIntegrityError, setPresetIntegrityError] = useState<string | null>(null);

  const [installTeams, setInstallTeams] = useState<LinkOption[]>([]);
  const [pitchingLabel, setPitchingLabel] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [productTypeLabel, setProductTypeLabel] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [factoryLabel, setFactoryLabel] = useState("");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  const searchProductsByType = useCallback(
    (term: string) => searchBWFProductOptionsByType(productTypeId, term),
    [productTypeId],
  );

  const set = (field: keyof FormState, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const showPitchingField = isEdit
    ? !!form.bwf_pitching_id
    : linkMode === "pitching"
      ? true
      : !!form.bwf_project_id || !!form.bwf_pitching_id;

  const showProjectField = isEdit
    ? !!form.bwf_project_id
    : linkMode === "project"
      ? true
      : !!form.bwf_project_id;

  const projectFieldFirst = !isEdit && !isPreset && linkMode === "project";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPresetIntegrityError(null);
    setLinkMode("pitching");
    const teams = await fetchInstallationTeamOptions();
    setInstallTeams(teams);
    setProductTypeId("");
    setProductTypeLabel("");
    setProductLabel("");
    setFactoryLabel("");
    setProductSelectOpen(false);

    if (orderId) {
      const d = await fetchBWFOrderDetail(orderId);
      if (d) {
        const dstr = (v: string | null) => (v ? v.slice(0, 10) : "");
        setForm({
          bwf_pitching_id: d.bwf_pitching_id || "",
          bwf_project_id: d.bwf_project_id || "",
          product_id: d.product_id || "",
          factory_id: d.factory_id || "",
          quantity: d.quantity != null ? String(d.quantity) : "",
          o_order_status: d.o_order_status || "Pending Orders",
          o_delivery_target: d.o_delivery_target || "",
          installation_team_id: d.installation_team_id || "",
          installer_needed: d.installer_needed === "true" || (d.installer_needed as any) === true,
          production_start_date: dstr(d.production_start_date),
          production_finish_date_est: dstr(d.production_finish_date_est),
          production_finish_date: dstr(d.production_finish_date),
          site_arrival_date_est: dstr(d.site_arrival_date_est),
          site_arrival_date: dstr(d.site_arrival_date),
          complete_installation_date_est: dstr(d.complete_installation_date_est),
          complete_installation_date: dstr(d.complete_installation_date),
          remarks: d.remarks || "",
        });
        if (d.bwf_project_id) setProjectLabel(await fetchBWFProjectLabel(d.bwf_project_id));
        if (d.bwf_pitching_id) setPitchingLabel(await fetchBWFPitchingLabel(d.bwf_pitching_id));
        if (d.factory_id) setFactoryLabel(await fetchFactoryLabel(d.factory_id));
        if (d.product_id) {
          setProductLabel(await fetchBWFProductLabel(d.product_id));
          const resolvedTypeId = await fetchBWFProductTypeForProduct(d.product_id);
          if (resolvedTypeId) {
            setProductTypeId(resolvedTypeId);
            setProductTypeLabel(await fetchBWFProductTypeLabel(resolvedTypeId));
          }
        }
      }
    } else {
      let pitchingId = defaultPitchingId || "";
      let projectId = defaultProjectId || "";
      let pLabel = defaultPitchingLabel || "";
      let prLabel = defaultProjectLabel || "";
      let mode: LinkMode = "pitching";

      if (lockProject && defaultProjectId) {
        mode = "project";
        if (!prLabel) prLabel = await fetchBWFProjectLabel(defaultProjectId);
        const linkedPitching = await fetchBWFPitchingIdByProject(defaultProjectId);
        if (linkedPitching) {
          pitchingId = linkedPitching.id;
          pLabel = linkedPitching.label;
        } else {
          setPresetIntegrityError("此項目沒有關聯提案，無法建立訂單 This project has no linked pitching");
        }
      } else if (lockPitching && defaultPitchingId) {
        if (!pLabel) pLabel = await fetchBWFPitchingLabel(defaultPitchingId);
        const linkedProject = await fetchBWFProjectIdByPitching(defaultPitchingId);
        if (linkedProject) {
          mode = "project";
          projectId = linkedProject.id;
          prLabel = linkedProject.label;
        }
      }

      setLinkMode(mode);
      setForm({
        ...EMPTY,
        bwf_project_id: projectId,
        bwf_pitching_id: pitchingId,
      });
      setPitchingLabel(pLabel);
      setProjectLabel(prLabel);
    }
    setLoading(false);
  }, [
    orderId,
    defaultProjectId,
    defaultProjectLabel,
    defaultPitchingId,
    defaultPitchingLabel,
    lockProject,
    lockPitching,
  ]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleLinkModeChange = (mode: LinkMode) => {
    if (fieldsLocked) return;
    setLinkMode(mode);
    set("bwf_pitching_id", "");
    set("bwf_project_id", "");
    setPitchingLabel("");
    setProjectLabel("");
    setError(null);
  };

  const handlePitchingChange = async (id: string, label: string) => {
    setError(null);
    set("bwf_pitching_id", id);
    setPitchingLabel(label);
    const linkedProject = await fetchBWFProjectIdByPitching(id);
    if (linkedProject) {
      set("bwf_project_id", linkedProject.id);
      setProjectLabel(linkedProject.label);
      setLinkMode("project");
    } else {
      set("bwf_project_id", "");
      setProjectLabel("");
    }
  };

  const handleProjectChange = async (id: string, label: string) => {
    setError(null);
    set("bwf_project_id", id);
    setProjectLabel(label);
    const linkedPitching = await fetchBWFPitchingIdByProject(id);
    if (linkedPitching) {
      set("bwf_pitching_id", linkedPitching.id);
      setPitchingLabel(linkedPitching.label);
    } else {
      set("bwf_pitching_id", "");
      setPitchingLabel("");
      setError("此項目沒有關聯提案 This project has no linked pitching");
    }
  };

  const renderPitchingField = () => {
    if (!showPitchingField) return null;
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">選擇提案 Choose Pitching</Label>
        {fieldsLocked ? (
          <Input value={pitchingLabel || defaultPitchingLabel || "—"} readOnly disabled className="h-9 text-sm bg-gray-50" />
        ) : (
          <SearchableSelect
            value={form.bwf_pitching_id}
            onChange={handlePitchingChange}
            placeholder="Search with Pitching Code"
            searchFn={searchBWFPitchingOptions}
            initialLabel={pitchingLabel}
          />
        )}
      </div>
    );
  };

  const renderProjectField = () => {
    if (!showProjectField) return null;
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">選擇項目 Choose Project</Label>
        {fieldsLocked ? (
          <Input value={projectLabel || defaultProjectLabel || "—"} readOnly disabled className="h-9 text-sm bg-gray-50" />
        ) : (
          <SearchableSelect
            value={form.bwf_project_id}
            onChange={handleProjectChange}
            placeholder="Search with Project Code"
            searchFn={searchBWFProjectOptions}
            initialLabel={projectLabel}
          />
        )}
      </div>
    );
  };

  const handleSave = async () => {
    if (presetIntegrityError) {
      setError(presetIntegrityError);
      return;
    }

    if (!isEdit) {
      const alignment = await verifyBWFOrderLinkAlignment(
        form.bwf_pitching_id || null,
        form.bwf_project_id || null,
      );
      if (!alignment.ok) {
        setError(alignment.error || "請選擇項目或提案 Please select a project or pitching");
        return;
      }
    } else if (!form.bwf_project_id && !form.bwf_pitching_id) {
      setError("請選擇項目或提案 Please select a project or pitching");
      return;
    }

    const missingFields: string[] = [];
    if (!productTypeId) missingFields.push("產品類型 Product Type");
    if (!form.product_id) missingFields.push("產品 Product");
    if (!form.quantity.trim() || Number.isNaN(parseInt(form.quantity, 10))) {
      missingFields.push("數量 Quantity");
    }
    if (!form.o_order_status) missingFields.push("狀態 Status");
    if (!form.production_finish_date_est) missingFields.push("預計生產完結日期 Est. Finish Date");
    if (!form.site_arrival_date_est) missingFields.push("預計送貨日期(到達工地) Est. Site Arrival");
    if (!form.complete_installation_date_est) {
      missingFields.push("預計安裝(完成項目)日期 Est. Complete Installation");
    }
    if (!form.o_delivery_target) missingFields.push("生產後送貨到 Factory Delivery Target");
    if (missingFields.length > 0) {
      setError(`以下必填欄位尚未填寫，請補充：\n• ${missingFields.join("\n• ")}`);
      return;
    }

    setSaving(true);
    setError(null);

    const dval = (v: string) => (v ? v : null);
    const payload: Record<string, any> = {
      bwf_pitching_id: form.bwf_pitching_id || null,
      bwf_project_id: form.bwf_project_id || null,
      product_id: form.product_id || null,
      factory_id: form.factory_id || null,
      quantity: form.quantity ? parseInt(form.quantity, 10) : null,
      o_order_status: form.o_order_status || null,
      o_delivery_target: form.o_delivery_target || null,
      installation_team_id: form.installation_team_id || null,
      installer_needed: form.installer_needed ? "true" : "false",
      production_start_date: dval(form.production_start_date),
      production_finish_date_est: dval(form.production_finish_date_est),
      production_finish_date: dval(form.production_finish_date),
      site_arrival_date_est: dval(form.site_arrival_date_est),
      site_arrival_date: dval(form.site_arrival_date),
      complete_installation_date_est: dval(form.complete_installation_date_est),
      complete_installation_date: dval(form.complete_installation_date),
      remarks: form.remarks || null,
      modified_date: new Date().toISOString(),
    };

    const result = isEdit
      ? await updateBWFOrder(orderId!, payload)
      : await createBWFOrder({
          ...payload,
          created_date: new Date().toISOString(),
          created_by_id: profile?.id || null,
        });

    if (result.success) {
      onSaved();
      onClose();
    } else {
      setError(result.error || "儲存失敗");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl !grid !grid-rows-[auto_1fr_auto] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            {isEdit ? "生產訂單 Edit Order" : "新增生產訂單 New Order"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
              <span className="ml-2 text-gray-500">載入中...</span>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* ═══ Select Project ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">選擇項目 Select Project</h3>
                <div className="grid grid-cols-1 gap-4">
                  {!isEdit && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">連結類型 Link Type</Label>
                      <div className="inline-flex rounded-md border border-input p-0.5 bg-muted/30">
                        <button
                          type="button"
                          disabled={fieldsLocked}
                          onClick={() => handleLinkModeChange("pitching")}
                          className={`px-3 py-1.5 text-sm rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            linkMode === "pitching"
                              ? "bg-white shadow-sm text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          提案 Pitching
                        </button>
                        <button
                          type="button"
                          disabled={fieldsLocked}
                          onClick={() => handleLinkModeChange("project")}
                          className={`px-3 py-1.5 text-sm rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            linkMode === "project"
                              ? "bg-white shadow-sm text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          項目 Project
                        </button>
                      </div>
                    </div>
                  )}

                  {projectFieldFirst ? (
                    <>
                      {renderProjectField()}
                      {renderPitchingField()}
                    </>
                  ) : (
                    <>
                      {renderPitchingField()}
                      {renderProjectField()}
                    </>
                  )}

                  {presetIntegrityError && (
                    <div className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      {presetIntegrityError}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ Order Details ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">訂單詳細 Order Details</h3>

                {/* Row 1: Product type / Product / Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">產品類型 Product Type<span className="text-red-500">*</span></Label>
                    <SearchableSelect
                      value={productTypeId}
                      onChange={(id, label) => {
                        setProductTypeId(id);
                        setProductTypeLabel(label);
                        set("product_id", "");
                        setProductLabel("");
                        setProductSelectOpen(true);
                      }}
                      placeholder="Search product type"
                      searchFn={searchBWFProductTypeOptions}
                      initialLabel={productTypeLabel}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">產品 Product<span className="text-red-500">*</span></Label>
                    <SearchableSelect
                      value={form.product_id}
                      onChange={(id, label) => { set("product_id", id); setProductLabel(label); }}
                      placeholder={productTypeId ? "Search product" : "Select product type first"}
                      searchFn={searchProductsByType}
                      initialLabel={productLabel}
                      disabled={!productTypeId}
                      open={productSelectOpen}
                      onOpenChange={setProductSelectOpen}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">數量 Quantity<span className="text-red-500">*</span></Label>
                    <Input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className="h-9 text-sm" placeholder="1" />
                  </div>
                </div>

                {/* Row 2: Factory / Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">廠商 Factory</Label>
                    <SearchableSelect
                      value={form.factory_id}
                      onChange={(id, label) => { set("factory_id", id); setFactoryLabel(label); }}
                      placeholder="Search factory"
                      searchFn={searchFactoryOptions}
                      initialLabel={factoryLabel}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">狀態 Status<span className="text-red-500">*</span></Label>
                    {isBackendOnlyOrderStatus(form.o_order_status) ? (
                      <Input
                        value={STATUS_LABELS[form.o_order_status] || getOrderStatusChinese(form.o_order_status)}
                        disabled
                        className="h-9 text-sm bg-slate-50 text-slate-700"
                      />
                    ) : (
                      <Select value={form.o_order_status} onValueChange={(v) => set("o_order_status", v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="狀態" /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Row 3: estimate dates (coloured) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <DateField labelZh="預計生產完結日期" labelEn="Est. Finish Date" color="text-emerald-600" required
                    value={form.production_finish_date_est} onChange={(v) => set("production_finish_date_est", v)} />
                  <DateField labelZh="預計送貨日期(到達工地)" labelEn="Est. Site Arrival" color="text-blue-600" required
                    value={form.site_arrival_date_est} onChange={(v) => set("site_arrival_date_est", v)} />
                  <DateField labelZh="預計安裝(完成項目)日期" labelEn="Est. Complete Installation" color="text-violet-600" required
                    value={form.complete_installation_date_est} onChange={(v) => set("complete_installation_date_est", v)} />
                </div>

                {/* Row 4: prod start / actual finish / delivery target */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <DateField labelZh="生產開始日期" labelEn="Prod. Start Date" color="text-gray-700"
                    value={form.production_start_date} onChange={(v) => set("production_start_date", v)} />
                  <DateField labelZh="實際生產完結日期" labelEn="Actual Finish Date" color="text-emerald-600"
                    value={form.production_finish_date} onChange={(v) => set("production_finish_date", v)} />
                  <div className="space-y-1.5">
                    <Label className="text-sm leading-tight block">
                      <span className="text-gray-500">生產後送貨到<span className="text-red-500">*</span></span>
                      <span className="block font-medium text-gray-700">Factory Delivery Target</span>
                    </Label>
                    <Select value={form.o_delivery_target} onValueChange={(v) => set("o_delivery_target", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose an option..." /></SelectTrigger>
                      <SelectContent>
                        {DELIVERY_TARGETS.map((d) => (<SelectItem key={d} value={d}>{DELIVERY_LABELS[d]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 5: actual site arrival / installer needed / installation team / complete install */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <DateField labelZh="實際送貨日期(到達工地)" labelEn="Site Arrival" color="text-blue-600"
                    value={form.site_arrival_date} onChange={(v) => set("site_arrival_date", v)} />
                  <div className="space-y-1.5">
                    <Label className="text-sm leading-tight block">
                      <span className="text-gray-500">需要安排安裝?</span>
                      <span className="block font-medium text-gray-700">Installer Needed?</span>
                    </Label>
                    <div className="h-9 flex items-center">
                      <Switch checked={form.installer_needed} onCheckedChange={(c) => set("installer_needed", c)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm leading-tight block">
                      <span className="text-gray-500">安裝團隊</span>
                      <span className="block font-medium text-gray-700">Installation Team</span>
                    </Label>
                    <Select
                      value={form.installation_team_id}
                      onValueChange={(v) => set("installation_team_id", v)}
                      disabled={!form.installer_needed}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose an option..." /></SelectTrigger>
                      <SelectContent>
                        {installTeams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DateField labelZh="完成安裝(完成項目)日期" labelEn="Complete Installation" color="text-violet-600"
                    value={form.complete_installation_date} onChange={(v) => set("complete_installation_date", v)} />
                </div>

                {/* Row 6: production remark */}
                <div className="mt-4 space-y-1.5">
                  <Label className="text-sm leading-tight block">
                    <span className="text-gray-500">生產備註</span>
                    <span className="block font-medium text-gray-700">Production Remark</span>
                  </Label>
                  <Textarea rows={3} placeholder="Type here..." value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className="text-sm" />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">{error}</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || loading || !!presetIntegrityError}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {isEdit ? "Save Changes" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
