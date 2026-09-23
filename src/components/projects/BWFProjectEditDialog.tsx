"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Save,
  X,
  ExternalLink,
  FolderOpen,
  Search,
  Plus,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  updateBWFProject,
  quickCreateCustomer,
  fetchPMStaffOptions,
  fetchDesignerStaffOptions,
  fetchDistrictOptions,
  fetchFinancialYearOptions,
  fetchTeamTypeOptions,
  fetchBWFServiceTypeOptions,
  fetchSourceTypeOptions,
  fetchClientTypeOptions,
  fetchBWFMajorQuoteOptions,
  fetchServiceItemOptions,
  fetchBWFProjectServiceTypeIds,
  fetchBWFProjectServiceItemIds,
  fetchBWFProjectMajorQuoteIds,
  fetchCostCentres,
  searchCustomerOptions,
  fetchCustomerDisplayName,
  searchBuildingOptions,
  type BWFProjectDetailData,
  type LinkOption,
  type BWFServiceTypeOption,
  type ServiceItemOption,
  type CostCentreData,
} from "@/lib/data-service";
import { createClient } from "@/lib/supabase/client";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import { useAuth } from "@/hooks/use-auth";
import {
  UnsavedDialogDraftHint,
  useSoftDialogSession,
} from "@/hooks/use-soft-dialog-draft";

interface BWFProjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData: BWFProjectDetailData;
}

const EMPTY_FORM = {
  project_code: "",
  project_name: "",
  project_content: "",
  status: "",
  customer_id: "",
  main_pm_id: "",
  main_designer_id: "",
  other_pm_id: "",
  more_pm_id: "",
  size: "",
  os_size: "",
  site_address: "",
  district_id: "",
  r_building_id: "",
  cost_center_id: "",
  n_financial_year_id: "",
  n_team_type_id: "",
  n_service_type_id: "",
  n_source_id: "",
  n_customer_type_id: "",
  n_major_quotes_id: "",
  n_service_items_id: "",
  enquiry_date: "",
  signed_date: "",
  start_date: "",
  handover_date: "",
  asana_link: "",
  working_folder: "",
};

type BwfProjectForm = typeof EMPTY_FORM;

type BwfProjectDraft = {
  form: BwfProjectForm;
  customerLabel: string;
  buildingLabel: string;
};

const OS_SIZE_OPTIONS = [
  "Small (<$50K)",
  "Middle (<$50-150K)",
  "Big (>$150K)",
];

const OFFICIAL_STATUS_VALUES = new Set<string>(
  PROJECT_STATUS_OPTIONS.map((opt) => opt.value),
);

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

// ─── MULTI-SELECT PILL GROUP (comma-joined value) ───
function MultiPillGroup({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = value ? value.split(",").filter(Boolean) : [];
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onChange(next.join(","));
  };
  return (
    <div className="col-span-2 space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
        <span className="text-xs text-gray-400 ml-1.5 font-normal">(可多選)</span>
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSel = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                isSel
                  ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 font-medium ring-1 ring-fuchsia-500"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PILL SELECTOR (single-select) ───
function PillGroup({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="col-span-2 space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.length === 0 && (
          <p className="text-xs text-gray-400 py-1">沒有選項</p>
        )}
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(value === opt.id ? "" : opt.id)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
              value === opt.id
                ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 font-medium ring-1 ring-fuchsia-500"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── SEARCHABLE SELECT ─────
function SearchableSelect({
  value,
  onChange,
  placeholder,
  searchFn,
  initialLabel,
  onLabelChange,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchFn: (term: string) => Promise<LinkOption[]>;
  initialLabel?: string;
  onLabelChange?: (label: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel || "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      searchFn("").then((opts) => {
        setOptions(opts);
        setLoading(false);
      });
    }
  }, [isOpen, searchFn]);

  useEffect(() => {
    if (!isOpen) return;
    if (!searchTerm) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchFn(searchTerm);
      setOptions(results);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, isOpen, searchFn]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialLabel) setSelectedLabel(initialLabel);
  }, [initialLabel]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm("");
        }}
      >
        <span
          className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}
        >
          {value && selectedLabel ? selectedLabel : placeholder}
        </span>
        <Search className="w-4 h-4 shrink-0 opacity-50" />
      </button>
      {isOpen && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="搜尋..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="ml-2 text-xs text-gray-500">搜尋中...</span>
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400">
                沒有找到相關結果
              </div>
            )}
            {!loading &&
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    value === opt.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700"
                  }`}
                  onClick={() => {
                    onChange(opt.id);
                    setSelectedLabel(opt.label);
                    onLabelChange?.(opt.label);
                    setIsOpen(false);
                  }}
                >
                  <span className="block truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-[13px] text-gray-400 truncate">
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUICK ADD CUSTOMER SUB-DIALOG ─────────────────────────
function QuickAddCustomerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, label: string) => void;
}) {
  const [form, setForm] = useState({
    display_name: "",
    customer_name: "",
    phone_display: "",
    phone_number_a: "",
    email: "",
    asana_link: "",
    enquiry_date: new Date().toISOString().split("T")[0],
    remark: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        display_name: "",
        customer_name: "",
        phone_display: "",
        phone_number_a: "",
        email: "",
        asana_link: "",
        enquiry_date: new Date().toISOString().split("T")[0],
        remark: "",
      });
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      setError("顯示名稱 Display Name 為必填");
      return;
    }
    if (!form.customer_name.trim()) {
      setError("聯絡人名稱 Customer Name 為必填");
      return;
    }
    if (!form.phone_display.trim()) {
      setError("主要電話號碼 Primary Phone 為必填");
      return;
    }
    if (!form.enquiry_date) {
      setError("查詢日期 Enquiry Date 為必填");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await quickCreateCustomer({
      display_name: form.display_name.trim(),
      customer_name: form.customer_name.trim(),
      phone_display: form.phone_display.trim(),
      phone_number_a: form.phone_number_a.trim() || undefined,
      email: form.email.trim() || undefined,
      asana_link: form.asana_link.trim() || undefined,
      enquiry_date: form.enquiry_date || undefined,
      remark: form.remark.trim() || undefined,
    });

    if (result.success && result.id) {
      onCreated(result.id, result.label || form.display_name);
      onClose();
    } else {
      setError(result.error || "建立客戶失敗");
    }
    setSaving(false);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            快速新增客戶 New Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              顯示名稱 Display Name<span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-blue-500">
              ⓘ 此欄位用於搜尋用途，請加入更多說明以便日後搜尋
            </p>
            <Input
              placeholder="Display Name"
              value={form.display_name}
              onChange={(e) => updateField("display_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              聯絡人名稱 Customer Name<span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Customer Name"
              value={form.customer_name}
              onChange={(e) => updateField("customer_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              主要電話號碼 Primary Phone<span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Primary Phone"
              value={form.phone_display}
              onChange={(e) => updateField("phone_display", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              後備(固網)電話號碼 Secondary Phone
            </Label>
            <Input
              placeholder="Secondary Phone"
              value={form.phone_number_a}
              onChange={(e) => updateField("phone_number_a", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">電郵 Email</Label>
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Asana 連結</Label>
            <Input
              placeholder="Asana Link"
              value={form.asana_link}
              onChange={(e) => updateField("asana_link", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              查詢日期 Enquiry Date<span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={form.enquiry_date}
              onChange={(e) => updateField("enquiry_date", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">備註 Remarks</Label>
            <Textarea
              placeholder="Remarks"
              rows={3}
              value={form.remark}
              onChange={(e) => updateField("remark", e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 rounded-md p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            建立客戶
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── project_bv helpers (BWF projects use bwf_project_id) ───
async function fetchProjectBVByBwfProjectId(
  projectId: string
): Promise<{ id: string; handler_id: string | null }[]> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "query",
        table: "project_bv",
        filter: { bwf_project_id: projectId },
      }),
    });
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("[BWFProjectEditDialog] fetchProjectBV error:", err);
    return [];
  }
}

async function createProjectBV(data: {
  bwf_project_id: string;
  handler_id: string;
  created_date: string;
  modified_date: string;
}): Promise<void> {
  await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", table: "project_bv", data }),
  });
}

async function updateProjectBV(
  id: string,
  updates: { handler_id?: string; modified_date?: string }
): Promise<void> {
  await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", table: "project_bv", id, updates }),
  });
}

async function deleteProjectBV(id: string): Promise<void> {
  await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", table: "project_bv", id }),
  });
}

// ─── MAIN DIALOG ─────────────────────────────────────────────
export default function BWFProjectEditDialog({
  open,
  onClose,
  onSaved,
  editData,
}: BWFProjectEditDialogProps) {
  const { staff } = useAuth();
  const isSuperAdmin = (staff as { role?: string } | null)?.role === "Super Admin";

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const editId = editData.id;
  const {
    hydrateReady,
    showUnsavedHint,
    markUserEdited,
    syncDraft,
    beginFreshHydrate,
    finishHydrate,
    applyRestoredDraft,
    handleDismiss: dismissDraft,
    handleCancel: cancelDraft,
    handleSavedClose,
  } = useSoftDialogSession<BwfProjectDraft>("bwf-project", editId);

  const [pmStaffOptions, setPmStaffOptions] = useState<LinkOption[]>([]);
  const [designerStaffOptions, setDesignerStaffOptions] = useState<LinkOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LinkOption[]>([]);
  const [fyOptions, setFyOptions] = useState<LinkOption[]>([]);
  const [teamTypeOptions, setTeamTypeOptions] = useState<LinkOption[]>([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState<BWFServiceTypeOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<LinkOption[]>([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState<LinkOption[]>([]);
  const [majorQuoteOptions, setMajorQuoteOptions] = useState<LinkOption[]>([]);
  const [serviceItemOptions, setServiceItemOptions] = useState<ServiceItemOption[]>([]);
  const [costCentreOptions, setCostCentreOptions] = useState<CostCentreData[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [customerLabel, setCustomerLabel] = useState("");
  const [buildingLabel, setBuildingLabel] = useState("");
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [pmStaff, designerStaff, districts, fys, teamTypes, serviceTypes, sources, customerTypes, majorQuotes, serviceItems, costCentres] =
        await Promise.all([
          fetchPMStaffOptions(),
          fetchDesignerStaffOptions(),
          fetchDistrictOptions(),
          fetchFinancialYearOptions(),
          fetchTeamTypeOptions(),
          fetchBWFServiceTypeOptions(),
          fetchSourceTypeOptions(),
          fetchClientTypeOptions(),
          fetchBWFMajorQuoteOptions(),
          fetchServiceItemOptions(),
          fetchCostCentres(),
        ]);
      setPmStaffOptions(pmStaff);
      setDesignerStaffOptions(designerStaff);
      setDistrictOptions(districts);
      setFyOptions(fys);
      setTeamTypeOptions(teamTypes);
      setServiceTypeOptions(serviceTypes);
      setSourceOptions(sources);
      setCustomerTypeOptions(customerTypes);
      setMajorQuoteOptions(majorQuotes);
      setServiceItemOptions(serviceItems);
      setCostCentreOptions(costCentres);
    } catch (err) {
      console.error("[BWFProjectEditDialog] loadOptions error:", err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const applyDraft = (draft: BwfProjectDraft) => {
    setForm(draft.form);
    setCustomerLabel(draft.customerLabel);
    setBuildingLabel(draft.buildingLabel);
  };

  const currentDraft = (): BwfProjectDraft => ({
    form,
    customerLabel,
    buildingLabel,
  });

  useEffect(() => {
    let cancelled = false;

    if (!open || !editData) {
      return () => {
        cancelled = true;
      };
    }

    loadOptions();
    setError(null);

    if (applyRestoredDraft(applyDraft)) {
      return () => {
        cancelled = true;
      };
    }

    beginFreshHydrate();
    setForm({
      project_code: editData.project_code || "",
      project_name: editData.project_name || "",
      project_content: editData.description || "",
      status: editData.status || "",
      customer_id: editData.customer_id || "",
      main_pm_id: editData.main_pm_id || "",
      main_designer_id: editData.main_designer_id || "",
      other_pm_id: editData.other_pm_id || "",
      more_pm_id: editData.more_pm_id || "",
      size: editData.size || "",
      os_size: editData.project_size || "",
      site_address: editData.site_address || "",
      district_id: editData.r_nos_district_id || "",
      r_building_id: editData.r_building_id || "",
      cost_center_id: editData.cost_centre_id || "",
      n_financial_year_id: editData.n_financial_year_id || "",
      n_team_type_id: editData.n_team_type_id || "",
      n_service_type_id: editData.n_service_type_id || "",
      n_source_id: "",
      n_customer_type_id: "",
      n_major_quotes_id: "",
      n_service_items_id: "",
      enquiry_date: toDateInput(editData.enquiry_date),
      signed_date: toDateInput(editData.signed_date),
      start_date: toDateInput(editData.start_date),
      handover_date: toDateInput(editData.handover_date),
      asana_link: editData.asana_link || "",
      working_folder: editData.working_folder || "",
    });

    setCustomerLabel(
      editData.customer_display_name ||
        editData.customer_name ||
        editData.real_customer_display_name ||
        "",
    );
    setBuildingLabel(editData.building_name || editData.real_building_name || "");

    const finishEditHydrate = async () => {
      if (editData.customer_id) {
        const displayName = await fetchCustomerDisplayName(editData.customer_id);
        if (!cancelled && displayName) setCustomerLabel(displayName);
      }

      const supabase = createClient();
      const [stIds, siIds, mqIds, fkRes] = await Promise.all([
        fetchBWFProjectServiceTypeIds(editData.id),
        fetchBWFProjectServiceItemIds(editData.id),
        fetchBWFProjectMajorQuoteIds(editData.id),
        supabase
          .from("bwf_projects")
          .select("n_source_id, n_customer_type_id")
          .eq("id", editData.id)
          .single(),
      ]);
      if (cancelled) return;
      setForm((prev) => ({
        ...prev,
        ...(stIds.length > 0 ? { n_service_type_id: stIds.join(",") } : {}),
        ...(siIds.length > 0 ? { n_service_items_id: siIds.join(",") } : {}),
        ...(mqIds.length > 0 ? { n_major_quotes_id: mqIds.join(",") } : {}),
        ...(fkRes.data?.n_source_id
          ? { n_source_id: fkRes.data.n_source_id }
          : {}),
        ...(fkRes.data?.n_customer_type_id
          ? { n_customer_type_id: fkRes.data.n_customer_type_id }
          : {}),
      }));
      if (!cancelled) finishHydrate();
    };
    finishEditHydrate();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, loadOptions, applyRestoredDraft, beginFreshHydrate, finishHydrate]);

  const handleSave = async () => {
    const missingFields: string[] = [];
    if (!form.customer_id) missingFields.push("客戶 Customer");
    if (!form.cost_center_id) missingFields.push("公司單位 Cost Centre");
    if (!form.main_pm_id) missingFields.push("主要項目經理 Main PM");
    if (!form.n_service_type_id) missingFields.push("服務類型 Service Type");
    if (!form.enquiry_date) missingFields.push("查詢日期 Enquiry Date");
    if (!form.project_content.trim() && !form.project_name.trim()) {
      missingFields.push("項目內容 Project Content 或 項目名稱 Project Name");
    }

    if (missingFields.length > 0) {
      setError(`以下必填欄位尚未填寫，請補充：\n• ${missingFields.join("\n• ")}`);
      setTimeout(
        () => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        50,
      );
      return;
    }

    setSaving(true);
    setError(null);

    const selectedServiceTypeIds = form.n_service_type_id
      ? form.n_service_type_id.split(",").filter(Boolean)
      : [];
    const selectedMajorQuoteIds = form.n_major_quotes_id
      ? form.n_major_quotes_id.split(",").filter(Boolean)
      : [];
    const selectedServiceItemIds = form.n_service_items_id
      ? form.n_service_items_id.split(",").filter(Boolean)
      : [];

    const payload: Record<string, unknown> = {};
    if (form.project_code) payload.project_code = form.project_code;
    if (form.project_name) payload.project_name = form.project_name;
    if (form.project_content) payload.project_content = form.project_content;
    if (form.status) payload.status = form.status;
    if (form.customer_id) payload.customer_id = form.customer_id;
    if (form.main_pm_id) payload.main_pm_id = form.main_pm_id;
    if (form.main_designer_id) payload.main_designer_id = form.main_designer_id;
    if (form.other_pm_id) payload.other_pm_id = form.other_pm_id;
    if (form.more_pm_id) payload.more_pm_id = form.more_pm_id;
    if (form.size) payload.size = form.size;
    if (form.os_size) payload.os_size = form.os_size;
    if (form.site_address) payload.site_address = form.site_address;
    if (form.district_id) payload.r_district_id = form.district_id;
    if (form.r_building_id) payload.r_building_id = form.r_building_id;
    if (form.cost_center_id) {
      payload.cost_center_id = form.cost_center_id;
      const resolvedCostCentre = costCentreOptions.find((cc) => cc.id === form.cost_center_id)?.display;
      if (resolvedCostCentre) payload.real_cost_centre = resolvedCostCentre;
    }
    if (form.n_financial_year_id) payload.n_financial_year_id = form.n_financial_year_id;
    if (form.n_team_type_id) payload.n_team_type_id = form.n_team_type_id;
    if (selectedServiceTypeIds.length > 0) {
      payload.n_bwf_service_types_id = selectedServiceTypeIds[0];
    }
    if (form.n_source_id) payload.n_source_id = form.n_source_id;
    if (form.n_customer_type_id) payload.n_customer_type_id = form.n_customer_type_id;
    if (selectedMajorQuoteIds.length > 0) payload.n_major_quotes_id = selectedMajorQuoteIds[0];
    if (selectedServiceItemIds.length > 0) payload.n_service_items_id = selectedServiceItemIds[0];
    if (form.enquiry_date) payload.enquiry_date = form.enquiry_date;
    if (form.signed_date) payload.signed_date = form.signed_date;
    payload.start_date = form.start_date || null;
    payload.handover_date = form.handover_date || null;
    if (form.asana_link) payload.asana_link = form.asana_link;
    if (form.working_folder) payload.working_folder = form.working_folder;
    payload.modified_date = new Date().toISOString();

    try {
      const result = await updateBWFProject(editData.id, payload);

      if (!result.success) {
        setError(result.error || "儲存失敗");
        return;
      }

      const projectId = editData.id;
      const bvTimestamp = new Date().toISOString();
      const oldPmId = editData.main_pm_id || "";
      const oldDesignerId = editData.main_designer_id || "";
      const newPmId = form.main_pm_id || "";
      const newDesignerId = form.main_designer_id || "";
      const pmChanged = newPmId !== oldPmId;
      const designerChanged = newDesignerId !== oldDesignerId;

      if (pmChanged || designerChanged) {
        try {
          const existingBVs = await fetchProjectBVByBwfProjectId(projectId);

          if (pmChanged) {
            const oldPmBV = oldPmId
              ? existingBVs.find((bv) => bv.handler_id === oldPmId)
              : null;
            if (oldPmBV && newPmId) {
              await updateProjectBV(oldPmBV.id, {
                handler_id: newPmId,
                modified_date: bvTimestamp,
              });
            } else if (oldPmBV && !newPmId) {
              await deleteProjectBV(oldPmBV.id);
            } else if (!oldPmBV && newPmId) {
              const alreadyExists = existingBVs.some((bv) => bv.handler_id === newPmId);
              if (!alreadyExists) {
                await createProjectBV({
                  bwf_project_id: projectId,
                  handler_id: newPmId,
                  created_date: bvTimestamp,
                  modified_date: bvTimestamp,
                });
                void notifyProjectBvCreated(createClient(), {
                  rows: [{ handler_id: newPmId, bwf_project_id: projectId }],
                  assignerStaffId: staff?.id ?? null,
                  assignerName: staff?.name ?? null,
                  projectCode: form.project_code || editData.project_code,
                  projectName: form.project_name || editData.project_name,
                });
              }
            }
          }

          if (designerChanged) {
            const oldDesignerBV = oldDesignerId
              ? existingBVs.find((bv) => bv.handler_id === oldDesignerId)
              : null;
            if (oldDesignerBV && newDesignerId) {
              const alreadyExists = existingBVs.some((bv) => bv.handler_id === newDesignerId);
              if (!alreadyExists) {
                await updateProjectBV(oldDesignerBV.id, {
                  handler_id: newDesignerId,
                  modified_date: bvTimestamp,
                });
              } else {
                await deleteProjectBV(oldDesignerBV.id);
              }
            } else if (oldDesignerBV && !newDesignerId) {
              await deleteProjectBV(oldDesignerBV.id);
            } else if (!oldDesignerBV && newDesignerId) {
              const alreadyExists = existingBVs.some((bv) => bv.handler_id === newDesignerId);
              if (!alreadyExists) {
                await createProjectBV({
                  bwf_project_id: projectId,
                  handler_id: newDesignerId,
                  created_date: bvTimestamp,
                  modified_date: bvTimestamp,
                });
                void notifyProjectBvCreated(createClient(), {
                  rows: [{ handler_id: newDesignerId, bwf_project_id: projectId }],
                  assignerStaffId: staff?.id ?? null,
                  assignerName: staff?.name ?? null,
                  projectCode: form.project_code || editData.project_code,
                  projectName: form.project_name || editData.project_name,
                });
              }
            }
          }
        } catch (err) {
          console.error("[BWFProjectEditDialog] Failed to sync project_bv on edit:", err);
        }
      }

      try {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete-where",
            table: "bwf_project_bwf_service_types",
            filter: { project_id: projectId },
          }),
        });
        await Promise.all(
          selectedServiceTypeIds.map((stId) =>
            fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "create",
                table: "bwf_project_bwf_service_types",
                data: { project_id: projectId, service_type_id: stId },
              }),
            }),
          ),
        );
      } catch (err) {
        console.error("[BWFProjectEditDialog] Failed to sync service types junction:", err);
      }

      try {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete-where",
            table: "bwf_project_service_items",
            filter: { project_id: projectId },
          }),
        });
        await Promise.all(
          selectedServiceItemIds.map((siId) =>
            fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "create",
                table: "bwf_project_service_items",
                data: { project_id: projectId, service_item_id: siId },
              }),
            }),
          ),
        );
      } catch (err) {
        console.error("[BWFProjectEditDialog] Failed to sync service items junction:", err);
      }

      try {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete-where",
            table: "bwf_project_major_quotes",
            filter: { project_id: projectId },
          }),
        });
        await Promise.all(
          selectedMajorQuoteIds.map((mqId) =>
            fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "create",
                table: "bwf_project_major_quotes",
                data: { project_id: projectId, major_quote_id: mqId },
              }),
            }),
          ),
        );
      } catch (err) {
        console.error("[BWFProjectEditDialog] Failed to sync major quotes junction:", err);
      }

      handleSavedClose(onClose);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    markUserEdited();
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDismiss = () => dismissDraft(currentDraft(), onClose);
  const handleCancel = () => cancelDraft(onClose);

  const selectedServiceTypeIds = form.n_service_type_id
    ? form.n_service_type_id.split(",").filter(Boolean)
    : [];
  const selectedServiceTypes = serviceTypeOptions.filter((t) =>
    selectedServiceTypeIds.includes(t.id),
  );
  const showFastBuild = selectedServiceTypes.some((t) => t.isFastBuild);
  const showFurniture = selectedServiceTypes.some((t) => t.label.includes("Furniture"));
  const showMaterial = selectedServiceTypes.some((t) => t.label.includes("Material"));
  const showBranding = selectedServiceTypes.some((t) => t.label.includes("Branding"));

  const serviceItemGroups = [
    { key: "fast", title: "Fast Build", show: showFastBuild, items: serviceItemOptions.filter((i) => i.isFastBuild) },
    { key: "furniture", title: "Furniture", show: showFurniture, items: serviceItemOptions.filter((i) => i.isFurniture) },
    { key: "material", title: "Material", show: showMaterial, items: serviceItemOptions.filter((i) => i.isMaterial) },
    { key: "branding", title: "Branding", show: showBranding, items: serviceItemOptions.filter((i) => i.isBranding) },
  ].filter((g) => g.show && g.items.length > 0);

  const leftoverStatus =
    form.status && !OFFICIAL_STATUS_VALUES.has(form.status) ? form.status : null;

  useEffect(() => {
    if (!open || !hydrateReady) return;
    syncDraft(currentDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hydrateReady, form, customerLabel, buildingLabel, syncDraft]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-3xl !grid !grid-rows-[auto_1fr_auto] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500 flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            編輯傢俬項目 Edit BWF Project
          </DialogTitle>
          <UnsavedDialogDraftHint visible={showUnsavedHint} />
        </DialogHeader>

        <div className="overflow-y-auto min-h-0">
          {loadingOptions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
              <span className="ml-2 text-gray-500">載入選項中...</span>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* ═══ Section: 客戶 Customer ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                  客戶 Customer
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        客戶 Customer<span className="text-red-500">*</span>
                      </Label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                        onClick={() => setQuickAddCustomerOpen(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        快速新增
                      </button>
                    </div>
                    <SearchableSelect
                      value={form.customer_id}
                      onChange={(id) => updateField("customer_id", id)}
                      onLabelChange={(label) => setCustomerLabel(label)}
                      placeholder="搜尋客戶..."
                      searchFn={searchCustomerOptions}
                      initialLabel={customerLabel}
                    />
                    <QuickAddCustomerDialog
                      open={quickAddCustomerOpen}
                      onClose={() => setQuickAddCustomerOpen(false)}
                      onCreated={(id, label) => {
                        updateField("customer_id", id);
                        setCustomerLabel(label);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ Section: 項目資料 Project Details ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                  項目資料 Project Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      項目編號 Project Code
                    </Label>
                    <Input
                      placeholder="Project Code"
                      value={form.project_code}
                      onChange={(e) => updateField("project_code", e.target.value)}
                      disabled={!isSuperAdmin}
                    />
                    {!isSuperAdmin && (
                      <p className="text-xs text-gray-400">僅超級管理員可修改</p>
                    )}
                    {isSuperAdmin && (
                      <p className="text-xs text-amber-500">超級管理員可手動修改編號</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      公司單位 Cost Centre<span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.cost_center_id}
                      onValueChange={(v) => updateField("cost_center_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cost Centre" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCentreOptions.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.bu_code} — {cc.display || cc.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      財政年度 Financial Year
                    </Label>
                    <Select
                      value={form.n_financial_year_id}
                      onValueChange={(v) => updateField("n_financial_year_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Financial Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {fyOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      項目狀態 Status
                    </Label>
                    <Select
                      value={form.status || undefined}
                      onValueChange={(v) => updateField("status", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇狀態" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {projectStatusFilterLabel(opt.value)}
                          </SelectItem>
                        ))}
                        {leftoverStatus && (
                          <SelectItem value={leftoverStatus}>
                            {leftoverStatus}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm font-medium">
                      項目名稱 Project Name
                    </Label>
                    <Input
                      placeholder="Project Name"
                      value={form.project_name}
                      onChange={(e) => updateField("project_name", e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm font-medium">
                      項目內容 Project Content<span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder="項目內容..."
                      rows={3}
                      value={form.project_content}
                      onChange={(e) => updateField("project_content", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      查詢日期 Enquiry Date<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={form.enquiry_date}
                      onChange={(e) => updateField("enquiry_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      簽約日期 Signed Date
                    </Label>
                    <Input
                      type="date"
                      value={form.signed_date}
                      onChange={(e) => updateField("signed_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      開工日期 Start Date
                    </Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => updateField("start_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      交樓日期 Handover Date
                    </Label>
                    <Input
                      type="date"
                      value={form.handover_date}
                      onChange={(e) => updateField("handover_date", e.target.value)}
                    />
                  </div>

                  <PillGroup
                    label="來源 Source"
                    options={sourceOptions}
                    value={form.n_source_id}
                    onChange={(id) => updateField("n_source_id", id)}
                  />

                  <PillGroup
                    label="客戶類型 Customer Type"
                    options={customerTypeOptions}
                    value={form.n_customer_type_id}
                    onChange={(id) => updateField("n_customer_type_id", id)}
                  />

                  <PillGroup
                    label="工程規模 Project Size"
                    options={OS_SIZE_OPTIONS.map((o) => ({ id: o, label: o }))}
                    value={form.os_size}
                    onChange={(id) => updateField("os_size", id)}
                  />

                  <MultiPillGroup
                    label="主要報價 Major Quote"
                    options={majorQuoteOptions}
                    value={form.n_major_quotes_id}
                    onChange={(v) => updateField("n_major_quotes_id", v)}
                  />

                  <MultiPillGroup
                    label="服務類型 Service Type"
                    required
                    options={serviceTypeOptions}
                    value={form.n_service_type_id}
                    onChange={(v) => updateField("n_service_type_id", v)}
                  />

                  {serviceItemGroups.length > 0 && (
                    <div className="col-span-2 space-y-3">
                      <Label className="text-sm font-medium">服務項目 Service Items</Label>
                      {serviceItemGroups.map((g) => (
                        <div key={g.key} className="space-y-1.5">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {g.title}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {g.items.map((opt) => {
                              const selectedIds = form.n_service_items_id
                                ? form.n_service_items_id.split(",").filter(Boolean)
                                : [];
                              const isSelected = selectedIds.includes(opt.id);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected
                                      ? selectedIds.filter((id) => id !== opt.id)
                                      : [...selectedIds, opt.id];
                                    updateField("n_service_items_id", next.join(","));
                                  }}
                                  className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                                    isSelected
                                      ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 font-medium ring-1 ring-fuchsia-500"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ Section: 負責人 Staff Assignment ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                  負責人 Staff Assignment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm font-medium">
                      團隊類型 Team Type
                    </Label>
                    <Select
                      value={form.n_team_type_id}
                      onValueChange={(v) => updateField("n_team_type_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇團隊" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamTypeOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      主要項目經理 Main PM<span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.main_pm_id}
                      onValueChange={(v) => updateField("main_pm_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Main PM" />
                      </SelectTrigger>
                      <SelectContent>
                        {pmStaffOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            <span
                              className={
                                opt.status === "Inactive"
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }
                            >
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      主要設計師 Main Designer
                    </Label>
                    <Select
                      value={form.main_designer_id}
                      onValueChange={(v) => updateField("main_designer_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Main Designer" />
                      </SelectTrigger>
                      <SelectContent>
                        {designerStaffOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            <span
                              className={
                                opt.status === "Inactive"
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }
                            >
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ═══ Section: 工地資料 Site Info ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                  工地資料 Site Info
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      工程面積 Size (sq. ft.)
                    </Label>
                    <Input
                      type="number"
                      placeholder="Size (sq. ft.)"
                      value={form.size}
                      onChange={(e) => updateField("size", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">地區 District</Label>
                    <Select
                      value={form.district_id}
                      onValueChange={(v) => updateField("district_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="District" />
                      </SelectTrigger>
                      <SelectContent>
                        {districtOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      搜尋並選擇大廈 Building
                    </Label>
                    <SearchableSelect
                      value={form.r_building_id}
                      onChange={(id) => updateField("r_building_id", id)}
                      placeholder="搜尋大廈..."
                      searchFn={searchBuildingOptions}
                      initialLabel={buildingLabel}
                    />
                  </div>

                  <div />

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm font-medium">
                      工程地址 Site Address
                    </Label>
                    <Textarea
                      placeholder="輸入完整工地地址"
                      rows={2}
                      value={form.site_address}
                      onChange={(e) => updateField("site_address", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ═══ Section: 連結 Links ═══ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                  連結 Links
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Asana 連結
                    </Label>
                    <Input
                      placeholder="Asana Link"
                      value={form.asana_link}
                      onChange={(e) => updateField("asana_link", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" />
                      工作資料夾 Working Folder
                    </Label>
                    <Input
                      placeholder="Working Folder"
                      value={form.working_folder}
                      onChange={(e) => updateField("working_folder", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              ref={errorRef}
              className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line"
            >
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> 取消
          </Button>
          <Button
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
            onClick={handleSave}
            disabled={saving || loadingOptions}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
