"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Loader2,
  Save,
  Download,
  Eye,
  FileText,
  Receipt,
  Building2,
  Calendar,
  DollarSign,
  StickyNote,
  User,
  Hash,
  Landmark,
  X,
  CreditCard,
  Plus,
  Trash2,
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
  fetchReceiptByIncomeId,
  fetchBWAProjectDetail,
  fetchBWFProjectDetail,
  fetchCostCentres,
  fetchTotalReceiptCount,
  createReceipt,
  updateReceipt,
  type ReceiptFormData,
  type ReceiptFullData,
  type ReceiptSubItemFormData,
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

export type ReceiptProjectType = "bwa" | "bwf";

interface ReceiptEditorProps {
  projectId: string;
  incomeId: string;
  projectType?: ReceiptProjectType;
}

export default function ReceiptEditor({ projectId, incomeId, projectType = "bwa" }: ReceiptEditorProps) {
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
  const [existingReceipt, setExistingReceipt] = useState<ReceiptFullData | null>(null);
  const [costCentres, setCostCentres] = useState<CostCentreData[]>([]);
  const [selectedCostCentre, setSelectedCostCentre] = useState<CostCentreData | null>(null);

  // Form state
  const [form, setForm] = useState<ReceiptFormData>({
    receipt_number: null,
    receipt_date: new Date().toISOString().split("T")[0],
    receiver_name: null,
    project_name: null,
    amount_received: null,
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: null,
    notes: "We hereby acknowledge receipt of the above payment. Thank you for your prompt settlement.",
    enable_price_difference: false,
    price_difference: null,
    price_difference_description: null,
    system: systemLabel,
    cost_center_bu_id: null,
    pdf_branding: null,
  });

  const [subItems, setSubItems] = useState<ReceiptSubItemFormData[]>([]);

  const updateField = (field: keyof ReceiptFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const subItemsTotal = subItems.reduce((s, si) => s + (si.amount || 0), 0);
  // Calculate net total (main amount + sub items + optional price difference)
  const netTotal =
    (form.amount_received || 0) +
    subItemsTotal +
    (form.enable_price_difference ? (form.price_difference || 0) : 0);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load cost centres for dropdown
      const centres = await fetchCostCentres();
      setCostCentres(centres);

      // Load existing receipt for this income
      const receipt = await fetchReceiptByIncomeId(incomeId);

      // Load project detail for context
      const project = isBwf
        ? await fetchBWFProjectDetail(projectId)
        : await fetchBWAProjectDetail(projectId);

      if (receipt) {
        setExistingReceipt(receipt);
        const savedCostCentreId = receipt.cost_center_bu_id || receipt.cost_centre?.id || null;
        setForm({
          receipt_number: receipt.slug || receipt.id.slice(0, 8),
          receipt_date: toDateInputValue(receipt.receipt_date) || toDateInputValue(receipt.payment_date) || new Date().toISOString().split("T")[0],
          receiver_name: receipt.customer_name,
          project_name: receipt.project_name || project?.project_name || project?.project_code || null,
          amount_received: receipt.amount_received,
          payment_date: toDateInputValue(receipt.payment_date) || null,
          payment_method: receipt.payment_method || null,
          notes: receipt.notes,
          enable_price_difference: receipt.enable_price_difference || false,
          price_difference: receipt.price_difference,
          price_difference_description: receipt.price_difference_description,
          system: receipt.system || systemLabel,
          cost_center_bu_id: savedCostCentreId,
          pdf_branding: receipt.pdf_branding ?? brandingFromCostCentre(
            receipt.cost_centre || centres.find(c => c.id === savedCostCentreId) || null
          ),
        });
        if (receipt.cost_centre) {
          setSelectedCostCentre(receipt.cost_centre);
        } else if (savedCostCentreId) {
          const found = centres.find(c => c.id === savedCostCentreId);
          if (found) setSelectedCostCentre(found);
        }
        setSubItems((receipt.sub_items || []).map(si => ({
          id: si.id,
          item_name: si.item_name,
          quantity: si.quantity,
          price: si.price,
          amount: si.amount,
        })));
      } else {
        setSubItems([]);
        // Pre-fill from project + income data
        const income = project?.incomes?.find((i: any) => i.id === incomeId);

        // Try to pre-select cost centre from project
        let projectCostCentreId: string | null = null;
        if (project?.cost_centre_id) {
          projectCostCentreId = project.cost_centre_id;
          const found = centres.find(c => c.id === projectCostCentreId);
          if (found) setSelectedCostCentre(found);
        }

        // Generate default receipt number
        const totalCount = await fetchTotalReceiptCount();
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const nextNumber = String(totalCount + 1).padStart(5, "0");
        const defaultReceiptNumber = `REC-${yy}${mm}${nextNumber}`;

        // Get customer name from project (prefer company_name)
        const invalidValues = ["N/A", "na", "n/a", "NA", "null", " ", ""];
        const isValid = (v: unknown): v is string =>
          typeof v === "string" && !invalidValues.includes(v.trim());
        const companyName = (project as any)?.customer_raw_company;
        const displayName = (project as any)?.customer_display_name;
        const custName = (project as any)?.customer_name;
        const extCustName = isBwf
          ? null
          : (project as any)?.external_customer_name;
        let receiverName: string | null = null;
        if (isValid(companyName)) {
          receiverName = companyName;
        } else if (isValid(displayName)) {
          receiverName = displayName;
        } else if (isValid(custName)) {
          receiverName = custName;
        } else if (isValid(extCustName)) {
          receiverName = extCustName;
        }

        setForm(prev => ({
          ...prev,
          receipt_number: defaultReceiptNumber,
          receiver_name: receiverName,
          project_name: project?.project_name || project?.project_code || null,
          amount_received: income?.amount || null,
          payment_date: toDateInputValue(income?.payment_date) || new Date().toISOString().split("T")[0],
          system: systemLabel,
          cost_center_bu_id: projectCostCentreId,
          pdf_branding: brandingFromCostCentre(
            centres.find(c => c.id === projectCostCentreId) || null
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to load receipt data:", err);
    }
    setLoading(false);
  }, [projectId, incomeId, isBwf, systemLabel]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    try {
      if (existingReceipt) {
        const result = await updateReceipt(existingReceipt.id, form, subItems);
        if (result.success) {
          await loadData();
        }
      } else {
        const result = await createReceipt(incomeId, form, subItems);
        if (result.success) {
          await loadData();
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
    setSaving(false);
  };

  // Sub item handlers (receipt-scoped only; never writes to incomes)
  const addSubItem = () => {
    setSubItems(prev => [...prev, { item_name: null, quantity: 1, price: null, amount: null }]);
  };

  const updateSubItem = (index: number, field: keyof ReceiptSubItemFormData, value: any) => {
    setSubItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "price") {
        updated[index].amount = (updated[index].quantity || 0) * (updated[index].price || 0);
      }
      return updated;
    });
  };

  const removeSubItem = (index: number) => {
    setSubItems(prev => prev.filter((_, i) => i !== index));
  };

  // PDF Download handler (saves before export)
  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      // Step 1: Save receipt data before exporting PDF
      if (existingReceipt) {
        const result = await updateReceipt(existingReceipt.id, form, subItems);
        if (!result.success) {
          console.error("Save before export failed");
          setGenerating(false);
          return;
        }
      } else {
        const result = await createReceipt(incomeId, form, subItems);
        if (!result.success) {
          console.error("Save before export failed");
          setGenerating(false);
          return;
        }
        // Reload data to get the newly created receipt
        await loadData();
      }

      // Step 2: Generate PDF
      const { pdf } = await import("@react-pdf/renderer");
      const { ReceiptPDFDocument } = await import("./ReceiptPDFDocument");

      const blob = await pdf(
        ReceiptPDFDocument({
          form,
          subItems,
          subItemsTotal,
          costCentre: selectedCostCentre,
          netTotal,
          canViewFinancialValues,
          branding: resolvePdfBranding(selectedCostCentre, form.pdf_branding),
        })
      ).toBlob();

      // Step 3: Download the blob
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Receipt_${form.receipt_number || "DRAFT"}_${form.receiver_name || "Customer"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  // PDF Preview handler
  const handlePreviewPDF = async () => {
    setGenerating(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReceiptPDFDocument } = await import("./ReceiptPDFDocument");

      const blob = await pdf(
        ReceiptPDFDocument({
          form,
          subItems,
          subItemsTotal,
          costCentre: selectedCostCentre,
          netTotal,
          canViewFinancialValues,
          branding: resolvePdfBranding(selectedCostCentre, form.pdf_branding),
        })
      ).toBlob();

      // Revoke old URL if any
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err: any) {
      console.error("PDF preview error:", err);
    } finally {
      setGenerating(false);
    }
  };

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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-gray-500">載入收據資料中...</span>
      </div>
    );
  }

  // ━━━ PDF PREVIEW MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderPDFPreview = () => {
    if (!showPreview || !previewUrl) return null;

    return (
      <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center">
        <div className="bg-white w-full h-full flex flex-col">
          {/* Preview header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              收據預覽 Receipt Preview
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleDownloadPDF}
                disabled={generating}
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
              title="Receipt PDF Preview"
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
            <Receipt className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-bold text-gray-900">
              {existingReceipt ? "編輯收據" : "建立收據"}
            </h1>
            {existingReceipt && (
              <Badge variant="outline" className="text-[12px]">
                #{(existingReceipt as any).slug || existingReceipt.id.slice(0, 8)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreviewPDF} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            預覽 PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPDF} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            下載 PDF
          </Button>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存收據
          </Button>
        </div>
      </div>

      {/* Income context */}
      {existingReceipt?.income && (
        <Card className="bg-emerald-50/50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-xs text-gray-500">關聯收入</span>
                <p className="font-medium text-gray-800">#{existingReceipt.income.invoice_number}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">收入金額</span>
                <p className="font-mono font-bold text-emerald-600">{formatMoney(existingReceipt.income.income_amount)}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">合約類型</span>
                <p className="font-medium">{existingReceipt.income.contract_type_name || "-"}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <span className="text-xs text-gray-500">付款狀態</span>
                <Badge variant={isIncomeSettledByStatus(existingReceipt.income.payment_status) ? "default" : "secondary"} className="text-[12px]">
                  {existingReceipt.income.payment_status || "Unknown"}
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
                <FileText className="w-4 h-4 text-emerald-500" />
                收據基本資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Hash className="w-3 h-3 inline mr-1" />
                    收據編號 Receipt #
                  </label>
                  <Input
                    value={form.receipt_number || ""}
                    onChange={e => updateField("receipt_number", e.target.value || null)}
                    placeholder="REC-001"
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
                  accent="emerald"
                  showPaymentInfo={false}
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
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <CreditCard className="w-3 h-3 inline mr-1" />
                    付款方式
                  </label>
                  <Select
                    value={form.payment_method || ""}
                    onValueChange={(v) => updateField("payment_method", v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇付款方式..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">銀行轉帳 Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">支票 Cheque</SelectItem>
                      <SelectItem value="Cash">現金 Cash</SelectItem>
                      <SelectItem value="Credit Card">信用卡 Credit Card</SelectItem>
                      <SelectItem value="FPS">轉數快 FPS</SelectItem>
                      <SelectItem value="Other">其他 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    收據日期
                  </label>
                  <Input
                    type="date"
                    value={form.receipt_date || ""}
                    onChange={e => updateField("receipt_date", e.target.value || null)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    付款日期
                  </label>
                  <Input
                    type="date"
                    value={form.payment_date || ""}
                    onChange={e => updateField("payment_date", e.target.value || null)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    <User className="w-3 h-3 inline mr-1" />
                    收款自 Received From
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

          {/* Amount */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                收款金額 Amount Received
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">收到金額 (HKD)</label>
                <Input
                  type="number"
                  value={form.amount_received ?? ""}
                  onChange={e => updateField("amount_received", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                  className="text-lg font-mono"
                />
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

          {/* Price Difference */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  差額 Price Difference
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-gray-500">啟用差額</span>
                  <Switch
                    checked={form.enable_price_difference}
                    onCheckedChange={v => updateField("enable_price_difference", v)}
                  />
                </div>
              </div>
            </CardHeader>
            {form.enable_price_difference && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">差額說明</label>
                    <Input
                      value={form.price_difference_description || ""}
                      onChange={e => updateField("price_difference_description", e.target.value || null)}
                      placeholder="例: 尾數折讓"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">差額金額</label>
                    <Input
                      type="number"
                      value={form.price_difference ?? ""}
                      onChange={e => updateField("price_difference", e.target.value ? parseFloat(e.target.value) : null)}
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
                value={form.notes || ""}
                onChange={e => updateField("notes", e.target.value || null)}
                placeholder="收據備註..."
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
                收據摘要 Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">收到金額</span>
                  <span className="font-mono font-medium">{formatMoney(form.amount_received)}</span>
                </div>
                {subItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">附加項目 ({subItems.length})</span>
                    <span className="font-mono font-medium">{formatMoney(subItemsTotal)}</span>
                  </div>
                )}
                {form.enable_price_difference && form.price_difference != null && (
                  <div className="flex justify-between text-red-500">
                    <span>差額</span>
                    <span className="font-mono">{formatMoney(form.price_difference)}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">實收合計 Net Total</span>
                <span className="text-xl font-bold font-mono-num text-emerald-600">{formatMoney(netTotal)}</span>
              </div>
              <Separator />
              <div className="space-y-1 text-xs text-gray-400">
                <p>收據編號: {form.receipt_number || "-"}</p>
                <p>收據日期: {formatDate(form.receipt_date)}</p>
                <p>付款日期: {formatDate(form.payment_date)}</p>
                <p>收款自: {form.receiver_name || "-"}</p>
                <p>付款方式: {form.payment_method || "-"}</p>
              </div>

              <div className="pt-3 space-y-2">
                <Button className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  儲存收據
                </Button>
                <Button variant="outline" className="w-full gap-1.5" onClick={handlePreviewPDF} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  預覽 PDF
                </Button>
                <Button variant="outline" className="w-full gap-1.5" onClick={handleDownloadPDF} disabled={generating}>
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
