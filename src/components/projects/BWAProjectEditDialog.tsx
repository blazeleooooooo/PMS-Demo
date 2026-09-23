"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Save,
  X,
  Search,
  Calendar as CalendarIcon,
  ChevronDown,
  Upload,
  ImageIcon,
  Plus,
} from "lucide-react";
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
  BWA_PROJECT_SIZE_OPTIONS,
  getBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  updateBWAProject,
  syncBWAProjectProjectTypes,
  fetchStaffOptions,
  fetchPMStaffOptions,
  fetchDesignerStaffOptions,
  fetchDistrictOptions,
  fetchFinancialYearOptions,
  fetchTeamTypeOptions,
  fetchServiceTypeOptions,
  fetchProjectTypeOptions,
  fetchProjectProjectTypeIds,
  fetchCostCentres,
  fetchBuildingOptions,
  searchCustomerOptions,
  searchBuildingOptions,
  fetchCustomerWellKnownBrandState,
  saveCustomerTags,
  updateBrandFields,
  uploadCustomerLogo,
  WELL_KNOWN_BRANDS_TAG_ID,
  WELL_KNOWN_BRANDS_COLLECTION_ID,
  type BWAProjectDetailData,
  type BWAProjectUpdateData,
  type LinkOption,
  type CostCentreData,
} from "@/lib/data-service";
import { fetchQuoteProjectTypes, fetchEntityQuoteProjectTypeId } from "@/lib/site-status-service";
import { cn } from "@/lib/utils";
import {
  UnsavedDialogDraftHint,
  useSoftDialogSession,
} from "@/hooks/use-soft-dialog-draft";
import BuildingEditDialog from "@/components/buildings/BuildingEditDialog";
import { BilingualTypeGridPicker } from "@/components/BilingualTypeGridPicker";

// ─── SEARCHABLE SELECT COMPONENT ─────────────────────────────
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
    if (isOpen && options.length === 0) {
      loadOptions("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialLabel) setSelectedLabel(initialLabel);
  }, [initialLabel]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const loadOptions = async (term: string) => {
    setLoading(true);
    try {
      const results = await searchFn(term);
      setOptions(results);
    } catch {
      setOptions([]);
    }
    setLoading(false);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadOptions(term), 300);
  };

  const handleSelect = (opt: LinkOption) => {
    onChange(opt.id);
    setSelectedLabel(opt.label);
    onLabelChange?.(opt.label);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onChange("");
    setSelectedLabel("");
    onLabelChange?.("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-left",
          "hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
          !selectedLabel && "text-gray-400"
        )}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜尋..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                ✕ 清除選擇
              </button>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">無結果</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-blue-50",
                    opt.id === value && "bg-blue-50 text-blue-600 font-medium"
                  )}
                >
                  <span className="block truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-xs text-gray-400 truncate">{opt.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
interface BWAProjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  data: BWAProjectDetailData;
  /** Scroll to a section when opened (e.g. from Expense Control fix button). */
  scrollToSection?: "key-dates" | null;
}

interface EditFormState {
  project_name: string;
  project_code: string;
  description: string;
  customer_id: string;
  main_pm_id: string;
  main_designer_id: string;
  other_pm_id: string;
  more_pm_id: string;
  estimated_income: string;
  estimated_expense: string;
  size: string;
  actual_size: string;
  project_size: string;
  height_to_tc: string;
  height_to_bs: string;
  height_to_fc: string;
  site_address: string;
  r_nos_district_id: string;
  r_building_id: string;
  n_financial_year_id: string;
  n_team_type_id: string;
  n_service_type_id: string;
  n_project_types_id: string;
  quote_project_type_id: string;
  cost_centre_id: string;
  enquiry_date: string;
  signed_date: string;
  start_date: string;
  handover_date: string;
  defect_done_date: string;
  asana_link: string;
  working_folder: string;
  main_contractor_id: string;
}

type BwaProjectDraft = {
  form: EditFormState;
  buildingLabel: string;
  customerLabel: string;
  contractorLabel: string;
  isWellKnownBrand: boolean;
  brandNameCn: string;
  brandNameEn: string;
  brandingIconPreview: string | null;
  wellKnownTagRowId: string | null;
  brandingIconFile: File | null;
  brandingIconFileKey: string;
};

function fileKey(file: File | null): string {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : "";
}

export default function BWAProjectEditDialog({
  open,
  onClose,
  onSaved,
  data,
  scrollToSection = null,
}: BWAProjectEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyDatesRef = useRef<HTMLElement>(null);
  const skipBrandReloadRef = useRef(false);
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
  } = useSoftDialogSession<BwaProjectDraft>("bwa-project", data.id);

  // Lookup options
  const [staffOptions, setStaffOptions] = useState<LinkOption[]>([]);
  const [pmStaffOptions, setPmStaffOptions] = useState<LinkOption[]>([]);
  const [designerStaffOptions, setDesignerStaffOptions] = useState<LinkOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LinkOption[]>([]);
  const [financialYearOptions, setFinancialYearOptions] = useState<LinkOption[]>([]);
  const [teamTypeOptions, setTeamTypeOptions] = useState<LinkOption[]>([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState<LinkOption[]>([]);
  const [projectTypeOptions, setProjectTypeOptions] = useState<LinkOption[]>([]);
  const [quoteProjectTypeOptions, setQuoteProjectTypeOptions] = useState<{ id: string; name: string }[]>([]);
  const [costCentreOptions, setCostCentreOptions] = useState<CostCentreData[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const [buildingLabel, setBuildingLabel] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [contractorLabel, setContractorLabel] = useState("");
  const [quickAddBuildingOpen, setQuickAddBuildingOpen] = useState(false);

  // Well-known brand (customer) state
  const [isWellKnownBrand, setIsWellKnownBrand] = useState(false);
  const [brandNameCn, setBrandNameCn] = useState("");
  const [brandNameEn, setBrandNameEn] = useState("");
  const [brandingIconPreview, setBrandingIconPreview] = useState<string | null>(null);
  const [brandingIconFile, setBrandingIconFile] = useState<File | null>(null);
  const [wellKnownTagRowId, setWellKnownTagRowId] = useState<string | null>(null);
  const [loadingBrandState, setLoadingBrandState] = useState(false);

  // Form state
  const [form, setForm] = useState<EditFormState>({
    project_name: "",
    project_code: "",
    description: "",
    customer_id: "",
    main_pm_id: "",
    main_designer_id: "",
    other_pm_id: "",
    more_pm_id: "",
    estimated_income: "",
    estimated_expense: "",
    size: "",
    actual_size: "",
    project_size: "",
    height_to_tc: "",
    height_to_bs: "",
    height_to_fc: "",
    site_address: "",
    r_nos_district_id: "",
    r_building_id: "",
    n_financial_year_id: "",
    n_team_type_id: "",
    n_service_type_id: "",
    n_project_types_id: "",
    quote_project_type_id: "",
    cost_centre_id: "",
    enquiry_date: "",
    signed_date: "",
    start_date: "",
    handover_date: "",
    defect_done_date: "",
    asana_link: "",
    working_folder: "",
    main_contractor_id: "",
  });

  const resetWellKnownBrandState = () => {
    setIsWellKnownBrand(false);
    setBrandNameCn("");
    setBrandNameEn("");
    setBrandingIconPreview(null);
    setBrandingIconFile(null);
    setWellKnownTagRowId(null);
  };

  const loadWellKnownBrandState = useCallback(async (customerId: string) => {
    setLoadingBrandState(true);
    setBrandingIconFile(null);
    const state = await fetchCustomerWellKnownBrandState(customerId);
    setIsWellKnownBrand(state.isWellKnownBrand);
    setBrandNameCn(state.brand_name_cn);
    setBrandNameEn(state.brand_name_en);
    setBrandingIconPreview(state.branding_icon);
    setWellKnownTagRowId(state.customerTagRowId);
    setLoadingBrandState(false);
  }, []);

  const applyDraft = (draft: BwaProjectDraft) => {
    setForm(draft.form);
    setBuildingLabel(draft.buildingLabel);
    setCustomerLabel(draft.customerLabel);
    setContractorLabel(draft.contractorLabel);
    setIsWellKnownBrand(draft.isWellKnownBrand);
    setBrandNameCn(draft.brandNameCn);
    setBrandNameEn(draft.brandNameEn);
    setBrandingIconPreview(draft.brandingIconPreview);
    setWellKnownTagRowId(draft.wellKnownTagRowId);
    setBrandingIconFile(draft.brandingIconFile);
  };

  const currentDraft = (): BwaProjectDraft => ({
    form,
    buildingLabel,
    customerLabel,
    contractorLabel,
    isWellKnownBrand,
    brandNameCn,
    brandNameEn,
    brandingIconPreview,
    wellKnownTagRowId,
    brandingIconFile,
    brandingIconFileKey: fileKey(brandingIconFile),
  });

  // Initialize form from data
  useEffect(() => {
    let cancelled = false;

    if (!open || !data) {
      return () => { cancelled = true; };
    }

    setError(null);

    if (applyRestoredDraft(applyDraft)) {
      skipBrandReloadRef.current = true;
      return () => { cancelled = true; };
    }

    beginFreshHydrate();
    setForm({
      project_name: data.project_name || "",
      project_code: data.project_code || "",
      description: data.description || "",
      customer_id: data.customer_id || "",
      main_pm_id: data.main_pm_id || "",
      main_designer_id: data.main_designer_id || "",
      other_pm_id: data.other_pm_id || "",
      more_pm_id: data.more_pm_id || "",
      estimated_income: data.estimated_income != null ? String(data.estimated_income) : "",
      estimated_expense: data.estimated_expense != null ? String(data.estimated_expense) : "",
      size: data.size || "",
      actual_size: data.actual_size || "",
      project_size: data.project_size || getBwaProjectSize(data.estimated_income) || "",
      height_to_tc: data.height_to_tc || "",
      height_to_bs: data.height_to_bs || "",
      height_to_fc: data.height_to_fc || "",
      site_address: data.site_address || "",
      r_nos_district_id: data.r_nos_district_id || "",
      r_building_id: data.r_building_id || "",
      n_financial_year_id: data.n_financial_year_id || "",
      n_team_type_id: data.n_team_type_id || "",
      n_service_type_id: data.n_service_type_id || "",
      n_project_types_id: "",
      quote_project_type_id: "",
      cost_centre_id: data.cost_centre_id || "",
      enquiry_date: data.enquiry_date ? data.enquiry_date.split("T")[0] : "",
      signed_date: data.signed_date ? data.signed_date.split("T")[0] : "",
      start_date: data.start_date ? data.start_date.split("T")[0] : "",
      handover_date: data.handover_date ? data.handover_date.split("T")[0] : "",
      defect_done_date: data.defect_done_date ? data.defect_done_date.split("T")[0] : "",
      asana_link: data.asana_link || "",
      working_folder: data.working_folder || "",
      main_contractor_id: data.main_contractor_id || "",
    });
    setBuildingLabel(data.building_name || "");
    setCustomerLabel(data.customer_display_name || data.customer_name || "");
    setContractorLabel(data.main_contractor_name || "");

    const finishEditHydrate = async () => {
      const [ids, qptId] = await Promise.all([
        fetchProjectProjectTypeIds(data.id),
        fetchEntityQuoteProjectTypeId(data.id, "project"),
      ]);
      if (cancelled) return;
      setForm((prev) => ({
        ...prev,
        ...(ids.length > 0 ? { n_project_types_id: ids.join(",") } : {}),
        ...(qptId ? { quote_project_type_id: qptId } : {}),
      }));
      if (data.customer_id) {
        await loadWellKnownBrandState(data.customer_id);
      } else {
        resetWellKnownBrandState();
      }
      skipBrandReloadRef.current = true;
      if (!cancelled) finishHydrate();
    };
    finishEditHydrate();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.id, applyRestoredDraft, beginFreshHydrate, finishHydrate, loadWellKnownBrandState]);

  useEffect(() => {
    if (!open || !hydrateReady) return;
    if (skipBrandReloadRef.current) {
      skipBrandReloadRef.current = false;
      return;
    }
    if (form.customer_id) {
      loadWellKnownBrandState(form.customer_id);
    } else {
      resetWellKnownBrandState();
    }
  }, [open, hydrateReady, form.customer_id, loadWellKnownBrandState]);

  useEffect(() => {
    if (!open || !hydrateReady) return;
    syncDraft(currentDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    hydrateReady,
    form,
    buildingLabel,
    customerLabel,
    contractorLabel,
    isWellKnownBrand,
    brandNameCn,
    brandNameEn,
    brandingIconPreview,
    wellKnownTagRowId,
    brandingIconFile,
    syncDraft,
  ]);

  useEffect(() => {
    if (!open || scrollToSection !== "key-dates") return;
    const timer = window.setTimeout(() => {
      keyDatesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, scrollToSection]);

  // Load lookup options
  useEffect(() => {
    if (open && !optionsLoaded) {
      Promise.all([
        fetchStaffOptions(),
        fetchPMStaffOptions(),
        fetchDesignerStaffOptions(),
        fetchDistrictOptions(),
        fetchFinancialYearOptions(),
        fetchTeamTypeOptions(),
        fetchServiceTypeOptions(),
        fetchProjectTypeOptions(),
        fetchCostCentres(),
        fetchQuoteProjectTypes(),
      ]).then(([staff, pmStaff, designerStaff, districts, fy, tt, st, pt, cc, qpt]) => {
        setStaffOptions(staff);
        setPmStaffOptions(pmStaff);
        setDesignerStaffOptions(designerStaff);
        setDistrictOptions(districts);
        setFinancialYearOptions(fy);
        setTeamTypeOptions(tt);
        setServiceTypeOptions(st);
        setProjectTypeOptions(pt);
        setCostCentreOptions(cc);
        setQuoteProjectTypeOptions(qpt);
        setOptionsLoaded(true);
      });
    }
  }, [open, optionsLoaded]);

  const setField = (key: keyof EditFormState, value: string) => {
    markUserEdited();
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDismiss = () => dismissDraft(currentDraft(), onClose);
  const handleCancel = () => cancelDraft(onClose);

  const syncWellKnownBrand = async (customerId: string): Promise<string | null> => {
    if (isWellKnownBrand) {
      let brandingIconUrl: string | undefined;
      if (brandingIconFile) {
        const uploadResult = await uploadCustomerLogo(customerId, brandingIconFile);
        if (!uploadResult.success) {
          return uploadResult.error || "商標上傳失敗";
        }
        brandingIconUrl = uploadResult.url;
      } else if (brandingIconPreview === null) {
        brandingIconUrl = "";
      }

      const brandUpdate: {
        brand_name_cn?: string;
        brand_name_en?: string;
        branding_icon?: string;
      } = {
        brand_name_cn: brandNameCn.trim(),
        brand_name_en: brandNameEn.trim(),
      };
      if (brandingIconUrl !== undefined) {
        brandUpdate.branding_icon = brandingIconUrl;
      }

      const brandResult = await updateBrandFields(customerId, brandUpdate);
      if (!brandResult.success) {
        return brandResult.error || "知名品牌資料儲存失敗";
      }

      if (!wellKnownTagRowId) {
        const tagResult = await saveCustomerTags(
          customerId,
          [
            {
              tag_uuid: WELL_KNOWN_BRANDS_TAG_ID,
              collection_uuid: WELL_KNOWN_BRANDS_COLLECTION_ID,
            },
          ],
          []
        );
        if (!tagResult.success) {
          return tagResult.error || "知名品牌標籤建立失敗";
        }
      }
    } else if (wellKnownTagRowId) {
      const tagResult = await saveCustomerTags(customerId, [], [wellKnownTagRowId]);
      if (!tagResult.success) {
        return tagResult.error || "知名品牌標籤移除失敗";
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!form.project_name.trim()) {
      setError("項目名稱為必填欄位");
      return;
    }
    if (!form.cost_centre_id) {
      setError("公司單位 (Cost Centre) 為必填欄位");
      return;
    }
    if (!form.r_building_id) {
      setError("大廈 (Building) 為必填欄位");
      return;
    }
    if (!form.actual_size.trim()) {
      setError("實用面積 SA Size 為必填欄位");
      return;
    }
    if (!form.enquiry_date) {
      setError("查詢日期 Enquiry Date 為必填欄位");
      return;
    }
    if (!form.defect_done_date) {
      setError("執漏完成日期 Defect Date 為必填欄位");
      return;
    }

    if (isWellKnownBrand && !form.customer_id) {
      setError("請先選擇客戶才能設定知名品牌");
      return;
    }

    setSaving(true);
    setError(null);
    const selectedProjectTypeIds = form.n_project_types_id
      ? form.n_project_types_id.split(",").filter(Boolean)
      : [];

    const updates: Partial<BWAProjectUpdateData> = {
      project_name: form.project_name.trim() || null,
      project_code: form.project_code.trim() || null,
      description: form.description.trim() || null,
      customer_id: form.customer_id || null,
      main_pm_id: form.main_pm_id || null,
      main_designer_id: form.main_designer_id || null,
      other_pm_id: form.other_pm_id || null,
      more_pm_id: form.more_pm_id || null,
      estimated_income: form.estimated_income ? parseFloat(form.estimated_income) : null,
      estimated_expense: form.estimated_expense ? parseFloat(form.estimated_expense) : null,
      size: form.size || null,
      actual_size: form.actual_size || null,
      project_size: form.project_size || null,
      height_to_tc: form.height_to_tc || null,
      height_to_bs: form.height_to_bs || null,
      height_to_fc: form.height_to_fc || null,
      site_address: form.site_address.trim() || null,
      r_nos_district_id: form.r_nos_district_id || null,
      r_building_id: form.r_building_id || null,
      n_financial_year_id: form.n_financial_year_id || null,
      n_team_type_id: form.n_team_type_id || null,
      n_service_type_id: form.n_service_type_id || null,
      quote_project_type_id: form.quote_project_type_id || null,
      cost_centre_id: form.cost_centre_id || null,
      enquiry_date: form.enquiry_date || null,
      signed_date: form.signed_date || null,
      start_date: form.start_date || null,
      handover_date: form.handover_date || null,
      defect_done_date: form.defect_done_date || null,
      asana_link: form.asana_link.trim() || null,
      working_folder: form.working_folder.trim() || null,
      main_contractor_id: form.main_contractor_id || null,
    };

    const result = await updateBWAProject(data.id, updates);

    if (!result.success) {
      setSaving(false);
      setError(result.error || "儲存失敗，請稍後再試");
      return;
    }

    const junctionResult = await syncBWAProjectProjectTypes(data.id, selectedProjectTypeIds);
    if (!junctionResult.success) {
      setSaving(false);
      setError(junctionResult.error || "項目類型儲存失敗，請稍後再試");
      return;
    }

    if (form.customer_id) {
      const brandError = await syncWellKnownBrand(form.customer_id);
      if (brandError) {
        setSaving(false);
        setError(brandError);
        return;
      }
    }

    setSaving(false);
    handleSavedClose(onClose);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            編輯項目 Edit Project
          </DialogTitle>
          <UnsavedDialogDraftHint visible={showUnsavedHint} />
        </DialogHeader>

        <div className="px-6 py-5 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-md">
              {error}
            </div>
          )}

          {/* ─── 基本項目資訊 Basic Project Info ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              基本項目資訊 Basic Project Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">
                  項目名稱 Project Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.project_name}
                  onChange={(e) => setField("project_name", e.target.value)}
                  placeholder="Project Name"
                  className="h-9"
                />
              </div>

              {/* Cost Centre */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  公司單位 Cost Centre <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.cost_centre_id}
                  onValueChange={(v) => setField("cost_centre_id", v)}
                >
                  <SelectTrigger className="h-9">
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

              {/* Financial Year */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  財政年度 Financial Year <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.n_financial_year_id}
                  onValueChange={(v) => setField("n_financial_year_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Financial Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {financialYearOptions.map((fy) => (
                      <SelectItem key={fy.id} value={fy.id}>
                        {fy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Code */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  項目編號 Project Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.project_code}
                  onChange={(e) => setField("project_code", e.target.value)}
                  placeholder="Project Code"
                  className="h-9"
                />
              </div>

              {/* 項目規模 (money band) — editable override */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  項目規模 Project Size
                </Label>
                <Select
                  value={form.project_size || undefined}
                  onValueChange={(v) => setField("project_size", v)}
                >
                  <SelectTrigger className="h-9">
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
                <p className="text-[11px] text-gray-400 mt-1">
                  預設依預計收入計算，可手動更改
                </p>
              </div>

              {/* Project Description */}
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">
                  項目描述 Project Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="描述此項目..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </section>

          {/* ─── 日期 Dates ───── */}
          <section ref={keyDatesRef}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              重要日期 Key Dates
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    查詢日期 Enquiry Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.enquiry_date}
                    onChange={(e) => setField("enquiry_date", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    簽約日期 Signed Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.signed_date}
                    onChange={(e) => setField("signed_date", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    開始日期 Start Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setField("start_date", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    交場日期 Handover Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.handover_date}
                    onChange={(e) => setField("handover_date", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    執漏完成日期 Defect Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.defect_done_date}
                    onChange={(e) => setField("defect_done_date", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ─── 團隊 Team ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-violet-500 rounded-full" />
              團隊分配 Team Assignment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main PM */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  主要項目經理 Main PM
                </Label>
                <Select
                  value={form.main_pm_id}
                  onValueChange={(v) => setField("main_pm_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Main PM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— 清除 —</SelectItem>
                    {pmStaffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className={s.status === "Inactive" ? "line-through text-muted-foreground" : ""}>
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Main Designer */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  主要設計師 Main Designer
                </Label>
                <Select
                  value={form.main_designer_id}
                  onValueChange={(v) => setField("main_designer_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Main Designer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— 清除 —</SelectItem>
                    {designerStaffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className={s.status === "Inactive" ? "line-through text-muted-foreground" : ""}>
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Other PM */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  其他協助者 Other PM
                </Label>
                <Select
                  value={form.other_pm_id}
                  onValueChange={(v) => setField("other_pm_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="N/A" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— 清除 —</SelectItem>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team Type */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  團隊類型 Team Type
                </Label>
                <Select
                  value={form.n_team_type_id}
                  onValueChange={(v) => setField("n_team_type_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Team Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— 清除 —</SelectItem>
                    {teamTypeOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ─── 分類 Classification ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-teal-500 rounded-full" />
              分類與類型 Classification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Service Type */}
              <div className="md:col-span-2">
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
                  onChange={(v) => setField("n_service_type_id", v)}
                  accent="blue"
                  resetKey={open}
                />
              </div>

              {/* Project Type — multi-select */}
              <div className="md:col-span-2">
                <BilingualTypeGridPicker
                  label={
                    <Label className="text-sm font-medium">
                      項目類型 Project Type
                      <span className="text-xs text-gray-400 ml-1.5 font-normal">
                        (可多選)
                      </span>
                    </Label>
                  }
                  options={projectTypeOptions}
                  searchPlaceholder="搜尋項目類型 / Search project type..."
                  mode="multi"
                  value={form.n_project_types_id}
                  onChange={(v) => setField("n_project_types_id", v)}
                  accent="amber"
                  resetKey={open}
                />
              </div>

              {/* Quote Project Type — drives the dynamic Site Status questionnaire */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  工地狀況問卷類型 Site Status Type
                </Label>
                <Select
                  value={form.quote_project_type_id || "__none__"}
                  onValueChange={(v) =>
                    setField("quote_project_type_id", v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="選擇報價項目類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— 不指定（只顯示通用問題）—</SelectItem>
                    {quoteProjectTypeOptions.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ─── 客戶與地點 Customer & Location ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500 rounded-full" />
              客戶與地點 Customer & Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer */}
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">
                  搜尋並選擇客戶 Search & Select Customer
                </Label>
                <SearchableSelect
                  value={form.customer_id}
                  onChange={(id) => setField("customer_id", id)}
                  placeholder="Select a customer"
                  searchFn={searchCustomerOptions}
                  initialLabel={customerLabel}
                  onLabelChange={setCustomerLabel}
                />
              </div>

              {/* District */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  地區 District
                </Label>
                <Select
                  value={form.r_nos_district_id}
                  onValueChange={(v) => setField("r_nos_district_id", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="District" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— 清除 —</SelectItem>
                    {districtOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Building */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-500">
                    搜尋並選擇大廈 Search & Select Building <span className="text-red-500">*</span>
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
                  onChange={(id) => setField("r_building_id", id)}
                  placeholder="Select a building"
                  searchFn={searchBuildingOptions}
                  initialLabel={buildingLabel}
                />
                <BuildingEditDialog
                  open={quickAddBuildingOpen}
                  onOpenChange={setQuickAddBuildingOpen}
                  building={null}
                  onSaved={(created) => {
                    if (created) {
                      setField("r_building_id", created.id);
                      setBuildingLabel(created.label);
                    }
                  }}
                />
              </div>

              {/* Site Address */}
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500 mb-1 block">
                  工地位置 Site Address
                </Label>
                <Textarea
                  value={form.site_address}
                  onChange={(e) => setField("site_address", e.target.value)}
                  placeholder="Site Address"
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* GFA Size (optional) */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  建築面積 GFA Size (sq. ft.)
                </Label>
                <Input
                  value={form.size}
                  onChange={(e) => setField("size", e.target.value)}
                  placeholder="Gross Floor Area (sq. ft.)"
                  className="h-9"
                />
              </div>

              {/* SA Size (required) */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  實用面積 SA Size (sq. ft.)
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.actual_size}
                  onChange={(e) => setField("actual_size", e.target.value)}
                  placeholder="Saleable Area (sq. ft.)"
                  className="h-9"
                />
              </div>

              {/* True Ceiling height */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  樓底高度 - 真天花 True Celling (mm)
                </Label>
                <Input
                  value={form.height_to_tc}
                  onChange={(e) => setField("height_to_tc", e.target.value)}
                  placeholder="Height to TC (mm)"
                  className="h-9"
                />
              </div>

              {/* Beam Soffit height */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  樓底高度 - 陣底 Beam Soffit (mm)
                </Label>
                <Input
                  value={form.height_to_bs}
                  onChange={(e) => setField("height_to_bs", e.target.value)}
                  placeholder="Height to BS (mm)"
                  className="h-9"
                />
              </div>

              {/* False Ceiling height */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  樓底高度 - 假天花 False Celling (mm)
                </Label>
                <Input
                  value={form.height_to_fc}
                  onChange={(e) => setField("height_to_fc", e.target.value)}
                  placeholder="Height to FC (mm)"
                  className="h-9"
                />
              </div>
            </div>
          </section>

          {/* ─── 知名品牌 Well-known Brand ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              知名品牌 Well-known Brand
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    此客戶是否為知名品牌？
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    開啟後會為客戶加上「知名品牌」標籤，並可編輯品牌資料
                  </p>
                </div>
                <Switch
                  checked={isWellKnownBrand}
                  onCheckedChange={(v) => {
                    markUserEdited();
                    setIsWellKnownBrand(v);
                  }}
                  disabled={!form.customer_id || loadingBrandState || saving}
                />
              </div>

              {!form.customer_id && (
                <p className="text-xs text-amber-600">請先於上方選擇客戶，才能設定知名品牌。</p>
              )}

              {loadingBrandState && form.customer_id && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  載入客戶品牌資料中...
                </div>
              )}

              <div
                className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity",
                  !isWellKnownBrand && "opacity-50 pointer-events-none"
                )}
              >
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">品牌圖示 Branding Icon</Label>
                  <div className="flex items-start gap-4">
                    <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                      {brandingIconPreview ? (
                        <>
                          <img
                            src={
                              brandingIconPreview.startsWith("//")
                                ? `https:${brandingIconPreview}`
                                : brandingIconPreview
                            }
                            alt="品牌圖示預覽"
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              markUserEdited();
                              setBrandingIconPreview(null);
                              setBrandingIconFile(null);
                            }}
                            disabled={!isWellKnownBrand || saving}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                          <span className="text-[12px] text-gray-400 mt-0.5">無圖示</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors",
                          isWellKnownBrand && !saving
                            ? "hover:bg-gray-50 cursor-pointer"
                            : "cursor-not-allowed"
                        )}
                      >
                        <Upload className="w-4 h-4" />
                        選擇圖片
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!isWellKnownBrand || saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              markUserEdited();
                              setBrandingIconFile(file);
                              const reader = new FileReader();
                              reader.onload = (ev) =>
                                setBrandingIconPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <p className="text-xs text-gray-400">支援 JPG / PNG / SVG / WebP</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    知名品牌名稱（中文）Brand Name (Chinese)
                  </Label>
                  <Input
                    value={brandNameCn}
                    onChange={(e) => {
                      markUserEdited();
                      setBrandNameCn(e.target.value);
                    }}
                    placeholder="Chinese Brand Name"
                    className="h-9"
                    disabled={!isWellKnownBrand || saving}
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">
                    知名品牌名稱（英文）Brand Name (English)
                  </Label>
                  <Input
                    value={brandNameEn}
                    onChange={(e) => {
                      markUserEdited();
                      setBrandNameEn(e.target.value);
                    }}
                    placeholder="English Brand Name"
                    className="h-9"
                    disabled={!isWellKnownBrand || saving}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 財務預算 Financial Estimates moved to the dedicated
              「編輯財務 Edit Financials」dialog (project detail top-right menu,
              Super Admin / Admin only). */}

          {/* ─── 連結 Links ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-gray-400 rounded-full" />
              連結 Links
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Asana Link */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  Asana 連結 Asana Link
                </Label>
                <Input
                  value={form.asana_link}
                  onChange={(e) => setField("asana_link", e.target.value)}
                  placeholder="Asana Link"
                  className="h-9"
                />
              </div>

              {/* Working Folder */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  工作資料夾 Working Folder
                </Label>
                <Input
                  value={form.working_folder}
                  onChange={(e) => setField("working_folder", e.target.value)}
                  placeholder="Working Folder"
                  className="h-9"
                />
              </div>
            </div>
          </section>

          {/* ─── 主要供應商 Main Contractor ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-rose-500 rounded-full" />
              主要供應商 Main Contractor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">
                  選擇供應商 Choose Supplier
                </Label>
                <SearchableSelect
                  value={form.main_contractor_id}
                  onChange={(id) => setField("main_contractor_id", id)}
                  placeholder="Search for supplier..."
                  searchFn={async (term) => {
                    // Use supplier search
                    const { data: results } = await (await import("@/lib/supabase")).supabase
                      .from("suppliers")
                      .select("id, display_name, name")
                      .or(`display_name.ilike.%${term}%,name.ilike.%${term}%`)
                      .limit(30);
                    return (results ?? []).map((s: any) => ({
                      id: s.id,
                      label: s.display_name || s.name || "未命名",
                    }));
                  }}
                  initialLabel={contractorLabel}
                  onLabelChange={setContractorLabel}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" onClick={handleCancel} disabled={saving} className="h-9">
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
