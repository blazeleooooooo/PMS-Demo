"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Loader2, FileText, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface CostCentre {
  id: string;
  bu_code: string;
  display: string;
  chinese_display: string | null;
}

interface QuoteProjectType {
  id: string;
  name: string | null;
  order: number | null;
}

interface TermTemplateType {
  id: string;
  name: string | null;
}

interface TermTemplateSection {
  id: string;
  head_name: string | null;
  order: number | null;
  template_name_id: string | null;
}

interface TermTemplateSectionDetail {
  id: string;
  description: string | null;
  number: string | null;
  order: number | null;
  template_section_id: string | null;
  template_name_id: string | null;
}

interface QuotationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitchingId: string;
  pitchingCode: string | null;
  customerName: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  siteAddress: string | null;
  size: string | null;
  pmName: string | null;
  projectTypeName: string | null;
  customerId: string | null;
  existingQuotations: Array<{ l_version: string | null; version_number: number | null }>;
  onCreated: () => void;
}

export default function QuotationCreateDialog({
  open,
  onOpenChange,
  pitchingId,
  pitchingCode,
  customerName,
  customerCompany,
  customerEmail,
  customerPhone,
  customerAddress,
  siteAddress,
  size,
  pmName,
  projectTypeName,
  customerId,
  existingQuotations,
  onCreated,
}: QuotationCreateDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [loadingCostCentres, setLoadingCostCentres] = useState(false);
  const [projectTypes, setProjectTypes] = useState<QuoteProjectType[]>([]);
  const [termTemplateTypes, setTermTemplateTypes] = useState<TermTemplateType[]>([]);
  const [selectedTermTemplateId, setSelectedTermTemplateId] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    l_version: "Chi",
    cost_centre_id: "",
    company_name: "",
    company_address: "",
    contact_person: "",
    contact_tel: "",
    email: "",
    work_address: "",
    size: "",
    project_type: "",
    project_type_id: "",
    project_manager: "",
    quo_head: "",
    remark_under_section: "",
  });

  // Fetch cost centres
  useEffect(() => {
    if (!open) return;
    const fetchCostCentres = async () => {
      setLoadingCostCentres(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("cost_centres")
          .select("id, bu_code, display, chinese_display")
          .eq("status", "Active")
          .order("bu_code");

        if (!error && data) {
          setCostCentres(data);
          // Default to BWA if available
          const bwa = data.find((c: { bu_code: string; id: string }) => c.bu_code === "BWA");
          if (bwa && !formData.cost_centre_id) {
            setFormData((prev) => ({ ...prev, cost_centre_id: bwa.id }));
          }
        }
      } catch (err) {
        console.error("[QuotationCreateDialog] Error fetching cost_centres:", err);
      } finally {
        setLoadingCostCentres(false);
      }
    };
    fetchCostCentres();
  }, [open]);

  // Load project types
  useEffect(() => {
    if (!open) return;
    const fetchProjectTypes = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("nos_quote_project_types")
        .select("id, name, order")
        .order("order", { ascending: true });
      if (data) setProjectTypes(data);
    };
    fetchProjectTypes();
  }, [open]);

  // Load term template types
  useEffect(() => {
    if (!open) return;
    const fetchTermTemplateTypes = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("term_template_types")
        .select("id, name")
        .order("name");
      if (data) setTermTemplateTypes(data);
    };
    fetchTermTemplateTypes();
  }, [open]);

  const REMARK_DEFAULT_CHI = "1. 以上報價所用之電線喉為PVC膠喉\n2. 燈飾供應為中國製，若客方指定其他產地或款式牌子則需另行報價\n3. 掣位及燈位如有加減全按客方所需數量計算";
  const REMARK_DEFAULT_ENG = "1. All wiring conduits quoted above are PVC conduits\n2. Lighting fixtures supplied are made in China; if the client specifies other origins, styles, or brands, a separate quotation will be required\n3. Any additions or reductions to switch and light points shall be calculated based on the quantities required by the client";

  // Pre-fill from pitching/customer data when dialog opens
  useEffect(() => {
    if (!open) return;
    // Reset T&C template selection
    setSelectedTermTemplateId("");
    // Try to match projectTypeName to a project type ID
    const matchedType = projectTypes.find(
      (pt) => pt.name?.toLowerCase() === projectTypeName?.toLowerCase()
    );
    const defaultLang = "Chi";
    setFormData({
      name: "",
      l_version: defaultLang,
      cost_centre_id: formData.cost_centre_id, // keep existing
      company_name: customerCompany || customerName || "",
      company_address: customerAddress || "",
      contact_person: customerName || "",
      contact_tel: customerPhone || "",
      email: customerEmail || "",
      work_address: siteAddress || "",
      size: size || "",
      project_type: projectTypeName || "",
      project_type_id: matchedType?.id || "",
      project_manager: pmName || "",
      quo_head: pitchingCode ? `${pitchingCode} Quotation` : "",
      remark_under_section: REMARK_DEFAULT_CHI,
    });
  }, [open, pitchingCode, customerName, customerCompany, customerEmail, customerPhone, customerAddress, siteAddress, size, pmName, projectTypeName, projectTypes]);

  const computeNextVersion = (language: string) => {
    const sameGroup = existingQuotations.filter(
      (q) => q.l_version === language
    );
    return Math.max(...sameGroup.map((q) => q.version_number || 0), 0) + 1;
  };

  // Generate HTML T&C content from term template sections + details
  async function generateTermsAndConditionsHtml(templateTypeId: string): Promise<string> {
    const supabase = createClient();

    // Fetch sections for this template type
    const { data: sections } = await supabase
      .from("term_template_sections")
      .select("id, head_name, order")
      .eq("template_name_id", templateTypeId)
      .order("order", { ascending: true });

    if (!sections || sections.length === 0) return "";

    // Fetch all details for these sections
    const sectionIds = sections.map((s: { id: string }) => s.id);
    const { data: details } = await supabase
      .from("term_template_section_details")
      .select("id, description, number, order, template_section_id")
      .in("template_section_id", sectionIds)
      .order("order", { ascending: true });

    // Build HTML — <ol> handles numbering automatically
    let html = "";
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      // Add a line break before each section except the first
      if (i > 0) {
        html += `<p><br></p>`;
      }
      html += `<h3><strong>${section.head_name || "Untitled Section"}</strong></h3>`;
      const sectionDetails = (details || []).filter(
        (d: { template_section_id: string }) => d.template_section_id === section.id
      );
      if (sectionDetails.length > 0) {
        html += "<ol>";
        for (const detail of sectionDetails) {
          html += `<li>${detail.description || ""}</li>`;
        }
        html += "</ol>";
      }
    }

    return html;
  }

  const handleSubmit = async () => {
    // Validate required fields (all except remark and size)
    const requiredFields: { key: keyof typeof formData; label: string }[] = [
      { key: "project_type_id", label: "項目類型 Project Type" },
      { key: "quo_head", label: "報價單標題 Quotation Header" },
      { key: "cost_centre_id", label: "成本中心 Cost Centre / BU" },
      { key: "l_version", label: "語言版本 Language Version" },
      { key: "company_name", label: "公司名稱 Company Name" },
      { key: "contact_person", label: "聯絡人 Contact Person" },
      { key: "contact_tel", label: "聯絡電話 Contact Tel" },
      { key: "email", label: "電郵 Email" },
      { key: "company_address", label: "公司地址 Company Address" },
      { key: "work_address", label: "工程地址 Work / Site Address" },
      { key: "project_manager", label: "項目經理 Project Manager" },
    ];

    const missing = requiredFields.filter((f) => !formData[f.key]?.trim());
    if (missing.length > 0) {
      toast({
        title: "必填欄位 Required Fields",
        description: `Please fill in: ${missing.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const nextVersion = computeNextVersion(formData.l_version);

      // Get current user's ID for created_by_id (must be users.id UUID)
      const createdById = profile?.id || null;

      // Generate T&C from template if selected
      let termsAndConditions: string | null = null;
      if (selectedTermTemplateId) {
        termsAndConditions = await generateTermsAndConditionsHtml(selectedTermTemplateId);
      }

      const now = new Date().toISOString();
      const { data: newQuote, error } = await supabase
        .from("quotations")
        .insert({
          pitching_id: pitchingId,
          customer_id: customerId,
          cost_centre_id: formData.cost_centre_id,
          created_by_id: createdById,
          name: formData.quo_head || null,
          l_version: formData.l_version,
          version_number: nextVersion,
          status: "Draft",
          date: now,
          company_name: formData.company_name || null,
          company_address: formData.company_address || null,
          contact_person: formData.contact_person || null,
          contact_tel: formData.contact_tel || null,
          email: formData.email || null,
          work_address: formData.work_address || null,
          size: formData.size || null,
          project_type: formData.project_type || null,
          project_type_id: formData.project_type_id || null,
          project_manager: formData.project_manager || null,
          quo_head: formData.quo_head || null,
          remark_under_section: formData.remark_under_section || null,
          terms_and_conditions: termsAndConditions,
          quotation_no: null, // Will be generated later or via numbering logic
          created_date: now,
          modified_date: now,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[QuotationCreateDialog] Insert error:", error.message);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Created", description: `Quotation v${nextVersion} (${formData.l_version}) created` });
        onCreated();
        // Navigate to the newly created quotation editor
        if (newQuote?.id) {
          router.push(`/proposals/${pitchingId}/quotation/${newQuote.id}`);
        }
      }
    } catch (err: any) {
      console.error("[QuotationCreateDialog] Unexpected error:", err);
      toast({ title: "Error", description: "Failed to create quotation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-violet-500" />
            Create New Quotation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 flex-1 overflow-y-auto -mx-1 px-1">
          {/* Row 1: Project Type + Quotation Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">項目類型 Project Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.project_type_id}
                onValueChange={(val) => {
                  const selected = projectTypes.find((pt) => pt.id === val);
                  setFormData({
                    ...formData,
                    project_type_id: val,
                    project_type: selected?.name || "",
                  });
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">報價單標題 Quotation Header <span className="text-red-500">*</span></Label>
              <Input
                value={formData.quo_head}
                onChange={(e) => setFormData({ ...formData, quo_head: e.target.value })}
                placeholder="e.g. P-BWA-2425-001 Quotation"
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 2: BU + Language Version */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">成本中心 Cost Centre / BU <span className="text-red-500">*</span></Label>
              {loadingCostCentres ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                </div>
              ) : (
                <Select
                  value={formData.cost_centre_id}
                  onValueChange={(v) => setFormData({ ...formData, cost_centre_id: v })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select Cost Centre" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCentres.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        <span className="font-medium">{cc.bu_code}</span>
                        <span className="text-gray-500 ml-2">— {cc.display}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-400">Determines company logo and payment info on PDF</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">語言版本 Language Version <span className="text-red-500">*</span></Label>
              <Select
                value={formData.l_version}
                onValueChange={(v) => {
                  const newRemark = v === "Eng" ? REMARK_DEFAULT_ENG : REMARK_DEFAULT_CHI;
                  // Only update remark if it's still one of the defaults (not manually edited)
                  const isDefaultRemark = formData.remark_under_section === REMARK_DEFAULT_CHI || formData.remark_under_section === REMARK_DEFAULT_ENG || formData.remark_under_section === "";
                  setFormData({ ...formData, l_version: v, ...(isDefaultRemark ? { remark_under_section: newRemark } : {}) });
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chi">中文 (Chinese)</SelectItem>
                  <SelectItem value="Eng">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Version Info */}
          <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
            <p className="text-xs text-violet-600 font-medium">
              This will be <strong>Version {computeNextVersion(formData.l_version)}</strong> ({formData.l_version === "Chi" ? "中文" : "English"}) for this pitching
            </p>
          </div>

          {/* Client Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">客戶資料 Client Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">公司名稱 Company Name <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">聯絡人 Contact Person <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">聯絡電話 Contact Tel <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.contact_tel}
                  onChange={(e) => setFormData({ ...formData, contact_tel: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">電郵 Email <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-gray-600">公司地址 Company Address <span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.company_address}
                  onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                  className="text-sm min-h-[60px]"
                />
              </div>
            </div>
          </div>

          {/* Project Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">項目資料 Project Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">工程地址 Work / Site Address <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.work_address}
                  onChange={(e) => setFormData({ ...formData, work_address: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">面積 Size</Label>
                <Input
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="text-sm"
                  placeholder="e.g. 1200 sq ft"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">項目經理 Project Manager <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.project_manager}
                  onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="space-y-3">
            <div className="space-y-4">
              {/* T&C Template Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5 text-amber-500" />
                  條款模板 Terms & Conditions Template
                </Label>
                <Select
                  value={selectedTermTemplateId}
                  onValueChange={(val) => setSelectedTermTemplateId(val === "none" ? "" : val)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select T&C template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-gray-400">— No template —</span>
                    </SelectItem>
                    {termTemplateTypes.map((tt) => (
                      <SelectItem key={tt.id} value={tt.id}>
                        {tt.name || "Unnamed Template"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  Selecting a template will auto-generate Terms & Conditions content from the template sections and details
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">備註 Remark (Footer Section)</Label>
                <Textarea
                  value={formData.remark_under_section}
                  onChange={(e) => setFormData({ ...formData, remark_under_section: e.target.value })}
                  className="text-sm min-h-[100px]"
                  placeholder="Payment terms, notes..."
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 border-t border-gray-100 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-1"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
