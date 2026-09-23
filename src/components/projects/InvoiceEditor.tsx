"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Loader2,
  Save,
  Download,
  Eye,
  Plus,
  Trash2,
  FileText,
  Receipt,
  Building2,
  Calendar,
  DollarSign,
  Percent,
  StickyNote,
  User,
  Hash,
  Package,
  Landmark,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchInvoiceByIncomeId,
  fetchBWAProjectDetail,
  fetchBWFProjectDetail,
  fetchCostCentres,
  allocateNextInvoiceNumber,
  isInvoiceNumberTaken,
  createInvoice,
  updateInvoice,
  invoiceItemsMeetIncomeAmount,
  type InvoiceFormData,
  type InvoiceSubItemFormData,
  type InvoiceFullData,
  type CostCentreData,
} from "@/lib/data-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, toDateInputValue } from "@/lib/date-utils";
import { isIncomeSettledByStatus } from "@/lib/income-outstanding";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  applyPrimaryCostCentreChange,
  brandingFromCostCentre,
  resolvePdfBranding,
} from "@/lib/pdf-branding";
import PdfBrandingFields from "./PdfBrandingFields";

export type InvoiceProjectType = "bwa" | "bwf";

type PendingInvoiceAction = "save" | "download" | "preview";

interface InvoiceEditorProps {
  projectId: string;
  incomeId: string;
  projectType?: InvoiceProjectType;
}

export default function InvoiceEditor({ projectId, incomeId, projectType = "bwa" }: InvoiceEditorProps) {
  const isBwf = projectType === "bwf";
  const systemLabel = isBwf ? "BWF" : "BWA";
  const projectDetailPath = isBwf ? `/bwf/projects/${projectId}` : `/projects/bwa/${projectId}`;
  const { canViewFinancialValues, formatMoney2: formatMoney } = useFinancialFormat();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolvingNumber, setResolvingNumber] = useState(false);
  const [numberConflict, setNumberConflict] = useState<{
    action: PendingInvoiceAction;
    taken: string;
    suggested: string;
  } | null>(null);
  const actionLocked = useRef(false);
  const [existingInvoice, setExistingInvoice] = useState<InvoiceFullData | null>(null);
  const [relatedIncome, setRelatedIncome] = useState<{
    invoice_number: string | null;
    income_amount: number | null;
    contract_type_name: string | null;
    payment_status: string | null;
  } | null>(null);
  const [costCentres, setCostCentres] = useState<CostCentreData[]>([]);
  const [selectedCostCentre, setSelectedCostCentre] = useState<CostCentreData | null>(null);

  // Form state
  const [form, setForm] = useState<InvoiceFormData>({
    invoice_number: null,
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: null,
    receiver_name: null,
    project_name: null,
    main_item_name: null,
    main_item_quantity: 1,
    main_item_price: null,
    main_item_amount: null,
    enable_discount: false,
    discount_description: null,
    discount_amount: null,
    total_amount: null,
    note: "Thank you for your business. We do expect payment on time to ensure quality delivery of works, so please process this invoice on or before the due date (i.e. the payment receivable date in Bank). An additional 2% handling charge will be billed monthly on late invoices, and the finish date would be delayed accordingly.",
    system: systemLabel,
    cost_center_bu_id: null,
    pdf_branding: null,
  });

  const [subItems, setSubItems] = useState<InvoiceSubItemFormData[]>([]);

  const updateField = (field: keyof InvoiceFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Recalculate totals
  const recalculate = useCallback(() => {
    setForm(prev => {
      const mainAmt = (prev.main_item_quantity || 0) * (prev.main_item_price || 0);
      const subTotal = subItems.reduce((s, si) => s + (si.amount || 0), 0);
      const grossTotal = mainAmt + subTotal;
      const discount = prev.enable_discount ? (prev.discount_amount || 0) : 0;
      return {
        ...prev,
        main_item_amount: mainAmt,
        total_amount: grossTotal - discount,
      };
    });
  }, [subItems]);

  useEffect(() => { recalculate(); }, [form.main_item_quantity, form.main_item_price, form.enable_discount, form.discount_amount, subItems, recalculate]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load cost centres for dropdown
      const centres = await fetchCostCentres();
      setCostCentres(centres);

      // Load existing invoice for this income
      const invoice = await fetchInvoiceByIncomeId(incomeId);
      
      // Load project detail for context
      const project = isBwf
        ? await fetchBWFProjectDetail(projectId)
        : await fetchBWAProjectDetail(projectId);
      const projectIncome = project?.incomes?.find(i => i.id === incomeId) ?? null;
      setRelatedIncome({
        invoice_number: invoice?.income?.invoice_number ?? projectIncome?.invoice_number ?? null,
        income_amount: invoice?.income?.income_amount ?? projectIncome?.amount ?? null,
        contract_type_name: invoice?.income?.contract_type_name ?? projectIncome?.contract_type_name ?? null,
        payment_status: invoice?.income?.payment_status ?? projectIncome?.payment_status ?? null,
      });

      if (invoice) {
        setExistingInvoice(invoice);
        setForm({
          invoice_number: invoice.invoice_number,
          invoice_date: toDateInputValue(invoice.invoice_date) || new Date().toISOString().split("T")[0],
          due_date: toDateInputValue(invoice.due_date) || null,
          receiver_name: invoice.receiver_name,
          project_name: invoice.project_name,
          main_item_name: invoice.main_item_name,
          main_item_quantity: invoice.main_item_quantity,
          main_item_price: invoice.main_item_price,
          main_item_amount: invoice.main_item_amount,
          enable_discount: invoice.enable_discount || false,
          discount_description: invoice.discount_description,
          discount_amount: invoice.discount_amount,
          total_amount: invoice.total_amount,
          note: invoice.note,
          system: invoice.system || systemLabel,
          cost_center_bu_id: invoice.cost_center_bu_id || null,
          pdf_branding: invoice.pdf_branding ?? brandingFromCostCentre(
            invoice.cost_centre || centres.find(c => c.id === invoice.cost_center_bu_id) || null
          ),
        });
        // Set selected cost centre from joined data
        if (invoice.cost_centre) {
          setSelectedCostCentre(invoice.cost_centre);
        } else if (invoice.cost_center_bu_id) {
          const found = centres.find(c => c.id === invoice.cost_center_bu_id);
          if (found) setSelectedCostCentre(found);
        }
        setSubItems(invoice.sub_items.map(si => ({
          id: si.id,
          item_name: si.item_name,
          quantity: si.quantity,
          price: si.price,
          amount: si.amount,
        })));
      } else {
        // Pre-fill from project + income data
        const income = project?.incomes?.find(i => i.id === incomeId);

        // Try to pre-select cost centre from project
        let projectCostCentreId: string | null = null;
        if (project?.cost_centre_id) {
          projectCostCentreId = project.cost_centre_id;
          const found = centres.find(c => c.id === projectCostCentreId);
          if (found) setSelectedCostCentre(found);
        }

        const defaultInvoiceNumber = await allocateNextInvoiceNumber();

        setForm(prev => ({
          ...prev,
          invoice_number: defaultInvoiceNumber,
          due_date: toDateInputValue(income?.due_date) || null,
          project_name: project?.project_name || project?.project_code || null,
          receiver_name: (() => {
            // Use already-resolved customer fields from BWAProjectDetailData.
            // Primary: customer.company_name; then display_name; then the
            // person/customer name; then a manually-entered external name.
            const invalidValues = ["N/A", "na", "n/a", "NA", "null", " ", ""];
            const isValid = (v: unknown): v is string =>
              typeof v === "string" && !invalidValues.includes(v.trim());
            const companyName = (project as any)?.customer_raw_company;
            const displayName = (project as any)?.customer_display_name;
            const custName = (project as any)?.customer_name;
            const extCustName = isBwf
              ? null
              : (project as any)?.external_customer_name;
            // customer_raw_company is the customer's company_name (preferred).
            if (isValid(companyName)) return companyName;
            // customer_display_name is company_name or display_name.
            if (isValid(displayName)) return displayName;
            // customer_name is the person/contact name.
            if (isValid(custName)) return custName;
            // Fallback to external_customer_name (manually entered).
            if (isValid(extCustName)) return extCustName;
            return null;
          })(),
          main_item_name: (() => {
            if (!income) return "設計及工程服務";
            // Special case: Design and Build contract type uses project's service_types.display
            const DESIGN_AND_BUILD_CONTRACT_ID = "a5de2560-987d-4b25-ba1d-0278ab037143";
            const isDesignAndBuild = income.n_contract_type_id === DESIGN_AND_BUILD_CONTRACT_ID;
            // Line 1: contract type name part
            let namePart: string;
            if (isDesignAndBuild) {
              // Use project's service_types.display (e.g. "Design and Build")
              namePart = project?.service_type_name || "Design and Build";
            } else {
              // Default: chinese_display + english_display (e.g. "主體工程 Main")
              const chineseName = income.contract_type_chinese_name || income.contract_type_name || "設計及工程服務";
              const englishName = income.contract_type_english_name || "";
              namePart = [chineseName, englishName].filter(Boolean).join(" ");
            }
            // Use invoice_number for display (e.g. #1, #2)
            const hashPart = income.invoice_number ? `#${income.invoice_number}` : "";
            // payment percentage: current income amount / sum of all incomes with same contract type in same project
            const sameContractIncomes = (project?.incomes ?? []).filter(
              (inc) => inc.n_contract_type_id && inc.n_contract_type_id === income.n_contract_type_id
            );
            const contractSum = sameContractIncomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
            const paymentPercent = contractSum > 0 && income.amount
              ? Math.round((income.amount / contractSum) * 100)
              : 0;
            const paymentPart = `payment ${paymentPercent}%`;
            // Line 1 assembled
            const line1 = [namePart, hashPart, paymentPart].filter(Boolean).join(" ");
            // Line 2: Contract Sum
            const contractSumFormatted = `Contract Sum: ${formatMoney(contractSum)}`;
            // Line 3: Site Address
            const siteAddress = project?.site_address || "";
            const line3 = siteAddress ? `Site Address: ${siteAddress}` : "";
            // Combine lines
            return [line1, contractSumFormatted, line3].filter(Boolean).join("\n");
          })(),
          main_item_quantity: 1,
          main_item_price: income?.amount || null,
          main_item_amount: income?.amount || null,
          total_amount: income?.amount || null,
          system: systemLabel,
          cost_center_bu_id: projectCostCentreId,
          pdf_branding: brandingFromCostCentre(
            centres.find(c => c.id === projectCostCentreId) || null
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to load invoice data:", err);
    }
    setLoading(false);
  }, [projectId, incomeId, isBwf, systemLabel, formatMoney]);

  useEffect(() => { loadData(); }, [loadData]);

  const buildPdfBlob = async (payload: InvoiceFormData) => {
    const { pdf } = await import("@react-pdf/renderer");
    const { InvoicePDFDocument } = await import("./InvoicePDFDocument");
    const ma = (payload.main_item_quantity || 0) * (payload.main_item_price || 0);
    const sit = subItems.reduce((s, si) => s + (si.amount || 0), 0);
    const gt = ma + sit;
    const dv = payload.enable_discount ? (payload.discount_amount || 0) : 0;
    const nt = gt - dv;
    return pdf(
      InvoicePDFDocument({
        form: payload,
        subItems,
        costCentre: selectedCostCentre,
        mainAmount: ma,
        subItemsTotal: sit,
        grossTotal: gt,
        discountVal: dv,
        netTotal: nt,
        canViewFinancialValues,
        branding: resolvePdfBranding(selectedCostCentre, payload.pdf_branding),
      })
    ).toBlob();
  };

  const persistInvoice = async (payload: InvoiceFormData): Promise<boolean> => {
    if (existingInvoice) {
      const result = await updateInvoice(existingInvoice.id, payload, subItems);
      if (!result.success) {
        console.error("Save failed", result.error);
        return false;
      }
      await loadData();
      return true;
    }
    const result = await createInvoice(incomeId, payload, subItems);
    if (!result.success) {
      console.error("Save failed", result.error);
      return false;
    }
    await loadData();
    return true;
  };

  const runInvoiceAction = async (action: PendingInvoiceAction, payload: InvoiceFormData) => {
    const number = payload.invoice_number?.trim() ?? "";
    if (number && await isInvoiceNumberTaken(number, existingInvoice?.id ?? null)) {
      const suggested = await allocateNextInvoiceNumber();
      setNumberConflict({ action, taken: number, suggested });
      return;
    }

    if (action === "save") {
      setSaving(true);
      try {
        await persistInvoice(payload);
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setSaving(false);
      }
      return;
    }

    setGenerating(true);
    try {
      if (action === "download") {
        const saved = await persistInvoice(payload);
        if (!saved) return;
      }
      const blob = await buildPdfBlob(payload);
      if (action === "preview") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setShowPreview(true);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice_${payload.invoice_number || "DRAFT"}_${payload.receiver_name || "Customer"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const rejectDuplicateInvoiceNumber = async (
    action: PendingInvoiceAction,
    payload: InvoiceFormData,
  ): Promise<boolean> => {
    const number = payload.invoice_number?.trim() ?? "";
    if (!number) return false;
    const taken = await isInvoiceNumberTaken(number, existingInvoice?.id ?? null);
    if (!taken) return false;
    const suggested = await allocateNextInvoiceNumber();
    setNumberConflict({ action, taken: number, suggested });
    return true;
  };

  const handleSave = async () => {
    if (!invoiceItemsMeetIncomeAmount(form, subItems, relatedIncome?.income_amount)) return;
    if (actionLocked.current) return;
    actionLocked.current = true;
    try {
      if (await rejectDuplicateInvoiceNumber("save", form)) return;
      await runInvoiceAction("save", form);
    } finally {
      actionLocked.current = false;
    }
  };

  // Sub item handlers
  const addSubItem = () => {
    setSubItems(prev => [...prev, { item_name: null, quantity: 1, price: null, amount: null }]);
  };

  const updateSubItem = (index: number, field: keyof InvoiceSubItemFormData, value: any) => {
    setSubItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calc amount
      if (field === "quantity" || field === "price") {
        updated[index].amount = (updated[index].quantity || 0) * (updated[index].price || 0);
      }
      return updated;
    });
  };

  const removeSubItem = (index: number) => {
    setSubItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPDF = async () => {
    if (!invoiceItemsMeetIncomeAmount(form, subItems, relatedIncome?.income_amount)) return;
    if (actionLocked.current) return;
    actionLocked.current = true;
    try {
      if (await rejectDuplicateInvoiceNumber("download", form)) return;
      await runInvoiceAction("download", form);
    } finally {
      actionLocked.current = false;
    }
  };

  const handlePreviewPDF = async () => {
    if (!invoiceItemsMeetIncomeAmount(form, subItems, relatedIncome?.income_amount)) return;
    if (actionLocked.current) return;
    actionLocked.current = true;
    try {
      if (await rejectDuplicateInvoiceNumber("preview", form)) return;
      await runInvoiceAction("preview", form);
    } finally {
      actionLocked.current = false;
    }
  };

  const confirmSuggestedNumber = async () => {
    if (!numberConflict || resolvingNumber || actionLocked.current) return;
    actionLocked.current = true;
    setResolvingNumber(true);
    try {
      let suggested = await allocateNextInvoiceNumber();
      const taken = await isInvoiceNumberTaken(suggested, existingInvoice?.id ?? null);
      if (taken) suggested = await allocateNextInvoiceNumber();
      if (taken || suggested !== numberConflict.suggested) {
        setNumberConflict((prev) => (prev ? { ...prev, suggested } : prev));
        return;
      }
      const nextForm = { ...form, invoice_number: suggested };
      const action = numberConflict.action;
      setForm(nextForm);
      setNumberConflict(null);
      await runInvoiceAction(action, nextForm);
    } finally {
      setResolvingNumber(false);
      actionLocked.current = false;
    }
  };

  const conflictConfirmLabel =
    numberConflict?.action === "download"
      ? "使用新編號並下載"
      : numberConflict?.action === "preview"
        ? "使用新編號並預覽"
        : "使用新編號並儲存";

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Cost centre selection handler
  const handleCostCentreChange = (costCentreId: string) => {
    const cc = costCentres.find(c => c.id === costCentreId) || null;
    setSelectedCostCentre(cc);
    setForm((prev) => ({
      ...prev,
      cost_center_bu_id: costCentreId || null,
      pdf_branding: applyPrimaryCostCentreChange(prev.pdf_branding, prev.cost_center_bu_id, cc),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">載入發票資料中...</span>
      </div>
    );
  }

  // Calculate totals for display
  const mainAmount = (form.main_item_quantity || 0) * (form.main_item_price || 0);
  const subItemsTotal = subItems.reduce((s, si) => s + (si.amount || 0), 0);
  const grossTotal = mainAmount + subItemsTotal;
  const discountVal = form.enable_discount ? (form.discount_amount || 0) : 0;
  const netTotal = grossTotal - discountVal;
  const relatedIncomeAmount = relatedIncome?.income_amount ?? null;
  const itemsMeetIncomeMin = invoiceItemsMeetIncomeAmount(form, subItems, relatedIncomeAmount);
  const actionsDisabledReason = itemsMeetIncomeMin
    ? undefined
    : "主要項目與附加項目小計必須 ≥ 關聯收入金額。如需低於收入金額，請使用折扣。";
  const actionsBusy = saving || generating || resolvingNumber || !!numberConflict;

  // ━━━ PDF PREVIEW MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderPDFPreview = () => {
    if (!showPreview || !previewUrl) return null;

    return (
      <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center">
        <div className="bg-white w-full h-full flex flex-col">
          {/* Preview header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              發票預覽 Invoice Preview
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleDownloadPDF}
                disabled={actionsBusy || !itemsMeetIncomeMin}
                title={actionsDisabledReason}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                下載 PDF
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setShowPreview(false);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {/* PDF iframe */}
          <div className="flex-1 overflow-hidden">
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Invoice PDF Preview"
            />
          </div>
        </div>
      </div>
    );
  };

  // ━━━ EDIT VIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="space-y-6">
      {/* PDF Preview Modal */}
      {renderPDFPreview()}
      {numberConflict && (
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">發票編號已被使用</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                發票編號 <span className="font-medium text-gray-900">{numberConflict.taken}</span> 已被使用。
              </p>
              <p>
                可改為 <span className="font-medium text-gray-900">{numberConflict.suggested}</span> 後繼續。你也可以返回，在發票編號欄位手動改為其他編號。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setNumberConflict(null)}
                disabled={resolvingNumber}
              >
                返回修改
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={confirmSuggestedNumber}
                disabled={resolvingNumber}
              >
                {resolvingNumber && <Loader2 className="w-4 h-4 animate-spin" />}
                {conflictConfirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleNavClick(projectDetailPath, e, (href) => router.push(href))}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            返回項目
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold text-gray-900">
              {existingInvoice ? "編輯發票" : "建立發票"}
            </h1>
            {existingInvoice && (
              <Badge variant="outline" className="text-[12px]">
                #{existingInvoice.invoice_number || existingInvoice.id.slice(0, 8)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreviewPDF} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            預覽 PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPDF} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            下載 PDF
          </Button>
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存發票
          </Button>
        </div>
      </div>

      {/* Income context */}
      {relatedIncome && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-xs text-gray-500">關聯收入</span>
                <p className="font-medium text-gray-800">#{relatedIncome.invoice_number || "-"}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">收入金額</span>
                <p className="font-mono font-bold text-emerald-600">{formatMoney(relatedIncome.income_amount)}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">合約類型</span>
                <p className="font-medium">{relatedIncome.contract_type_name || "-"}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">付款狀態</span>
                <Badge variant={isIncomeSettledByStatus(relatedIncome.payment_status) ? "default" : "secondary"} className="text-[12px]">
                  {relatedIncome.payment_status || "Unknown"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                發票基本資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Hash className="w-3 h-3 inline mr-1" />
                    發票編號 Invoice #
                  </label>
                  <Input
                    value={form.invoice_number || ""}
                    onChange={e => updateField("invoice_number", e.target.value || null)}
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Landmark className="w-3 h-3 inline mr-1" />
                    成本中心 BU
                  </label>
                  <Select
                    value={form.cost_center_bu_id || ""}
                    onValueChange={handleCostCentreChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇 BU..." />
                    </SelectTrigger>
                    <SelectContent>
                      {costCentres.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.bu_code || cc.display || cc.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.pdf_branding && (
                <PdfBrandingFields
                  branding={form.pdf_branding}
                  costCentres={costCentres}
                  primaryId={form.cost_center_bu_id}
                  accent="blue"
                  showPaymentInfo
                  onChange={(next) => updateField("pdf_branding", next)}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Building2 className="w-3 h-3 inline mr-1" />
                    系統 System
                  </label>
                  <Input
                    value={form.system || systemLabel}
                    onChange={e => updateField("system", e.target.value || null)}
                    placeholder={systemLabel}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    發票日期
                  </label>
                  <Input
                    type="date"
                    value={form.invoice_date || ""}
                    onChange={e => updateField("invoice_date", e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    到期日
                  </label>
                  <Input
                    type="date"
                    value={form.due_date || ""}
                    onChange={e => updateField("due_date", e.target.value || null)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <User className="w-3 h-3 inline mr-1" />
                    收件人 Receiver
                  </label>
                  <Input
                    value={form.receiver_name || ""}
                    onChange={e => updateField("receiver_name", e.target.value || null)}
                    placeholder="客戶名稱"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Building2 className="w-3 h-3 inline mr-1" />
                    項目名稱
                  </label>
                  <Input
                    value={form.project_name || ""}
                    onChange={e => updateField("project_name", e.target.value || null)}
                    placeholder="項目名稱"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Item */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                主要項目 Main Item
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">項目名稱</label>
                <Textarea
                  value={form.main_item_name || ""}
                  onChange={e => updateField("main_item_name", e.target.value || null)}
                  placeholder="設計及工程服務費"
                  rows={4}
                  className="resize-y text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">數量 Qty</label>
                  <Input
                    type="number"
                    value={form.main_item_quantity ?? ""}
                    onChange={e => updateField("main_item_quantity", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">單價 Price</label>
                  <Input
                    type="number"
                    value={form.main_item_price ?? ""}
                    onChange={e => updateField("main_item_price", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">金額 Amount</label>
                  <div className="h-9 flex items-center px-3 bg-gray-50 border rounded-md text-sm font-mono font-medium text-emerald-700">
                    {formatMoney(mainAmount)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sub Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-500" />
                  附加項目 Sub Items ({subItems.length})
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[13px]" onClick={addSubItem}>
                  <Plus className="w-3 h-3" />
                  新增項目
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {subItems.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">暫無附加項目。點擊「新增項目」添加。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[13px]">項目名稱</TableHead>
                      <TableHead className="text-[13px] w-20 text-center">數量</TableHead>
                      <TableHead className="text-[13px] w-28 text-right">單價</TableHead>
                      <TableHead className="text-[13px] w-28 text-right">金額</TableHead>
                      <TableHead className="text-[13px] w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subItems.map((si, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            className="h-8 text-xs"
                            value={si.item_name || ""}
                            onChange={e => updateSubItem(idx, "item_name", e.target.value || null)}
                            placeholder="項目名稱"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs text-center"
                            type="number"
                            value={si.quantity ?? ""}
                            onChange={e => updateSubItem(idx, "quantity", e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs text-right"
                            type="number"
                            value={si.price ?? ""}
                            onChange={e => updateSubItem(idx, "price", e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium text-emerald-700">
                          {formatMoney(si.amount)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeSubItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Discount */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent className="w-4 h-4 text-red-500" />
                  折扣 Discount
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-gray-500">啟用折扣</span>
                  <Switch
                    checked={form.enable_discount}
                    onCheckedChange={v => updateField("enable_discount", v)}
                  />
                </div>
              </div>
              <p className="text-[12px] text-gray-400 mt-1">
                如需發票合計低於收入金額，請啟用折扣。項目小計本身不可低於收入金額。
              </p>
            </CardHeader>
            {form.enable_discount && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">折扣說明</label>
                    <Input
                      value={form.discount_description || ""}
                      onChange={e => updateField("discount_description", e.target.value || null)}
                      placeholder="例: 早鳥優惠"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">折扣金額</label>
                    <Input
                      type="number"
                      value={form.discount_amount ?? ""}
                      onChange={e => updateField("discount_amount", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Note */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                備註 Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.note || ""}
                onChange={e => updateField("note", e.target.value || null)}
                placeholder="發票備註..."
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column — Summary */}
        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                發票摘要 Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">主要項目</span>
                  <span className="font-mono font-medium">{formatMoney(mainAmount)}</span>
                </div>
                {subItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">附加項目 ({subItems.length})</span>
                    <span className="font-mono font-medium">{formatMoney(subItemsTotal)}</span>
                  </div>
                )}
                <div className={`flex justify-between ${itemsMeetIncomeMin ? "" : "text-red-600"}`}>
                  <span className={itemsMeetIncomeMin ? "text-gray-500" : ""}>小計 Subtotal</span>
                  <span className="font-mono font-medium">{formatMoney(grossTotal)}</span>
                </div>
                {relatedIncomeAmount != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">收入金額下限</span>
                    <span className="font-mono text-gray-500">{formatMoney(relatedIncomeAmount)}</span>
                  </div>
                )}
                {form.enable_discount && (
                  <div className="flex justify-between text-red-500">
                    <span>折扣</span>
                    <span className="font-mono">-{formatMoney(discountVal)}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">合計 Total</span>
                <span className="text-xl font-bold font-mono-num text-blue-600">{formatMoney(netTotal)}</span>
              </div>
              <Separator />
              <div className="space-y-1 text-xs text-gray-400">
                <p>發票編號: {form.invoice_number || "-"}</p>
                <p>發票日期: {formatDate(form.invoice_date)}</p>
                <p>到期日: {formatDate(form.due_date)}</p>
                <p>收件人: {form.receiver_name || "-"}</p>
                <p>BU: {selectedCostCentre?.bu_code || "-"}</p>
              </div>

              {!itemsMeetIncomeMin && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <p>
                    主要項目 + 附加項目小計必須 ≥ 收入金額 {formatMoney(relatedIncomeAmount)}。
                    請調整項目金額。如需低於收入金額，請使用折扣功能。
                  </p>
                </div>
              )}

              <div className="pt-3 space-y-2">
                <Button className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  儲存發票
                </Button>
                <Button variant="outline" className="w-full gap-1.5" onClick={handlePreviewPDF} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  預覽 PDF
                </Button>
                <Button variant="outline" className="w-full gap-1.5" onClick={handleDownloadPDF} disabled={actionsBusy || !itemsMeetIncomeMin} title={actionsDisabledReason}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  下載 PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
