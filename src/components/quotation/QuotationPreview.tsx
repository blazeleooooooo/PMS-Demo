"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { format } from "date-fns";

// ─── INTERFACES ─────────────────────────────────────────────

interface Quotation {
  id: string;
  quotation_no: string | null;
  name: string | null;
  status: string | null;
  date: string | null;
  l_version: string | null;
  version_number: number | null;
  company_name: string | null;
  company_address: string | null;
  contact_person: string | null;
  contact_tel: string | null;
  email: string | null;
  size: string | null;
  work_address: string | null;
  project_type: string | null;
  project_type_id: string | null;
  contract_type: string | null;
  project_manager: string | null;
  pm_tel: string | null;
  quo_head: string | null;
  reference_number: string | null;
  discount_method: string | null;
  discount_percent: number | null;
  fixed_discount: number | null;
  remark_under_section: string | null;
  terms_and_conditions: string | null;
  pitching_id: string | null;
  customer_id: string | null;
  cost_centre_id: string | null;
  created_by_id: string | null;
}

interface QuotationSection {
  id: string;
  name: string | null;
  order: number | null;
  real_order: number | null;
  s_total: number | null;
  quotation_id: string | null;
  r_section_id: string | null;
}

interface QuotationSectionItem {
  id: string;
  description: string | null;
  cost: number | null;
  unit_price: number | null;
  quantity: number | null;
  unit: string | null;
  sub_total_price: number | null;
  order_number: number | null;
  opt: boolean | null;
  abandon: boolean | null;
  section_id: string | null;
  quote_id: string | null;
}

interface CostCentre {
  id: string;
  bu_code: string | null;
  display: string | null;
  chinese_display: string | null;
  business_logo: string | null;
  company_chop: string | null;
  bank_notes: string | null;
}

interface QuotationPreviewProps {
  pitchingId: string;
  quoteId: string;
}


// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function QuotationPreview({ pitchingId, quoteId }: QuotationPreviewProps) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const { formatMoney, canViewFinancialValues } = useFinancialFormat();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [sections, setSections] = useState<QuotationSection[]>([]);
  const [items, setItems] = useState<QuotationSectionItem[]>([]);
  const [costCentre, setCostCentre] = useState<CostCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // ─── LOAD DATA ──────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, [quoteId]);

  async function loadData() {
    setLoading(true);
    try {
      const [quoteRes, sectionsRes, itemsRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("*")
          .eq("id", quoteId)
          .single(),
        supabase
          .from("quotation_sections")
          .select("*")
          .eq("quotation_id", quoteId)
          .order("order", { ascending: true }),
        supabase
          .from("quotation_section_items")
          .select("*")
          .eq("quote_id", quoteId)
          .or("abandon.is.null,abandon.eq.false")
          .order("order_number", { ascending: true }),
      ]);

      if (quoteRes.error) throw quoteRes.error;
      const q = quoteRes.data as Quotation;
      setQuotation(q);
      setSections(sectionsRes.data || []);
      setItems((itemsRes.data || []) as QuotationSectionItem[]);

      // Load cost centre if available
      if (q.cost_centre_id) {
        const { data: cc } = await supabase
          .from("cost_centres")
          .select("id, bu_code, display, chinese_display, business_logo, company_chop, bank_notes")
          .eq("id", q.cost_centre_id)
          .single();
        if (cc) setCostCentre(cc as CostCentre);
      }

      // Resolve project type name from UUID if needed
      if (q.project_type_id) {
        const { data: pt } = await supabase
          .from("nos_quote_project_types")
          .select("name")
          .eq("id", q.project_type_id)
          .single();
        if (pt?.name) {
          setQuotation((prev) => prev ? { ...prev, project_type: pt.name } : prev);
        }
      }

      // Resolve PM phone from pitching → staff if pm_tel is not already set
      if (!q.pm_tel && q.pitching_id) {
        const { data: pitching } = await supabase
          .from("bwa_pitchings")
          .select("main_pm_id")
          .eq("id", q.pitching_id)
          .single();
        if (pitching?.main_pm_id) {
          const { data: staff } = await supabase
            .from("staff")
            .select("work_phone")
            .eq("id", pitching.main_pm_id)
            .single();
          if (staff?.work_phone) {
            setQuotation((prev) => prev ? { ...prev, pm_tel: staff.work_phone } : prev);
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Error loading quotation", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ─── CALCULATED VALUES ────────────────────────────────────────

  const language = (quotation?.l_version as "Chi" | "Eng") || "Chi";

  function getSectionItems(sectionId: string) {
    return items.filter((i) => i.section_id === sectionId && !i.abandon);
  }

  function calcSectionTotal(sectionId: string) {
    return getSectionItems(sectionId).reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  }

  const subtotal = sections.reduce((sum, sec) => sum + calcSectionTotal(sec.id), 0);

  const discountAmount = (() => {
    if (quotation?.discount_method === "Percentage" && quotation?.discount_percent) {
      return subtotal * (quotation.discount_percent / 100);
    }
    if (quotation?.discount_method === "Fixed" && quotation?.fixed_discount) {
      return quotation.fixed_discount;
    }
    return 0;
  })();

  const grandTotal = subtotal - discountAmount;

  // ─── PDF DOWNLOAD (Save before export) ─────────────────────────

  async function handleDownloadPDF() {
    if (!quotation) return;
    setGenerating(true);
    try {
      // Step 1: Save/record the export to DB before generating PDF
      const { error: saveError } = await supabase
        .from("quotations")
        .update({
          modified_date: new Date().toISOString(),
        })
        .eq("id", quoteId);

      if (saveError) {
        console.error("Save before export error:", saveError);
        toast({ title: "Save Error", description: "Failed to save quotation before export. Aborting.", variant: "destructive" });
        setGenerating(false);
        return;
      }

      // Step 2: Dynamic import to avoid SSR issues
      const { pdf } = await import("@react-pdf/renderer");
      const { QuotationPDFDocument } = await import("./QuotationPDFDocument");

      const blob = await pdf(
        QuotationPDFDocument({
          quotation: quotation!,
          sections,
          items,
          costCentre,
          subtotal,
          discountAmount,
          grandTotal,
          language,
          canViewFinancialValues,
        })
      ).toBlob();

      // Step 3: Download the blob
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quotation?.quotation_no || quotation?.reference_number || "Quotation"}_v${quotation?.version_number || 1}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "PDF Downloaded", description: "Quotation saved and PDF exported successfully." });
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast({ title: "PDF Error", description: err.message || "Failed to generate PDF", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  // ─── PRINT ────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Quotation not found</p>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ─── TOP BAR (hidden in print) ─────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleNavClick(`/proposals/${pitchingId}/quotation/${quoteId}`, e, (href) => router.push(href))}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Editor
            </Button>
            <Badge variant="outline" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              {language === "Chi" ? "中文" : "English"} v{quotation.version_number || 1}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={generating}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ─── PREVIEW CONTENT (A4 aspect ratio) ─────────────────── */}
      <div className="max-w-[210mm] mx-auto my-8 print:my-0 print:max-w-full">
        <div className="bg-white shadow-lg print:shadow-none p-10 print:p-8">
          {/* ─── COMPANY HEADER ─────────────────────────────────── */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-end gap-3">
              {costCentre?.business_logo && (
                <img
                  src={costCentre.business_logo}
                  alt="Company Logo"
                  className="h-10 w-auto object-contain"
                />
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-800">
                {language === "Chi" ? "報 價 單" : "Quotation"}
              </p>
            </div>
          </div>

          {/* ─── CLIENT INFO BLOCK (2 columns) ──────────────────── */}
          <div className="flex justify-between mb-4 text-xs">
            {/* Left column */}
            <div className="w-[55%] space-y-0.5">
              <div className="flex">
                <span className="text-gray-500 w-9 shrink-0">{language === "Chi" ? "公司:" : "Company:"}</span>
                <span className="text-gray-900">{quotation.company_name || "—"}</span>
              </div>
              {quotation.company_address && (
                <div className="flex">
                  <span className="text-gray-500 w-9 shrink-0">{language === "Chi" ? "地址:" : "Address:"}</span>
                  <span className="text-gray-900">{quotation.company_address}</span>
                </div>
              )}
              <div className="flex">
                <span className="text-gray-500 w-9 shrink-0">{language === "Chi" ? "客戶:" : "Attn:"}</span>
                <span className="text-gray-900">{quotation.contact_person || "—"}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-9 shrink-0">{language === "Chi" ? "電話:" : "Tel:"}</span>
                <span className="text-gray-900">{quotation.contact_tel || "—"}</span>
              </div>
              {quotation.email && (
                <div className="flex">
                  <span className="text-gray-500 w-9 shrink-0">{language === "Chi" ? "電郵:" : "Email:"}</span>
                  <span className="text-gray-900">{quotation.email}</span>
                </div>
              )}
            </div>
            {/* Right column */}
            <div className="w-[43%] space-y-0.5 text-right">
              <div className="flex justify-end gap-2">
                <span className="text-gray-500">{language === "Chi" ? "參考編號 :" : "Ref No:"}</span>
                <span className="text-gray-900 min-w-[90px] text-right">{quotation.quotation_no || quotation.reference_number || "—"}</span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-gray-500">{language === "Chi" ? "日期 :" : "Date:"}</span>
                <span className="text-gray-900 min-w-[90px] text-right">
                  {quotation.date ? format(new Date(quotation.date), "dd/MM/yyyy") : "—"}
                </span>
              </div>
              {quotation.project_manager && (
                <div className="flex justify-end gap-2">
                  <span className="text-gray-500">{language === "Chi" ? "項目經理:" : "PM:"}</span>
                  <span className="text-gray-900 min-w-[90px] text-right">{quotation.project_manager}</span>
                </div>
              )}
              {quotation.pm_tel && (
                <div className="flex justify-end gap-2">
                  <span className="text-gray-500">{language === "Chi" ? "電話:" : "Tel:"}</span>
                  <span className="text-gray-900 min-w-[90px] text-right">{quotation.pm_tel}</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── QUOTATION TITLE ─────────────────────────────────── */}
          <div className="text-center py-3">
            <h2 className="text-lg font-bold tracking-[0.25em] text-gray-900">
              {quotation.quo_head || (language === "Chi" ? "報 價 單" : "QUOTATION")}
            </h2>

            {quotation.size && (
              <p className="text-xs text-gray-500 mt-0.5">
                {language === "Chi" ? `實用面積 ± ${quotation.size}` : `Floor Area: ± ${quotation.size}`}
              </p>
            )}
            {quotation.work_address && (
              <p className="text-xs text-gray-700 mt-1 text-left">
                {language === "Chi" ? "施工地址: " : "Site Address: "}{quotation.work_address}
              </p>
            )}
          </div>

          {/* ─── SECTIONS & ITEMS TABLE ──────────────────────────── */}
          <div className="border border-gray-300 overflow-hidden mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-3 py-2 text-left w-10 font-semibold text-gray-700">
                    {language === "Chi" ? "項" : "No."}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">
                    {language === "Chi" ? "描述" : "Description"}
                  </th>
                  <th className="px-3 py-2 text-right w-24 font-semibold text-gray-700">
                    {language === "Chi" ? "單價 (HK$)" : "Unit Price (HK$)"}
                  </th>
                  <th className="px-3 py-2 text-right w-12 font-semibold text-gray-700">
                    {language === "Chi" ? "數量" : "Qty"}
                  </th>
                  <th className="px-3 py-2 text-center w-14 font-semibold text-gray-700">
                    {language === "Chi" ? "單位" : "Unit"}
                  </th>
                  <th className="px-3 py-2 text-right w-28 font-semibold text-gray-700">
                    {language === "Chi" ? "金額 (HK$)" : "Amount (HK$)"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, sIdx) => {
                  const sectionItems = getSectionItems(section.id);
                  const sectionTotal = calcSectionTotal(section.id);
                  const sectionNum = sIdx + 1;

                  return (
                    <React.Fragment key={section.id}>
                      {/* Section Header Row */}
                      <tr className="bg-gray-50 border-t border-gray-300">
                        <td className="px-3 py-1.5 font-bold text-gray-800 text-xs">{sectionNum}</td>
                        <td className="px-3 py-1.5 font-bold text-gray-800 text-xs underline" colSpan={5}>
                          {section.name || `Section ${sectionNum}`}
                        </td>
                      </tr>

                      {/* Section Items */}
                      {sectionItems.map((item, iIdx) => {
                        const amount = (item.quantity || 0) * (item.unit_price || 0);
                        const isFree = !item.unit_price || item.unit_price === 0;
                        return (
                          <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{sectionNum}.{iIdx + 1}</td>
                            <td className="px-3 py-1.5 leading-relaxed">
                              {item.description || "—"}
                              {item.opt && (
                                <span className="ml-2 text-amber-600 font-medium"> *</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {isFree ? "" : formatMoney(item.unit_price || 0, { decimals: 0, prefix: "" })}
                            </td>
                            <td className="px-3 py-1.5 text-right">{item.quantity ?? "—"}</td>
                            <td className="px-3 py-1.5 text-center">{item.unit || "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {isFree
                                ? (language === "Chi" ? "免費" : "Free")
                                : formatMoney(amount, { decimals: 0, prefix: "" })}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Section Subtotal */}
                      {sectionItems.length > 0 && (
                        <tr className="border-t border-gray-300 bg-gray-50">
                          <td colSpan={5} className="px-3 py-1.5 text-right text-gray-600 font-semibold">
                            {language === "Chi" ? `${section.name || ""}小計 :` : `Sub-Total:`}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">
                            {formatMoney(sectionTotal, { decimals: 0, prefix: "" })}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── TOTALS SECTION ──────────────────────────────────── */}
          <div className="border border-gray-300 overflow-hidden mt-4">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-right font-semibold text-gray-700">
                    {language === "Chi" ? "Project Total 工程總價 (HK$)" : "Project Total (HK$)"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold w-36">
                    {formatMoney(subtotal, { decimals: 0, prefix: "" })}
                  </td>
                </tr>
                {discountAmount > 0 && (
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-4 py-2 text-right font-semibold text-gray-500">
                      {language === "Chi"
                        ? `VIP 工程優惠${quotation.discount_method === "Percentage" ? ` (${quotation.discount_percent}%)` : ""}`
                        : `Discount${quotation.discount_method === "Percentage" ? ` (${quotation.discount_percent}%)` : ""}`}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold w-36 text-gray-500">
                      -{formatMoney(discountAmount, { decimals: 0, prefix: "" })}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-900 text-white">
                  <td className="px-4 py-2.5 text-right font-bold">
                    {language === "Chi" ? "Grand Total 最終總價 (HK$)" : "GRAND TOTAL (HK$)"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold w-36">
                    {formatMoney(grandTotal, { decimals: 0, prefix: "" })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── REMARKS ─────────────────────────────────────────── */}
          {quotation.remark_under_section && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-700 mb-1">
                {language === "Chi" ? "備註:" : "Remarks:"}
              </p>
              <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {quotation.remark_under_section}
              </div>
            </div>
          )}

          {/* ─── TERMS & CONDITIONS ──────────────────────────────── */}
          {quotation.terms_and_conditions && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-bold text-gray-700 mb-2">
                {language === "Chi" ? "條款及細則" : "Terms & Conditions"}
              </p>
              <div
                className="text-[13px] text-gray-600 leading-relaxed prose prose-sm max-w-none [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-gray-700 [&_h3]:mt-2 [&_h3]:mb-1 [&_ol]:pl-4 [&_ol]:list-none [&_ul]:pl-4 [&_ul]:list-none [&_li]:text-[13px] [&_li]:text-gray-600 [&_li]:leading-relaxed [&_p]:text-[13px] [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:my-0.5"
                dangerouslySetInnerHTML={{ __html: quotation.terms_and_conditions }}
              />
            </div>
          )}

          {/* ─── PAYMENT TERMS / BANK NOTES ──────────────────────── */}
          {costCentre?.bank_notes && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-bold text-gray-700 mb-2">
                {language === "Chi" ? "銀行資訊" : "Bank Information"}
              </p>
              <div className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                {costCentre.bank_notes}
              </div>
            </div>
          )}

          {/* ─── NOTICE BAR ──────────────────────────────────────── */}
          <div className="mt-4 bg-gray-50 border border-gray-200 py-2 px-3">
            <p className="text-[13px] font-semibold text-gray-600 text-center">
              {language === "Chi"
                ? "如雙方同意以上報單及合約條款內容，請於下方所屬位置簽署作實及即時生效。"
                : "If both parties agree to the above quotation and contract terms, please sign below to confirm."}
            </p>
          </div>

          {/* ─── SIGNATURE BLOCK ─────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-2 gap-8">
            <div>
              <p className="text-[13px] text-gray-500 mb-16">
                {language === "Chi" ? "客戶授權人簽署及公司蓋印" : "Client Authorized Signature & Company Chop"}
              </p>
              <div className="border-t border-gray-400 pt-2">
                <p className="text-[13px] text-gray-700">
                  {language === "Chi" ? "授權人名稱：" : "Name:"} {quotation.project_manager || ""}
                </p>
                <p className="text-[13px] text-gray-500 mt-1">
                  {language === "Chi" ? "簽署日期：" : "Date:"} {quotation.date ? format(new Date(quotation.date), "dd/MM/yyyy") : ""}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[13px] text-gray-500 mb-16">
                {language === "Chi" ? "公司名稱 (需提供商業登記副本)" : "Company Name (BR copy required)"}
              </p>
              <div className="border-t border-gray-400 pt-2">
                <p className="text-[13px] text-gray-700">
                  {language === "Chi" ? "通訊地址：" : "Address:"} {quotation.company_address || ""}
                </p>
                <p className="text-[13px] text-gray-500 mt-1">
                  {language === "Chi" ? "BR No. / HKID：" : "BR No. / HKID:"} {quotation.company_name || ""}
                </p>
              </div>
            </div>
          </div>

          {/* ─── FOOTER ──────────────────────────────────────────── */}
          <div className="border-t mt-6 pt-2 text-center">
            <p className="text-[12px] text-gray-400">
              {costCentre?.display || "Acme Design Limited"} • 第 1 頁，共 1 頁
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
