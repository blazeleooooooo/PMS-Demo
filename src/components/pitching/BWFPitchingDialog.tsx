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
  createBWFPitching,
  updateBWFPitching,
  createPitchingBV,
  fetchPitchingBVByPitchingId,
  updatePitchingBV,
  deletePitchingBV,
  generateBWFPitchingCode,
  fetchStaffOptions,
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
  fetchBWFPitchingServiceTypeIds,
  fetchBWFPitchingServiceItemIds,
  fetchBWFPitchingMajorQuoteIds,
  searchCustomerOptions,
  fetchCustomerDisplayName,
  searchBuildingOptions,
  fetchCurrentFinancialYear,
  fetchStaffDefaults,
  type BWAPitchingRow,
  type LinkOption,
  type BWFServiceTypeOption,
  type ServiceItemOption,
} from "@/lib/data-service";
import { useAuth } from "@/hooks/use-auth";
import {
  UnsavedDialogDraftHint,
  useSoftDialogSession,
} from "@/hooks/use-soft-dialog-draft";
import CustomerEditDialog from "@/components/clients/CustomerEditDialog";

interface BWFPitchingDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: BWAPitchingRow | null;
}

// NOTE: Field names here mirror the BWA dialog so the layout is identical.
// They are mapped to the actual bwf_pitchings columns in handleSave().
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
  size: "",
  os_size: "",
  site_address: "",
  district_id: "",
  r_building_id: "",
  n_financial_year_id: "",
  n_team_type_id: "",
  n_service_type_id: "",
  n_source_id: "",
  n_customer_type_id: "",
  n_major_quotes_id: "",
  n_service_items_id: "",
  n_project_types_id: "",
  quote_project_type_id: "",
  enquiry_date: "",
  asana_link: "",
  working_folder: "",
};

type BwfPitchingForm = typeof EMPTY_FORM;

type BwfPitchingDraft = {
  form: BwfPitchingForm;
  customerLabel: string;
  realCustomerDisplayName: string;
  buildingLabel: string;
  districtLabel: string;
};

// 工程規模 options for the os_size pill selector.
const OS_SIZE_OPTIONS = [
  "Small (<$50K)",
  "Middle (<$50-150K)",
  "Big (>$150K)",
];

// When source display matches this value the pitching code uses "PP" as group-2 prefix.
const BWF_SOURCE_PP_DISPLAY = "BWA-PP";

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
  value: string; // comma-joined ids
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

// ─── PILL SELECTOR (single-select, rectangle pills, no search) ───
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

// ─── MAIN DIALOG COMPONENT ───────────────────────────────────
export default function BWFPitchingDialog({
  open,
  onClose,
  onSaved,
  editData,
}: BWFPitchingDialogProps) {
  const isEdit = !!editData;
  const { profile, user, staff, isLoading: authLoading } = useAuth();
  // Pitching Code is auto-computed and locked; only Super Admin may edit it.
  const isSuperAdmin = (staff as any)?.role === "Super Admin";
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editId = editData?.id ?? null;
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
  } = useSoftDialogSession<BwfPitchingDraft>("bwf-pitching", editId);
  const skipCodeGenRef = useRef(false);

  // Lookup options
  const [staffOptions, setStaffOptions] = useState<LinkOption[]>([]);
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
  const [loadingOptions, setLoadingOptions] = useState(true);

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

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [staff, pmStaff, designerStaff, districts, fys, teamTypes, serviceTypes, sources, customerTypes, majorQuotes, serviceItems] =
        await Promise.all([
          fetchStaffOptions(),
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
        ]);
      setStaffOptions(staff);
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
    } catch (err) {
      console.error("[BWFPitchingDialog] loadOptions error:", err);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const staffDefaultsAppliedRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const applyDraft = (draft: BwfPitchingDraft) => {
    setForm(draft.form);
    setCustomerLabel(draft.customerLabel);
    setRealCustomerDisplayName(draft.realCustomerDisplayName);
    setBuildingLabel(draft.buildingLabel);
    setDistrictLabel(draft.districtLabel);
  };

  const currentDraft = (): BwfPitchingDraft => ({
    form,
    customerLabel,
    realCustomerDisplayName,
    buildingLabel,
    districtLabel,
  });

  useEffect(() => {
    let cancelled = false;

    if (!open) {
      return () => { cancelled = true; };
    }

    loadOptions();
    setError(null);

    if (applyRestoredDraft(applyDraft)) {
      staffDefaultsAppliedRef.current = true;
      skipCodeGenRef.current = true;
      return () => { cancelled = true; };
    }

    beginFreshHydrate();

    if (editData) {
      setForm({
        pitching_code: editData.pitching_code || "",
        // BWF stores the description text in quote_content.
        description: (editData as any).quote_content || editData.description || "",
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
        size: editData.size || "",
        os_size: (editData as any).os_size || "",
        site_address: editData.site_address || "",
        district_id: editData.district_id || "",
        r_building_id: editData.r_building_id || "",
        n_financial_year_id: editData.n_financial_year_id || "",
        n_team_type_id: editData.n_team_type_id || "",
        n_service_type_id: editData.n_service_type_id || "",
        n_source_id: (editData as any).n_source_id || "",
        n_customer_type_id: (editData as any).n_customer_type_id || "",
        n_major_quotes_id: (editData as any).n_major_quotes_id || "",
        n_service_items_id: (editData as any).n_service_items_id || "",
        n_project_types_id: "",
        quote_project_type_id: "",
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
          const [stIds, siIds, mqIds] = await Promise.all([
            fetchBWFPitchingServiceTypeIds(editData.id),
            fetchBWFPitchingServiceItemIds(editData.id),
            fetchBWFPitchingMajorQuoteIds(editData.id),
          ]);
          if (cancelled) return;
          setForm((prev) => ({
            ...prev,
            ...(stIds.length > 0 ? { n_service_type_id: stIds.join(",") } : {}),
            ...(siIds.length > 0 ? { n_service_items_id: siIds.join(",") } : {}),
            ...(mqIds.length > 0 ? { n_major_quotes_id: mqIds.join(",") } : {}),
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
      setForm({
        ...EMPTY_FORM,
        pitching_stages: "Enquiry",
        enquiry_date: enquiryDateDefault,
      });
      setCustomerLabel("");
      setRealCustomerDisplayName("");
      setBuildingLabel("");
      setDistrictLabel("");
      staffDefaultsAppliedRef.current = false;

      const applyFYDefault = async () => {
        const currentFY = await fetchCurrentFinancialYear();
        if (cancelled) return;
        if (currentFY) {
          setForm((prev) => ({ ...prev, n_financial_year_id: currentFY.id }));
        }
      };
      applyFYDefault();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, loadOptions, applyRestoredDraft, beginFreshHydrate, finishHydrate]);

  // Apply staff defaults once profile/user is available (create mode)
  useEffect(() => {
    if (!open || isEdit) return;
    if (staffDefaultsAppliedRef.current) return;
    if (authLoading) return;

    const memberId = profile?.member_id;
    const memberBubbleId = profile?.member;
    const userEmail = user?.email || profile?.email;

    if (!memberId && !memberBubbleId && !userEmail) {
      staffDefaultsAppliedRef.current = true;
      finishHydrate();
      return;
    }

    staffDefaultsAppliedRef.current = true;
    let cancelled = false;

    const applyStaffDefaults = async () => {
      const staffDefaults = await fetchStaffDefaults(memberId, memberBubbleId, userEmail);
      if (cancelled) return;

      if (staffDefaults) {
        setForm((prev) => ({
          ...prev,
          main_pm_id: staffDefaults.staffId,
          ...(staffDefaults.teamTypeId ? { n_team_type_id: staffDefaults.teamTypeId } : {}),
        }));
      }
      if (!cancelled) finishHydrate();
    };

    applyStaffDefaults();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, authLoading, profile, user]);

  const handleSave = async () => {
    // ─── Required field validation (same fields as BWA) ───
    const missingFields: string[] = [];
    if (!form.pitching_code.trim()) missingFields.push("提案編號 Pitching Code");
    if (!form.n_financial_year_id) missingFields.push("財政年度 Financial Year");
    if (!form.enquiry_date) missingFields.push("查詢日期 Enquiry Date");
    if (!form.description.trim()) missingFields.push("提案描述 Description");
    if (!form.customer_id) missingFields.push("客戶 Customer");
    if (!form.n_service_type_id) missingFields.push("服務類型 Service Type");
    if (!form.main_pm_id) missingFields.push("主要項目經理 Main PM");

    if (missingFields.length > 0) {
      setError(`以下必填欄位尚未填寫，請補充：\n• ${missingFields.join("\n• ")}`);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      return;
    }

    setSaving(true);
    setError(null);

    // Map the (BWA-named) form fields → bwf_pitchings columns.
    const payload: any = {};
    if (form.pitching_code) payload.pitching_code = form.pitching_code;
    if (form.description) payload.quote_content = form.description;
    if (!isEdit && form.pitching_stages) payload.pitching_stages = form.pitching_stages;
    if (form.customer_id) payload.customer_id = form.customer_id;
    const displayNameToSave = realCustomerDisplayName.trim() || customerLabel;
    if (displayNameToSave) payload.real_customer_display_name = displayNameToSave;
    if (form.main_pm_id) payload.main_pm_id = form.main_pm_id;
    if (form.main_designer_id) payload.main_designer_id = form.main_designer_id;
    if (form.other_pm_id) payload.other_pms_id = form.other_pm_id;
    if (form.more_pm_id) payload.more_pms_id = form.more_pm_id;
    if (form.size) payload.size = form.size;
    if (form.os_size) payload.os_size = form.os_size;
    if (form.site_address) payload.site_address = form.site_address;
    if (form.district_id) payload.r_district_id = form.district_id;
    if (form.r_building_id) payload.r_building_id = form.r_building_id;
    if (form.n_financial_year_id) payload.n_financial_year_id = form.n_financial_year_id;
    if (form.n_team_type_id) payload.n_team_type_id = form.n_team_type_id;
    // Service type is multi-select; store the first id on the main table and
    // the full list in the bwf_pitching_bwf_service_types junction below.
    const selectedServiceTypeIds = form.n_service_type_id
      ? form.n_service_type_id.split(",").filter(Boolean)
      : [];
    if (selectedServiceTypeIds.length > 0) payload.n_bwf_service_types_id = selectedServiceTypeIds[0];
    if (form.n_source_id) payload.n_source_id = form.n_source_id;
    if (form.n_customer_type_id) payload.n_customer_type_id = form.n_customer_type_id;
    // Major quotes is multi-select; store the first id on the main table and
    // the full list in the bwf_pitching_major_quotes junction below.
    const selectedMajorQuoteIds = form.n_major_quotes_id
      ? form.n_major_quotes_id.split(",").filter(Boolean)
      : [];
    if (selectedMajorQuoteIds.length > 0) payload.n_major_quotes_id = selectedMajorQuoteIds[0];
    // Service items is multi-select; store the first id on the main table and
    // the full list in the bwf_pitching_service_items junction below.
    const selectedServiceItemIds = form.n_service_items_id
      ? form.n_service_items_id.split(",").filter(Boolean)
      : [];
    if (selectedServiceItemIds.length > 0) payload.n_service_items_id = selectedServiceItemIds[0];
    if (form.enquiry_date) payload.enquiry_date = form.enquiry_date;
    if (form.asana_link) payload.asana_link = form.asana_link;
    if (form.working_folder) payload.working_folder = form.working_folder;

    const now = new Date().toISOString();
    const currentUserId = profile?.id || null;
    if (!isEdit) {
      if (currentUserId) payload.created_by_id = currentUserId;
      payload.created_date = now;
    }
    payload.modified_date = now;

    try {
      let result: any;
      if (isEdit && editData) {
        result = await updateBWFPitching(editData.id, payload);
      } else {
        result = await createBWFPitching(payload);
      }

      if (!result.success) {
        setError(result.error || "儲存失敗");
      } else {
        // Auto-create pitching_bv for main_pm and main_designer on create
        if (!isEdit && result.id) {
          const pitchingId = result.id;
          const pitchingStatus = form.pitching_stages || "Enquiry";
          const bvTimestamp = new Date().toISOString();

          const handlersToCreate: string[] = [];
          if (form.main_pm_id) handlersToCreate.push(form.main_pm_id);
          if (form.main_designer_id && form.main_designer_id !== form.main_pm_id) {
            handlersToCreate.push(form.main_designer_id);
          }

          try {
            await Promise.all(
              handlersToCreate.map((handlerId) =>
                createPitchingBV({
                  pitching_status: pitchingStatus,
                  created_date: bvTimestamp,
                  modified_date: bvTimestamp,
                  handler_id: handlerId,
                  bwf_pitching_id: pitchingId,
                } as any)
              )
            );
          } catch (err) {
            console.error("[BWFPitchingDialog] Failed to create pitching_bv:", err);
          }
        }

        // On edit: sync pitching_bv handlers when main_pm/main_designer changes
        if (isEdit && editData) {
          const oldPmId = editData.main_pm_id || "";
          const oldDesignerId = editData.main_designer_id || "";
          const newPmId = form.main_pm_id || "";
          const newDesignerId = form.main_designer_id || "";
          const pmChanged = newPmId !== oldPmId;
          const designerChanged = newDesignerId !== oldDesignerId;

          if (pmChanged || designerChanged) {
            try {
              const bvTimestamp = new Date().toISOString();
              const existingBVs = await fetchPitchingBVByPitchingId(editData.id);
              const pitchingStatus = form.pitching_stages || editData.pitching_stages || "Enquiry";

              if (pmChanged) {
                const oldPmBV = oldPmId ? existingBVs.find((bv: any) => bv.handler_id === oldPmId) : null;
                if (oldPmBV && newPmId) {
                  await updatePitchingBV(oldPmBV.id, { handler_id: newPmId, modified_date: bvTimestamp });
                } else if (oldPmBV && !newPmId) {
                  await deletePitchingBV(oldPmBV.id);
                } else if (!oldPmBV && newPmId) {
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newPmId);
                  if (!alreadyExists) {
                    await createPitchingBV({
                      pitching_status: pitchingStatus,
                      created_date: bvTimestamp,
                      modified_date: bvTimestamp,
                      handler_id: newPmId,
                      bwf_pitching_id: editData.id,
                    } as any);
                  }
                }
              }

              if (designerChanged) {
                const oldDesignerBV = oldDesignerId ? existingBVs.find((bv: any) => bv.handler_id === oldDesignerId) : null;
                if (oldDesignerBV && newDesignerId) {
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newDesignerId);
                  if (!alreadyExists) {
                    await updatePitchingBV(oldDesignerBV.id, { handler_id: newDesignerId, modified_date: bvTimestamp });
                  } else {
                    await deletePitchingBV(oldDesignerBV.id);
                  }
                } else if (oldDesignerBV && !newDesignerId) {
                  await deletePitchingBV(oldDesignerBV.id);
                } else if (!oldDesignerBV && newDesignerId) {
                  const alreadyExists = existingBVs.some((bv: any) => bv.handler_id === newDesignerId);
                  if (!alreadyExists) {
                    await createPitchingBV({
                      pitching_status: pitchingStatus,
                      created_date: bvTimestamp,
                      modified_date: bvTimestamp,
                      handler_id: newDesignerId,
                      bwf_pitching_id: editData.id,
                    } as any);
                  }
                }
              }
            } catch (err) {
              console.error("[BWFPitchingDialog] Failed to sync pitching_bv on edit:", err);
            }
          }
        }

        // ─── Sync junction table: bwf_pitching_bwf_service_types ───
        const pitchingIdForJunction = isEdit && editData ? editData.id : result.id;
        if (pitchingIdForJunction) {
          try {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete-where",
                table: "bwf_pitching_bwf_service_types",
                filter: { pitching_id: pitchingIdForJunction },
              }),
            });
            await Promise.all(
              selectedServiceTypeIds.map((stId) =>
                fetch("/api/admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "create",
                    table: "bwf_pitching_bwf_service_types",
                    data: { pitching_id: pitchingIdForJunction, service_type_id: stId },
                  }),
                })
              )
            );
          } catch (err) {
            console.error("[BWFPitchingDialog] Failed to sync service types junction:", err);
          }

          // ─── Sync junction table: bwf_pitching_service_items ───
          try {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete-where",
                table: "bwf_pitching_service_items",
                filter: { pitching_id: pitchingIdForJunction },
              }),
            });
            await Promise.all(
              selectedServiceItemIds.map((siId) =>
                fetch("/api/admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "create",
                    table: "bwf_pitching_service_items",
                    data: { pitching_id: pitchingIdForJunction, service_item_id: siId },
                  }),
                })
              )
            );
          } catch (err) {
            console.error("[BWFPitchingDialog] Failed to sync service items junction:", err);
          }

          // ─── Sync junction table: bwf_pitching_major_quotes ───
          try {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete-where",
                table: "bwf_pitching_major_quotes",
                filter: { pitching_id: pitchingIdForJunction },
              }),
            });
            await Promise.all(
              selectedMajorQuoteIds.map((mqId) =>
                fetch("/api/admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "create",
                    table: "bwf_pitching_major_quotes",
                    data: { pitching_id: pitchingIdForJunction, major_quote_id: mqId },
                  }),
                })
              )
            );
          } catch (err) {
            console.error("[BWFPitchingDialog] Failed to sync major quotes junction:", err);
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

  const handleDismiss = () => dismissDraft(currentDraft(), onClose);
  const handleCancel = () => cancelDraft(onClose);

  const [generatingCode, setGeneratingCode] = useState(false);
  const [customerEditOpen, setCustomerEditOpen] = useState(false);

  const handleMainPmChange = (pmId: string) => {
    updateField("main_pm_id", pmId);
  };

  // ─── Auto-compute Pitching Code (create mode only) ───────────
  // The code is derived from Service Type, Source, Customer Type and Financial
  // Year. Re-run whenever any of those change while creating. In edit mode the
  // stored code is preserved (and only Super Admin can change it manually).
  const firstServiceTypeId = form.n_service_type_id
    ? form.n_service_type_id.split(",").filter(Boolean)[0] || ""
    : "";

  useEffect(() => {
    if (isEdit || !open) return;
    if (skipCodeGenRef.current) {
      skipCodeGenRef.current = false;
      return;
    }
    let cancelled = false;

    if (!firstServiceTypeId || !form.n_financial_year_id) {
      setForm((prev) => (prev.pitching_code ? { ...prev, pitching_code: "" } : prev));
      return;
    }

    setGeneratingCode(true);
    (async () => {
      try {
        const code = await generateBWFPitchingCode({
          serviceTypeId: firstServiceTypeId,
          sourceId: form.n_source_id || null,
          customerTypeId: form.n_customer_type_id || null,
          financialYearId: form.n_financial_year_id || null,
        });
        if (cancelled) return;
        setForm((prev) => ({ ...prev, pitching_code: code }));
      } catch (err) {
        console.error("[BWFPitchingDialog] Failed to generate pitching code:", err);
      } finally {
        if (!cancelled) setGeneratingCode(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEdit,
    open,
    firstServiceTypeId,
    form.n_source_id,
    form.n_customer_type_id,
    form.n_financial_year_id,
  ]);

  // ─── Dynamic service-item groups ──────────────────────────
  // Each group shows only when a selected service type matches its rule:
  //  Fast Build → any selected type with is_fast_build
  //  Furniture/Material/Branding → a selected type whose display contains it
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

  const missingPitchingCodeFields = (() => {
    if (isEdit) return [] as string[];
    const missing: string[] = [];
    if (!firstServiceTypeId) missing.push("服務類型 Service Type");
    if (!form.n_financial_year_id) missing.push("財政年度 Financial Year");

    const selectedSource = sourceOptions.find((o) => o.id === form.n_source_id);
    const isPPSource =
      (selectedSource?.label || "").trim().toUpperCase() ===
      BWF_SOURCE_PP_DISPLAY.toUpperCase();

    if (isPPSource || form.n_customer_type_id) {
      // BWA-PP source or customer type supplies group-2 prefix
    } else if (form.n_source_id) {
      missing.push("客戶類型 Customer Type");
    } else {
      missing.push("來源 Source（BWA-PP）或 客戶類型 Customer Type");
    }
    return missing;
  })();

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-3xl !grid !grid-rows-[auto_1fr_auto] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500 flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            {isEdit ? "編輯傢俬提案 Edit BWF Pitching" : "新增傢俬提案 New BWF Pitching"}
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
                      onClick={() => setCustomerEditOpen(true)}
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
                      if (label) setRealCustomerDisplayName(label);
                    }}
                    placeholder="搜尋客戶..."
                    searchFn={searchCustomerOptions}
                    initialLabel={customerLabel}
                  />
                  <CustomerEditDialog
                    open={customerEditOpen}
                    onOpenChange={setCustomerEditOpen}
                    customer={null}
                    onSaved={(created) => {
                      if (created) {
                        updateField("customer_id", created.id);
                        setCustomerLabel(created.label);
                        setRealCustomerDisplayName(created.label);
                      }
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

                {/* Financial Year (left) + Enquiry Date (right) */}
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

                {/* 來源 Source → n_source_id */}
                <PillGroup
                  label="來源 Source"
                  options={sourceOptions}
                  value={form.n_source_id}
                  onChange={(id) => updateField("n_source_id", id)}
                />

                {/* 客戶類型 Customer Type → n_customer_type_id */}
                <PillGroup
                  label="客戶類型 Customer Type"
                  options={customerTypeOptions}
                  value={form.n_customer_type_id}
                  onChange={(id) => updateField("n_customer_type_id", id)}
                />

                {/* 工程規模 Project Size → os_size */}
                <PillGroup
                  label="工程規模 Project Size"
                  options={OS_SIZE_OPTIONS.map((o) => ({ id: o, label: o }))}
                  value={form.os_size}
                  onChange={(id) => updateField("os_size", id)}
                />

                {/* 主要報價 Major Quote → n_major_quotes_id (multi) */}
                <MultiPillGroup
                  label="主要報價 Major Quote"
                  options={majorQuoteOptions}
                  value={form.n_major_quotes_id}
                  onChange={(v) => updateField("n_major_quotes_id", v)}
                />

                {/* 服務類型 Service Type → n_bwf_service_types_id (multi) */}
                <MultiPillGroup
                  label="服務類型 Service Type"
                  required
                  options={serviceTypeOptions}
                  value={form.n_service_type_id}
                  onChange={(v) => updateField("n_service_type_id", v)}
                />

                {/* 服務項目 Service Items → n_service_items_id.
                    Groups show/hide dynamically based on selected service types. */}
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

                {/* Pitching Code — after all pill selections */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">
                    提案編號 Pitching Code
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={
                        generatingCode ? "生成中..." : "完成上方選項後自動生成"
                      }
                      value={form.pitching_code}
                      onChange={(e) => updateField("pitching_code", e.target.value)}
                      disabled={generatingCode || !isSuperAdmin}
                    />
                    {generatingCode && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-fuchsia-500" />
                    )}
                  </div>
                  {!isEdit && !form.pitching_code && !generatingCode && missingPitchingCodeFields.length > 0 && (
                    <p className="text-xs text-fuchsia-600/90">
                      請先選擇{" "}
                      {missingPitchingCodeFields.map((field, i) => (
                        <span key={field}>
                          {i > 0 && (i === missingPitchingCodeFields.length - 1 ? " 及 " : "、")}
                          <span className="font-medium">{field}</span>
                        </span>
                      ))}
                      ，完成後提案編號會自動生成。
                    </p>
                  )}
                  {!isEdit && !form.pitching_code && !generatingCode && missingPitchingCodeFields.length === 0 && (
                    <p className="text-xs text-gray-400">
                      正在準備生成提案編號…
                    </p>
                  )}
                  {isSuperAdmin && (
                    <p className="text-xs text-amber-500">
                      超級管理員可手動修改編號
                    </p>
                  )}
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
                  <Select value={form.main_pm_id} onValueChange={handleMainPmChange}>
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
                  <SearchableSelect
                    value={form.district_id}
                    onChange={(id) => updateField("district_id", id)}
                    placeholder="搜尋地區..."
                    searchFn={searchDistrictOptions}
                    initialLabel={districtLabel}
                    onLabelChange={setDistrictLabel}
                  />
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
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
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
