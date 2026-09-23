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
  BWA_PROJECT_SIZE_OPTIONS,
  getBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  createBWAPitching,
  updateBWAPitching,
  createPitchingBV,
  fetchPitchingBVByPitchingId,
  updatePitchingBV,
  deletePitchingBV,
  generatePitchingCode,
  quickCreateCustomer,
  fetchStaffOptions,
  fetchPMStaffOptions,
  fetchDesignerStaffOptions,
  fetchDistrictOptions,
  fetchFinancialYearOptions,
  fetchTeamTypeOptions,
  fetchServiceTypeOptions,
  fetchProjectTypeOptions,
  fetchPitchingProjectTypeIds,
  searchCustomerOptions,
  fetchCustomerDisplayName,
  searchBuildingOptions,
  fetchCurrentFinancialYear,
  fetchStaffDefaults,
  type BWAPitchingRow,
  type LinkOption,
} from "@/lib/data-service";
import { fetchQuoteProjectTypes, fetchEntityQuoteProjectTypeId } from "@/lib/site-status-service";
import { useAuth } from "@/hooks/use-auth";
import {
  UnsavedDialogDraftHint,
  useSoftDialogSession,
} from "@/hooks/use-soft-dialog-draft";
import BuildingEditDialog from "@/components/buildings/BuildingEditDialog";
import { BilingualTypeGridPicker } from "@/components/BilingualTypeGridPicker";
import type { BwaPitchingImportPrefill } from "@/lib/asana-import-map";

interface BWAPitchingDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: BWAPitchingRow | null;
  prefill?: BwaPitchingImportPrefill | null;
}

const EMPTY_FORM = {
  pitching_code: "",
  description: "",
  pitching_stages: "",
  customer_id: "",
  main_pm_id: "",
  main_designer_id: "",
  other_pm_id: "",
  more_pm_id: "",
  estimated_income: "",
  estimated_expense: "",
  os_money_size: "",
  size: "",
  actual_size: "",
  site_address: "",
  district_id: "",
  r_building_id: "",
  n_financial_year_id: "",
  n_team_type_id: "",
  n_service_type_id: "",
  n_project_types_id: "",
  quote_project_type_id: "",
  enquiry_date: "",
  asana_link: "",
  working_folder: "",
};

type BwaPitchingForm = typeof EMPTY_FORM;

type BwaPitchingDraft = {
  form: BwaPitchingForm;
  customerLabel: string;
  realCustomerDisplayName: string;
  buildingLabel: string;
  districtLabel: string;
};

const STAGE_OPTIONS = [
  "Enquiry",
  "Pitching",
  "Confirmed Project",
  "Case Closed",
];

// ─── SEARCHABLE SELECT COMPONENT (lazy + server-side search) ─────
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

  // Load initial options when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      searchFn("").then((opts) => {
        setOptions(opts);
        setLoading(false);
      });
    }
  }, [isOpen, searchFn]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    if (!searchTerm) return; // initial load handled above
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

  // Close on outside click
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

  // Set initial label from value
  useEffect(() => {
    if (initialLabel) setSelectedLabel(initialLabel);
  }, [initialLabel]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
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
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="搜尋..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Options List */}
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

  // Reset form on open
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
    // Validation
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
          {/* Display Name */}
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

          {/* Customer Name */}
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

          {/* Primary Phone */}
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

          {/* Secondary Phone */}
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

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">電郵 Email</Label>
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>

          {/* Asana Link */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Asana 連結</Label>
            <Input
              placeholder="Asana Link"
              value={form.asana_link}
              onChange={(e) => updateField("asana_link", e.target.value)}
            />
          </div>

          {/* Enquiry Date */}
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

          {/* Remarks */}
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

// ─── MAIN DIALOG COMPONENT ───────────────────────────────────
export default function BWAPitchingDialog({
  open,
  onClose,
  onSaved,
  editData,
  prefill = null,
}: BWAPitchingDialogProps) {
  const isEdit = !!editData;
  const { profile, user, isLoading: authLoading } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editId = editData?.id ?? null;
  const sessionEntityId = editId ?? prefill?.asanaTaskGid ?? null;
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
  } = useSoftDialogSession<BwaPitchingDraft>("bwa-pitching", sessionEntityId);

  // Lookup options (small lists loaded once per dialog open)
  const [staffOptions, setStaffOptions] = useState<LinkOption[]>([]);
  const [pmStaffOptions, setPmStaffOptions] = useState<LinkOption[]>([]);
  const [designerStaffOptions, setDesignerStaffOptions] = useState<LinkOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LinkOption[]>([]);
  const [fyOptions, setFyOptions] = useState<LinkOption[]>([]);
  const [teamTypeOptions, setTeamTypeOptions] = useState<LinkOption[]>([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState<LinkOption[]>(
    [],
  );
  const [projectTypeOptions, setProjectTypeOptions] = useState<LinkOption[]>(
    [],
  );
  const [quoteProjectTypeOptions, setQuoteProjectTypeOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [loadingOptions, setLoadingOptions] = useState(true);


  // For searchable fields, we keep initial labels (for edit mode)
  const [customerLabel, setCustomerLabel] = useState("");
  const [realCustomerDisplayName, setRealCustomerDisplayName] = useState("");
  const [buildingLabel, setBuildingLabel] = useState("");
  const [districtLabel, setDistrictLabel] = useState("");

  const searchDistrictOptions = useCallback(
    async (term: string): Promise<LinkOption[]> => {
      const q = term.trim().toLowerCase();
      if (!q) return districtOptions;
      return districtOptions.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.sublabel?.toLowerCase().includes(q) ?? false),
      );
    },
    [districtOptions],
  );

  // Lazy load options only when dialog opens
  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      // Load only small lookup tables
      // Customer & building use SearchableSelect with server-side search
      const [staff, pmStaff, designerStaff, districts, fys, teamTypes, serviceTypes, projectTypes] =
        await Promise.all([
          fetchStaffOptions(),
          fetchPMStaffOptions(),
          fetchDesignerStaffOptions(),
          fetchDistrictOptions(),
          fetchFinancialYearOptions(),
          fetchTeamTypeOptions(),
          fetchServiceTypeOptions(),
          fetchProjectTypeOptions(),
        ]);
      setStaffOptions(staff);
      setPmStaffOptions(pmStaff);
      setDesignerStaffOptions(designerStaff);
      setDistrictOptions(districts);
      setFyOptions(fys);
      setTeamTypeOptions(teamTypes);
      setServiceTypeOptions(serviceTypes);
      setProjectTypeOptions(projectTypes);
      fetchQuoteProjectTypes().then(setQuoteProjectTypeOptions);
    } catch (err) {
      console.error("[BWAPitchingDialog] loadOptions error:", err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  // Ref to track whether staff defaults have been applied for the current dialog session
  const staffDefaultsAppliedRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const applyDraft = (draft: BwaPitchingDraft) => {
    setForm(draft.form);
    setCustomerLabel(draft.customerLabel);
    setRealCustomerDisplayName(draft.realCustomerDisplayName);
    setBuildingLabel(draft.buildingLabel);
    setDistrictLabel(draft.districtLabel);
  };

  const currentDraft = (): BwaPitchingDraft => ({
    form,
    customerLabel,
    realCustomerDisplayName,
    buildingLabel,
    districtLabel,
  });

  // Main effect: initialize form when dialog opens (skip if a soft draft exists)
  useEffect(() => {
    let cancelled = false;

    if (!open) {
      return () => { cancelled = true; };
    }

    loadOptions();
    setError(null);

    if (applyRestoredDraft(applyDraft)) {
      staffDefaultsAppliedRef.current = true;
      return () => { cancelled = true; };
    }

    beginFreshHydrate();

    if (editData) {
      setForm({
        pitching_code: editData.pitching_code || "",
        description: editData.description || "",
        pitching_stages: editData.pitching_stages || "",
        customer_id: editData.customer_id || "",
        main_pm_id: editData.main_pm_id || "",
        main_designer_id: editData.main_designer_id || "",
        other_pm_id: (editData as any).other_pm_id || "",
        more_pm_id: (editData as any).more_pm_id || "",
        estimated_income:
          editData.estimated_income != null
            ? String(editData.estimated_income)
            : "",
        estimated_expense:
          editData.estimated_expense != null
            ? String(editData.estimated_expense)
            : "",
        os_money_size:
          editData.os_money_size ||
          getBwaProjectSize(editData.estimated_income) ||
          "",
        size: editData.size || "",
        actual_size: editData.actual_size || "",
        site_address: editData.site_address || "",
        district_id: editData.district_id || "",
        r_building_id: editData.r_building_id || "",
        n_financial_year_id: editData.n_financial_year_id || "",
        n_team_type_id: editData.n_team_type_id || "",
        n_service_type_id: editData.n_service_type_id || "",
        n_project_types_id: "",
        quote_project_type_id: "",
        // enquiry_date is a timestamptz in the DB; a <input type="date">
        // only accepts YYYY-MM-DD, so slice off the time portion or it
        // renders blank and fails the required-field check on save.
        enquiry_date: editData.enquiry_date
          ? editData.enquiry_date.slice(0, 10)
          : "",
        asana_link: editData.asana_link || "",
        working_folder: editData.working_folder || "",
      });
      setCustomerLabel(
        (editData as any).customer_display_name || editData.customer_name || editData.real_customer_display_name || "",
      );
      setRealCustomerDisplayName(
        (editData as any).real_customer_display_name || "",
      );
      setBuildingLabel(
        editData.building_name || editData.real_building_name || "",
      );
      setDistrictLabel(
        editData.district_name || editData.real_district_name || "",
      );
      staffDefaultsAppliedRef.current = true;

      const finishEditHydrate = async () => {
        if (editData.id) {
          const [ids, qptId] = await Promise.all([
            fetchPitchingProjectTypeIds(editData.id),
            fetchEntityQuoteProjectTypeId(editData.id, "pitching"),
          ]);
          if (cancelled) return;
          setForm((prev) => ({
            ...prev,
            ...(ids.length > 0 ? { n_project_types_id: ids.join(",") } : {}),
            ...(qptId ? { quote_project_type_id: qptId } : {}),
          }));
          if (editData.customer_id) {
            const displayName = await fetchCustomerDisplayName(editData.customer_id);
            if (!cancelled && displayName) setCustomerLabel(displayName);
          }
        }
        if (!cancelled) finishHydrate();
      };
      finishEditHydrate();
    } else {
      const now = new Date();
      const enquiryDateDefault = now.toISOString().split("T")[0];
      const fromAsana = prefill;
      setForm({
        ...EMPTY_FORM,
        pitching_stages: "Enquiry",
        enquiry_date: fromAsana?.enquiryDate || enquiryDateDefault,
        description: fromAsana?.description || "",
        customer_id: fromAsana?.customerId || "",
        main_pm_id: fromAsana?.mainPmId || "",
        n_team_type_id: fromAsana?.teamTypeId || "",
        n_service_type_id: fromAsana?.serviceTypeId || "",
        n_project_types_id: fromAsana?.projectTypeIds || "",
        quote_project_type_id: fromAsana?.quoteProjectTypeId || "",
        actual_size: fromAsana?.actualSize || "",
        size: fromAsana?.size || "",
        site_address: fromAsana?.siteAddress || "",
        district_id: fromAsana?.districtId || "",
        r_building_id: fromAsana?.buildingId || "",
        asana_link: fromAsana?.asanaLink || "",
        working_folder: fromAsana?.workingFolder || "",
      });
      setCustomerLabel(fromAsana?.customerLabel || "");
      setRealCustomerDisplayName(fromAsana?.realCustomerDisplayName || "");
      setBuildingLabel(fromAsana?.buildingLabel || "");
      setDistrictLabel(fromAsana?.districtLabel || "");
      staffDefaultsAppliedRef.current = Boolean(fromAsana?.mainPmId);

      const applyCreateDefaults = async () => {
        const currentFY = await fetchCurrentFinancialYear();
        if (cancelled) return;
        if (currentFY) {
          setForm((prev) =>
            prev.n_financial_year_id
              ? prev
              : { ...prev, n_financial_year_id: currentFY.id }
          );
        }
        if (fromAsana?.mainPmId) {
          setGeneratingCode(true);
          try {
            const code = await generatePitchingCode(fromAsana.mainPmId);
            if (cancelled) return;
            if (code) setForm((prev) => ({ ...prev, pitching_code: code }));
          } catch (err) {
            console.error("[BWAPitchingDialog] Failed to generate pitching code from Asana PM:", err);
          } finally {
            if (!cancelled) setGeneratingCode(false);
          }
          if (!cancelled) finishHydrate();
        }
      };
      applyCreateDefaults();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, prefill?.asanaTaskGid, loadOptions, applyRestoredDraft, beginFreshHydrate, finishHydrate]);

  // Dedicated effect: apply staff defaults once profile/user is available
  // This uses profile/user directly in deps so it fires as soon as auth resolves
  useEffect(() => {
    // Only apply for create mode when dialog is open
    if (!open || isEdit) return;
    // Already applied — skip
    if (staffDefaultsAppliedRef.current) return;
    // Auth still loading — wait for next render when it's ready
    if (authLoading) {
      console.log("[BWAPitchingDialog] Auth still loading, waiting...");
      return;
    }

    const memberId = profile?.member_id;
    const memberBubbleId = profile?.member;
    const userEmail = user?.email || profile?.email;

    if (!memberId && !memberBubbleId && !userEmail) {
      console.warn("[BWAPitchingDialog] No member_id, member, or email available, cannot set staff defaults");
      staffDefaultsAppliedRef.current = true;
      finishHydrate();
      return;
    }

    // Mark as applied immediately to prevent double-fire
    staffDefaultsAppliedRef.current = true;

    let cancelled = false;

    const applyStaffDefaults = async () => {
      console.log("[BWAPitchingDialog] Applying staff defaults:", { memberId, memberBubbleId, userEmail });
      const staffDefaults = await fetchStaffDefaults(memberId, memberBubbleId, userEmail);
      if (cancelled) return;

      if (staffDefaults) {
        console.log("[BWAPitchingDialog] ✓ Staff defaults resolved:", staffDefaults);
        setForm((prev) => {
          const updated = {
            ...prev,
            main_pm_id: staffDefaults.staffId,
            ...(staffDefaults.teamTypeId ? { n_team_type_id: staffDefaults.teamTypeId } : {}),
          };
          console.log("[BWAPitchingDialog] Form updated with staff defaults:", { main_pm_id: updated.main_pm_id, n_team_type_id: updated.n_team_type_id });
          return updated;
        });

        // Auto-generate pitching code using the default PM (same logic as handleMainPmChange)
        if (staffDefaults.staffId) {
          setGeneratingCode(true);
          try {
            const code = await generatePitchingCode(staffDefaults.staffId);
            if (cancelled) return;
            if (code) {
              setForm((prev) => ({ ...prev, pitching_code: code }));
              console.log("[BWAPitchingDialog] ✓ Pitching code auto-generated from default PM:", code);
            }
          } catch (err) {
            console.error("[BWAPitchingDialog] Failed to generate pitching code from default PM:", err);
          } finally {
            setGeneratingCode(false);
          }
        }
      } else {
        console.warn("[BWAPitchingDialog] fetchStaffDefaults returned null");
      }
      if (!cancelled) finishHydrate();
    };

    applyStaffDefaults();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, authLoading, profile, user]);

  useEffect(() => {
    if (!open || !hydrateReady) return;
    syncDraft(currentDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    hydrateReady,
    form,
    customerLabel,
    realCustomerDisplayName,
    buildingLabel,
    districtLabel,
    syncDraft,
  ]);

  const handleDismiss = () => dismissDraft(currentDraft(), onClose);
  const handleCancel = () => cancelDraft(onClose);

  const handleSave = async () => {
    // ─── Required field validation ───
    const missingFields: string[] = [];
    if (!form.pitching_code.trim()) missingFields.push("提案編號 Pitching Code");
    if (!form.n_financial_year_id) missingFields.push("財政年度 Financial Year");
    if (!form.enquiry_date) missingFields.push("查詢日期 Enquiry Date");
    if (!form.description.trim()) missingFields.push("提案描述 Description");
    if (!form.customer_id) missingFields.push("客戶 Customer");
    if (!form.n_service_type_id) missingFields.push("服務類型 Service Type");
    if (!form.n_project_types_id) missingFields.push("項目類型 Project Type");
    if (!form.main_pm_id) missingFields.push("主要項目經理 Main PM");
    if (!form.os_money_size) missingFields.push("項目規模 Project Size");
    if (!form.actual_size.trim()) missingFields.push("實用面積 SA Size");

    if (missingFields.length > 0) {
      setError(`以下必填欄位尚未填寫，請補充：\n• ${missingFields.join("\n• ")}`);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: any = {};
    if (form.pitching_code) payload.pitching_code = form.pitching_code;
    if (form.description) payload.description = form.description;
    // On create, set stage to "Enquiry"; on edit, don't allow changing stage from here
    if (!isEdit && form.pitching_stages) payload.pitching_stages = form.pitching_stages;
    if (form.customer_id) payload.customer_id = form.customer_id;
    // Set real_customer_display_name: use explicit field value, fallback to customerLabel
    const displayNameToSave = realCustomerDisplayName.trim() || customerLabel;
    if (displayNameToSave) {
      payload.real_customer_display_name = displayNameToSave;
    }
    if (form.main_pm_id) payload.main_pm_id = form.main_pm_id;
    if (form.main_designer_id) payload.main_designer_id = form.main_designer_id;
    if (form.other_pm_id) payload.other_pm_id = form.other_pm_id;
    if (form.more_pm_id) payload.more_pm_id = form.more_pm_id;
    payload.os_money_size = form.os_money_size;
    if (form.size) payload.size = form.size;
    if (form.actual_size) payload.actual_size = form.actual_size;
    if (form.site_address) payload.site_address = form.site_address;
    if (form.district_id) payload.district_id = form.district_id;
    if (form.r_building_id) payload.r_building_id = form.r_building_id;
    if (form.n_financial_year_id)
      payload.n_financial_year_id = form.n_financial_year_id;
    if (form.n_team_type_id) payload.n_team_type_id = form.n_team_type_id;
    if (form.n_service_type_id)
      payload.n_service_type_id = form.n_service_type_id;
    // Project types are synced via bwa_pitching_project_types after create/update.
    const selectedProjectTypeIds = form.n_project_types_id
      ? form.n_project_types_id.split(",").filter(Boolean)
      : [];
    // Quote-project-type drives the dynamic Site Status questionnaire; allow clearing.
    payload.quote_project_type_id = form.quote_project_type_id || null;
    if (form.enquiry_date) payload.enquiry_date = form.enquiry_date;
    if (form.asana_link) payload.asana_link = form.asana_link;
    if (form.working_folder) payload.working_folder = form.working_folder;

    // Set timestamps and created_by
    const now = new Date().toISOString();
    const currentUserId = profile?.id || null;

    if (!isEdit) {
      // On create: set created_by_id (references users.id) and created_date
      if (currentUserId) payload.created_by_id = currentUserId;
      payload.created_date = now;
    }
    // Always set modified_date on both create and edit
    payload.modified_date = now;

    try {
      let result: any;
      if (isEdit && editData) {
        result = await updateBWAPitching(editData.id, payload);
      } else {
        result = await createBWAPitching(payload);
      }

      if (!result.success) {
        setError(result.error || "儲存失敗");
      } else {
        // ─── Auto-create pitching_bv for main_pm and main_designer on create ───
        if (!isEdit && result.id) {
          const pitchingId = result.id;
          const pitchingStatus = form.pitching_stages || "Enquiry";
          const bvTimestamp = new Date().toISOString();

          const handlersToCreate: string[] = [];
          if (form.main_pm_id) handlersToCreate.push(form.main_pm_id);
          if (form.main_designer_id && form.main_designer_id !== form.main_pm_id) {
            handlersToCreate.push(form.main_designer_id);
          }

          // Create pitching_bv records in parallel — await before refresh
          try {
            await Promise.all(
              handlersToCreate.map((handlerId) =>
                createPitchingBV({
                  pitching_status: pitchingStatus,
                  created_date: bvTimestamp,
                  modified_date: bvTimestamp,
                  handler_id: handlerId,
                  pitching_id: pitchingId,
                })
              )
            );
          } catch (err) {
            console.error("[BWAPitchingDialog] Failed to create pitching_bv:", err);
          }
        }

        // ─── On Edit: Sync pitching_bv handlers when main_pm or main_designer changes ───
        if (isEdit && editData) {
          const oldPmId = editData.main_pm_id || "";
          const oldDesignerId = editData.main_designer_id || "";
          const newPmId = form.main_pm_id || "";
          const newDesignerId = form.main_designer_id || "";

          const pmChanged = newPmId !== oldPmId;
          const designerChanged = newDesignerId !== oldDesignerId;

          if (pmChanged || designerChanged) {
            // Await BV sync to complete before triggering refresh
            try {
              const bvTimestamp = new Date().toISOString();
              const existingBVs = await fetchPitchingBVByPitchingId(editData.id);
              const pitchingStatus = form.pitching_stages || editData.pitching_stages || "Enquiry";

              // ─── Handle Main PM change ───
              if (pmChanged) {
                const oldPmBV = oldPmId
                  ? existingBVs.find((bv: any) => bv.handler_id === oldPmId)
                  : null;

                if (oldPmBV && newPmId) {
                  // Update existing BV record to point to new PM
                  await updatePitchingBV(oldPmBV.id, {
                    handler_id: newPmId,
                    modified_date: bvTimestamp,
                  });
                } else if (oldPmBV && !newPmId) {
                  // PM was removed — delete the BV record
                  await deletePitchingBV(oldPmBV.id);
                } else if (!oldPmBV && newPmId) {
                  // No existing BV for old PM — check if new PM already has a BV
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newPmId);
                  if (!alreadyExists) {
                    await createPitchingBV({
                      pitching_status: pitchingStatus,
                      created_date: bvTimestamp,
                      modified_date: bvTimestamp,
                      handler_id: newPmId,
                      pitching_id: editData.id,
                    });
                  }
                }
              }

              // ─── Handle Main Designer change ───
              if (designerChanged) {
                const oldDesignerBV = oldDesignerId
                  ? existingBVs.find((bv: any) => bv.handler_id === oldDesignerId)
                  : null;

                if (oldDesignerBV && newDesignerId) {
                  // Check if the new designer already has a BV (e.g., same person as PM)
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newDesignerId);
                  if (!alreadyExists) {
                    // Update existing BV record to point to new designer
                    await updatePitchingBV(oldDesignerBV.id, {
                      handler_id: newDesignerId,
                      modified_date: bvTimestamp,
                    });
                  } else {
                    // New designer already has a record — delete the old one
                    await deletePitchingBV(oldDesignerBV.id);
                  }
                } else if (oldDesignerBV && !newDesignerId) {
                  // Designer was removed — delete the BV record
                  await deletePitchingBV(oldDesignerBV.id);
                } else if (!oldDesignerBV && newDesignerId) {
                  // No existing BV for old designer — create one for new designer if doesn't exist
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newDesignerId);
                  if (!alreadyExists) {
                    await createPitchingBV({
                      pitching_status: pitchingStatus,
                      created_date: bvTimestamp,
                      modified_date: bvTimestamp,
                      handler_id: newDesignerId,
                      pitching_id: editData.id,
                    });
                  }
                }
              }

              console.log("[BWAPitchingDialog] ✓ pitching_bv handlers synced after edit");
            } catch (err) {
              console.error("[BWAPitchingDialog] Failed to sync pitching_bv on edit:", err);
            }
          }
        }

        // ─── Sync junction table: bwa_pitching_project_types ───
        const pitchingIdForJunction = isEdit && editData ? editData.id : result.id;
        if (pitchingIdForJunction && selectedProjectTypeIds.length > 0) {
          try {
            // Delete existing junction rows for this pitching
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete-where",
                table: "bwa_pitching_project_types",
                filter: { pitching_id: pitchingIdForJunction },
              }),
            });
            // Insert new junction rows
            await Promise.all(
              selectedProjectTypeIds.map((ptId) =>
                fetch("/api/admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "create",
                    table: "bwa_pitching_project_types",
                    data: {
                      pitching_id: pitchingIdForJunction,
                      project_type_id: ptId,
                    },
                  }),
                })
              )
            );
          } catch (err) {
            console.error("[BWAPitchingDialog] Failed to sync project types junction:", err);
          }
        }

        handleSavedClose(onClose);
        onSaved();
      }
    } catch (err: any) {
      setError(err.message || "未知錯誤");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    markUserEdited();
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Quick Add Customer dialog state
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickAddBuildingOpen, setQuickAddBuildingOpen] = useState(false);

  const handleMainPmChange = async (pmId: string) => {
    updateField("main_pm_id", pmId);
    // Only auto-generate code in create mode and if pitching_code is empty or was auto-generated
    if (!isEdit && pmId) {
      setGeneratingCode(true);
      try {
        const code = await generatePitchingCode(pmId);
        if (code) {
          setForm((prev) => ({ ...prev, pitching_code: code }));
        }
      } catch (err) {
        console.error(
          "[BWAPitchingDialog] Failed to generate pitching code:",
          err,
        );
      } finally {
        setGeneratingCode(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-3xl !grid !grid-rows-[auto_1fr_auto] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            {isEdit
              ? "編輯提案 Edit Pitching"
              : prefill
                ? "從 Asana 匯入提案"
                : "新增提案 New Pitching"}
          </DialogTitle>
          <UnsavedDialogDraftHint visible={showUnsavedHint} />
          {prefill && !isEdit && prefill.mappingNotes.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-2.5 py-2 max-h-28 overflow-y-auto">
              <p className="font-medium text-gray-600 mb-1">已從 Asana 帶入：</p>
              <ul className="space-y-0.5">
                {prefill.mappingNotes.map((item) => (
                  <li key={`${item.field}-${item.source}`}>
                    <span className="text-gray-700">{item.field}</span>
                    <span className="text-gray-400"> ← {item.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogHeader>

        <div className="overflow-y-auto min-h-0">
        {loadingOptions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
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
                {/* Customer — Searchable (lazy loaded) */}
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
                    onLabelChange={(label) => {
                      setCustomerLabel(label);
                      // Auto-fill realCustomerDisplayName when customer changes (user can override)
                      if (label) setRealCustomerDisplayName(label);
                    }}
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
                      setRealCustomerDisplayName(label);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ═══ Section: 提案詳細 Pitching Details ═══ */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                提案詳細 Pitching Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Display Name (full width) */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    顯示名稱 Display Name
                  </Label>
                  <Input
                    placeholder="客戶顯示名稱（可自行修改）"
                    value={realCustomerDisplayName}
                    onChange={(e) => {
                      markUserEdited();
                      setRealCustomerDisplayName(e.target.value);
                    }}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-gray-400">
                    系統會使用此名稱作為主要顯示，選擇客戶時會自動填入，可手動覆蓋
                  </p>
                </div>

                {/* Pitching Code */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    提案編號 Pitching Code
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={
                        generatingCode
                          ? "生成中..."
                          : "選擇主要項目經理後自動生成"
                      }
                      value={form.pitching_code}
                      onChange={(e) =>
                        updateField("pitching_code", e.target.value)
                      }
                      disabled={generatingCode}
                    />
                    {generatingCode && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  {!isEdit && !form.pitching_code && !generatingCode && (
                    <p className="text-xs text-gray-400">
                      選擇主要項目經理後自動生成編號
                    </p>
                  )}
                </div>

                {/* 項目規模 → os_money_size (required) */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    項目規模 Project Size
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.os_money_size || undefined}
                    onValueChange={(v) => updateField("os_money_size", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇項目規模" />
                    </SelectTrigger>
                    <SelectContent>
                      {BWA_PROJECT_SIZE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Enquiry Date */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    查詢日期 Enquiry Date<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.enquiry_date}
                    onChange={(e) =>
                      updateField("enquiry_date", e.target.value)
                    }
                  />
                </div>

                {/* Financial Year */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    財政年度 Financial Year
                    <span className="text-red-500">*</span>
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

                {/* Description (full width) */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    提案描述 Description<span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="提案描述..."
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                  />
                </div>

                {/* Service Type — Full-width radio selection, 3 columns with search */}
                <div className="col-span-2">
                  <BilingualTypeGridPicker
                    label={
                      <Label className="text-sm font-medium">
                        服務類型 Service Type<span className="text-red-500">*</span>
                      </Label>
                    }
                    options={serviceTypeOptions}
                    searchPlaceholder="搜尋服務類型 / Search service type..."
                    mode="single"
                    value={form.n_service_type_id}
                    onChange={(v) => updateField("n_service_type_id", v)}
                    accent="blue"
                    resetKey={open}
                  />
                </div>

                {/* Project Type — Full-width multi-select, 3 columns with search */}
                <div className="col-span-2">
                  <BilingualTypeGridPicker
                    label={
                      <Label className="text-sm font-medium">
                        項目類型 Project Type<span className="text-red-500">*</span>
                        <span className="text-xs text-gray-400 ml-1.5 font-normal">
                          (可多選)
                        </span>
                      </Label>
                    }
                    options={projectTypeOptions}
                    searchPlaceholder="搜尋項目類型 / Search project type..."
                    mode="multi"
                    value={form.n_project_types_id}
                    onChange={(v) => updateField("n_project_types_id", v)}
                    accent="amber"
                    resetKey={open}
                  />
                </div>

                {/* Quote Project Type — drives the dynamic Site Status questionnaire */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    工地狀況問卷類型 Site Status Type
                  </Label>
                  <Select
                    value={form.quote_project_type_id || "__none__"}
                    onValueChange={(v) =>
                      updateField(
                        "quote_project_type_id",
                        v === "__none__" ? "" : v,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇報價項目類型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        — 不指定（只顯示通用問題）—
                      </SelectItem>
                      {quoteProjectTypeOptions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ═══ Section: 負責人 Staff Assignment ═══ */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1.5">
                負責人 Staff Assignment
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Team Type (full width) */}
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

                {/* Main PM */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    主要項目經理 Main PM<span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.main_pm_id}
                    onValueChange={handleMainPmChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Main PM" />
                    </SelectTrigger>
                    <SelectContent>
                      {pmStaffOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          <span className={opt.status === "Inactive" ? "line-through text-muted-foreground" : ""}>
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Main Designer */}
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
                          <span className={opt.status === "Inactive" ? "line-through text-muted-foreground" : ""}>
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
                {/* GFA Size (optional) */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    建築面積 GFA Size (sq. ft.)
                  </Label>
                  <Input
                    type="number"
                    placeholder="Gross Floor Area (sq. ft.)"
                    value={form.size}
                    onChange={(e) => updateField("size", e.target.value)}
                  />
                </div>

                {/* SA Size (required) */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    實用面積 SA Size (sq. ft.)
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Saleable Area (sq. ft.)"
                    value={form.actual_size}
                    onChange={(e) => updateField("actual_size", e.target.value)}
                  />
                </div>

                {/* District — Searchable */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">地區 District</Label>
                  <SearchableSelect
                    value={form.district_id}
                    onChange={(id) => updateField("district_id", id)}
                    placeholder="搜尋地區..."
                    searchFn={searchDistrictOptions}
                    initialLabel={districtLabel}
                    onLabelChange={setDistrictLabel}
                  />
                </div>

                {/* Building — Searchable (lazy loaded) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      搜尋並選擇大廈 Building
                    </Label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                      onClick={() => setQuickAddBuildingOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      快速新增
                    </button>
                  </div>
                  <SearchableSelect
                    value={form.r_building_id}
                    onChange={(id) => updateField("r_building_id", id)}
                    placeholder="搜尋大廈..."
                    searchFn={searchBuildingOptions}
                    initialLabel={buildingLabel}
                  />
                  <BuildingEditDialog
                    open={quickAddBuildingOpen}
                    onOpenChange={setQuickAddBuildingOpen}
                    building={null}
                    onSaved={(created) => {
                      if (created) {
                        updateField("r_building_id", created.id);
                        setBuildingLabel(created.label);
                      }
                    }}
                  />
                </div>

                {/* empty spacer */}
                <div />

                {/* Site Address (full width) */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    工程地址 Site Address
                  </Label>
                  <Textarea
                    placeholder="輸入完整工地地址"
                    rows={2}
                    value={form.site_address}
                    onChange={(e) =>
                      updateField("site_address", e.target.value)
                    }
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
                {/* Asana Link */}
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

                {/* Working Folder */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    工作資料夾 Working Folder
                  </Label>
                  <Input
                    placeholder="Working Folder"
                    value={form.working_folder}
                    onChange={(e) =>
                      updateField("working_folder", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div ref={errorRef} className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-line">
            {error}
          </div>
        )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="w-4 h-4 mr-1" /> 取消
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving || loadingOptions}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            {isEdit ? "更新" : "建立"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
