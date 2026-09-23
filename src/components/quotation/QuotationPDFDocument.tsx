import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { FINANCIAL_MASK } from "@/lib/financial-visibility";

// ─── REGISTER CJK FONT (Noto Sans SC for Chinese character support) ──
// Font registration is deferred to runtime to use absolute URL (required by @react-pdf/renderer in browser)
function registerFonts() {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  Font.register({
    family: "NotoSansSC",
    fonts: [
      {
        src: `${base}/fonts/NotoSansSC-Regular.ttf`,
        fontWeight: "normal",
      },
      {
        src: `${base}/fonts/NotoSansSC-Bold.ttf`,
        fontWeight: "bold",
      },
    ],
  });
}

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

interface QuotationPDFProps {
  quotation: Quotation;
  sections: QuotationSection[];
  items: QuotationSectionItem[];
  costCentre: CostCentre | null;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  language: "Chi" | "Eng";
  canViewFinancialValues?: boolean;
}

// ─── STYLES ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 34,
    fontSize: 7.5,
    fontFamily: "NotoSansSC",
    color: "#1a1a1a",
  },

  // ── Header row ──────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 7,
  },
  logoImg: {
    width: 80,
    height: 26,
    objectFit: "contain",
  },
  logoTextBig: {
    fontSize: 12,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#1a1a1a",
    letterSpacing: 1,
  },
  logoSince: {
    fontSize: 6,
    color: "#666",
    letterSpacing: 2,
    marginTop: 2,
  },
  buCodeRight: {
    fontSize: 8.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "right",
  },

  // ── Client info two-column block ─────────────────────────
  clientBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  clientLeft: {
    width: "56%",
  },
  clientRight: {
    width: "42%",
  },
  clientRow: {
    flexDirection: "row",
    marginBottom: 1.5,
  },
  clientLabel: {
    fontSize: 7,
    color: "#444",
    width: 32,
  },
  clientValue: {
    fontSize: 7,
    color: "#1a1a1a",
    flex: 1,
  },
  clientRightRow: {
    flexDirection: "row",
    marginBottom: 1.5,
    justifyContent: "flex-end",
  },
  clientRightLabel: {
    fontSize: 7,
    color: "#444",
    marginRight: 4,
    textAlign: "right",
  },
  clientRightValue: {
    fontSize: 7,
    color: "#1a1a1a",
    minWidth: 90,
    textAlign: "right",
  },

  // ── Title block ──────────────────────────────────────────
  titleBlock: {
    alignItems: "center",
    marginBottom: 5,
  },
  titleText: {
    fontSize: 10,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
  },
  titleSub: {
    fontSize: 6.5,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
  titleSubNote: {
    fontSize: 6.5,
    color: "#c00",
    textAlign: "center",
    marginTop: 1,
  },
  addressLine: {
    fontSize: 7,
    color: "#1a1a1a",
    marginTop: 2,
    textAlign: "left",
    width: "100%",
  },

  // ── Main table ───────────────────────────────────────────
  table: {
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: "#999",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    backgroundColor: "#f2f2f2",
  },
  thNo: {
    width: "7%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
  },
  thDesc: {
    width: "41%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "center",
  },
  thPrice: {
    width: "14%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "right",
  },
  thQty: {
    width: "10%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "right",
  },
  thUnit: {
    width: "10%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "center",
  },
  thAmount: {
    width: "18%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "right",
  },

  // Section header row
  sectionHeaderRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#999",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
  },
  sectionNo: {
    width: "7%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
  },
  sectionName: {
    flex: 1,
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textDecoration: "underline",
  },

  // Item row
  itemRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    paddingVertical: 2,
    paddingHorizontal: 3,
    minHeight: 12,
  },
  itemNo: {
    width: "7%",
    fontSize: 6.5,
    color: "#333",
  },
  itemDesc: {
    width: "41%",
    fontSize: 6.5,
    color: "#1a1a1a",
    lineHeight: 1.35,
    paddingRight: 3,
  },
  itemPrice: {
    width: "14%",
    fontSize: 6.5,
    textAlign: "right",
  },
  itemQty: {
    width: "10%",
    fontSize: 6.5,
    textAlign: "right",
  },
  itemUnit: {
    width: "10%",
    fontSize: 6.5,
    textAlign: "center",
  },
  itemAmount: {
    width: "18%",
    fontSize: 6.5,
    textAlign: "right",
  },

  // Subtotal row
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 0.5,
    borderTopColor: "#999",
    paddingVertical: 2.5,
    paddingHorizontal: 3,
  },
  subtotalLabel: {
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    marginRight: 6,
  },
  subtotalValue: {
    width: "18%",
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "right",
  },

  // ── Totals block ─────────────────────────────────────────
  totalsBlock: {
    marginTop: 5,
    borderWidth: 0.5,
    borderColor: "#999",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  totalLabel: {
    fontSize: 7.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 7.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    textAlign: "right",
  },
  vipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  vipLabel: {
    fontSize: 7.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#444",
  },
  vipValue: {
    fontSize: 7.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#444",
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#1a1a1a",
  },
  grandTotalLabel: {
    fontSize: 8,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#fff",
  },
  grandTotalValue: {
    fontSize: 8,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#fff",
    textAlign: "right",
  },

  // ── Remarks ──────────────────────────────────────────────
  remarksBlock: {
    marginTop: 6,
  },
  remarksTitle: {
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    marginBottom: 2,
  },
  remarksText: {
    fontSize: 6.5,
    color: "#333",
    lineHeight: 1.4,
  },

  // ── Terms & Conditions ───────────────────────────────────
  termsBlock: {
    marginTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: "#bbb",
    paddingTop: 5,
  },
  termsTitle: {
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    marginBottom: 3,
  },
  termsText: {
    fontSize: 6,
    color: "#333",
    lineHeight: 1.45,
  },

  // ── Terms & Conditions (from template) ─────────────────────
  tncBlock: {
    marginTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: "#bbb",
    paddingTop: 5,
  },
  tncTitle: {
    fontSize: 7,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    marginBottom: 3,
  },
  tncSectionHeading: {
    fontSize: 6.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 2,
  },
  tncText: {
    fontSize: 6,
    color: "#333",
    lineHeight: 1.45,
    marginBottom: 1,
  },

  // ── Notice bar ───────────────────────────────────────────
  noticeBar: {
    backgroundColor: "#f5f5f5",
    borderWidth: 0.5,
    borderColor: "#ccc",
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginTop: 5,
  },
  noticeText: {
    fontSize: 6.5,
    fontFamily: "NotoSansSC",
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },

  // ── Signature block ──────────────────────────────────────
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  signCol: {
    width: "46%",
  },
  signLabel: {
    fontSize: 6.5,
    color: "#333",
    marginBottom: 40,
  },
  signLine: {
    borderTopWidth: 0.5,
    borderTopColor: "#555",
    paddingTop: 3,
  },
  signName: {
    fontSize: 6.5,
    color: "#333",
  },
  signSub: {
    fontSize: 6.5,
    color: "#555",
    marginTop: 2,
  },

  // ── Footer ───────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 34,
    right: 34,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 3,
  },
  footerText: {
    fontSize: 6,
    color: "#aaa",
    textAlign: "center",
  },
});

// ─── HELPER FUNCTIONS ─────────────────────────────────────────

function formatPdfCurrency(
  amount: number | null | undefined,
  canViewFinancialValues = true
): string {
  if (!canViewFinancialValues) return FINANCIAL_MASK;
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("en-HK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      timeZone: "Asia/Hong_Kong",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── HELPER: Parse HTML T&C into structured blocks ────────────────

interface TncBlock {
  type: "heading" | "item";
  text: string;
}

function parseTncHtml(html: string): TncBlock[] {
  const blocks: TncBlock[] = [];
  // Split by <h3> tags for section headings
  const parts = html.split(/<h3[^>]*>/i);
  for (const part of parts) {
    if (!part.trim()) continue;
    // Check if this part starts with a heading (closed by </h3>)
    const h3End = part.indexOf("</h3>");
    if (h3End !== -1) {
      const headingText = part.substring(0, h3End).replace(/<[^>]*>/g, "").trim();
      if (headingText) {
        blocks.push({ type: "heading", text: headingText });
      }
      // After the heading, look for <li> items or <p> paragraphs
      const afterHeading = part.substring(h3End + 5);
      const liMatches = afterHeading.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (liMatches) {
        liMatches.forEach((li) => {
          const text = li.replace(/<[^>]*>/g, "").trim();
          if (text) blocks.push({ type: "item", text });
        });
      } else {
        // Try <p> tags
        const pMatches = afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (pMatches) {
          pMatches.forEach((p) => {
            const text = p.replace(/<[^>]*>/g, "").trim();
            if (text) blocks.push({ type: "item", text });
          });
        } else {
          const text = afterHeading.replace(/<[^>]*>/g, "").trim();
          if (text) blocks.push({ type: "item", text });
        }
      }
    } else {
      // No heading — extract list items, <p> tags, or plain text
      const liMatches = part.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (liMatches) {
        liMatches.forEach((li) => {
          const text = li.replace(/<[^>]*>/g, "").trim();
          if (text) blocks.push({ type: "item", text });
        });
      } else {
        // Try <p> tags
        const pMatches = part.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (pMatches) {
          pMatches.forEach((p) => {
            const text = p.replace(/<[^>]*>/g, "").trim();
            if (text) blocks.push({ type: "item", text });
          });
        } else {
          const text = part.replace(/<[^>]*>/g, "").trim();
          if (text) blocks.push({ type: "item", text });
        }
      }
    }
  }
  return blocks;
}

// ─── PDF DOCUMENT COMPONENT ─────────────────────────────────

export function QuotationPDFDocument({
  quotation,
  sections,
  items,
  costCentre,
  subtotal,
  discountAmount,
  grandTotal,
  language,
  canViewFinancialValues = true,
}: QuotationPDFProps) {
  // Register fonts with absolute URL at call time (required for browser PDF generation)
  registerFonts();

  const formatCurrency = (amount: number | null | undefined) =>
    formatPdfCurrency(amount, canViewFinancialValues);

  function getSectionItems(sectionId: string) {
    return items
      .filter((i) => i.section_id === sectionId && !i.abandon)
      .sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
  }

  function calcSectionTotal(sectionId: string) {
    return getSectionItems(sectionId).reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  }

  const sortedSections = [...sections].sort(
    (a, b) =>
      (a.real_order ?? a.order ?? 0) - (b.real_order ?? b.order ?? 0)
  );

  const quoName = quotation.name || "";
  const quoNo =
    quotation.quotation_no || quotation.reference_number || "—";
  const bankNotes = costCentre?.bank_notes || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ─── HEADER ───────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            {costCentre?.business_logo && (
              <Image src={costCentre.business_logo} style={styles.logoImg} />
            )}
          </View>
          <Text style={styles.buCodeRight}>
            {language === "Chi" ? "報 價 單" : "Quotation"}
          </Text>
        </View>

        {/* ─── CLIENT INFO BLOCK ────────────────────────────────── */}
        <View style={styles.clientBlock}>
          {/* Left column: company, address, contact */}
          <View style={styles.clientLeft}>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>
                {language === "Chi" ? "公司:" : "Company:"}
              </Text>
              <Text style={styles.clientValue}>
                {quotation.company_name || "—"}
              </Text>
            </View>
            {quotation.company_address ? (
              <View style={styles.clientRow}>
                <Text style={styles.clientLabel}>
                  {language === "Chi" ? "地址:" : "Address:"}
                </Text>
                <Text style={styles.clientValue}>
                  {quotation.company_address}
                </Text>
              </View>
            ) : null}
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>
                {language === "Chi" ? "客戶:" : "Attn:"}
              </Text>
              <Text style={styles.clientValue}>
                {quotation.contact_person || "—"}
              </Text>
            </View>
            <View style={styles.clientRow}>
              <Text style={styles.clientLabel}>
                {language === "Chi" ? "電話:" : "Tel:"}
              </Text>
              <Text style={styles.clientValue}>
                {quotation.contact_tel || "—"}
              </Text>
            </View>
            {quotation.email ? (
              <View style={styles.clientRow}>
                <Text style={styles.clientLabel}>
                  {language === "Chi" ? "電郵:" : "Email:"}
                </Text>
                <Text style={styles.clientValue}>{quotation.email}</Text>
              </View>
            ) : null}
          </View>

          {/* Right column: ref no, date, PM, tel */}
          <View style={styles.clientRight}>
            <View style={styles.clientRightRow}>
              <Text style={styles.clientRightLabel}>
                {language === "Chi" ? "參考編號 :" : "Ref No:"}
              </Text>
              <Text style={styles.clientRightValue}>{quoNo}</Text>
            </View>
            <View style={styles.clientRightRow}>
              <Text style={styles.clientRightLabel}>
                {language === "Chi" ? "日期 :" : "Date:"}
              </Text>
              <Text style={styles.clientRightValue}>
                {formatDate(quotation.date)}
              </Text>
            </View>
            {quotation.project_manager ? (
              <View style={styles.clientRightRow}>
                <Text style={styles.clientRightLabel}>
                  {language === "Chi" ? "項目經理:" : "PM:"}
                </Text>
                <Text style={styles.clientRightValue}>
                  {quotation.project_manager}
                </Text>
              </View>
            ) : null}
            {quotation.pm_tel ? (
              <View style={styles.clientRightRow}>
                <Text style={styles.clientRightLabel}>
                  {language === "Chi" ? "電話:" : "Tel:"}
                </Text>
                <Text style={styles.clientRightValue}>
                  {quotation.pm_tel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── TITLE BLOCK ──────────────────────────────────────── */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>
            {quotation.quo_head || (language === "Chi" ? "報 價 單" : "QUOTATION")}
          </Text>

          {quotation.size ? (
            <Text style={styles.titleSub}>
              {language === "Chi"
                ? `實用面積：± ${quotation.size}`
                : `Floor Area: ± ${quotation.size}`}
            </Text>
          ) : null}
          {quotation.work_address ? (
            <Text style={styles.addressLine}>
              {language === "Chi" ? "施工地址: " : "Site Address: "}
              {quotation.work_address}
            </Text>
          ) : null}
        </View>

        {/* ─── ITEMS TABLE ──────────────────────────────────────── */}
        <View style={styles.table}>
          {/* Table header row */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.thNo}>
              {language === "Chi" ? "項" : "No."}
            </Text>
            <Text style={styles.thDesc}>
              {language === "Chi" ? "描述" : "Description"}
            </Text>
            <Text style={styles.thPrice}>
              {language === "Chi" ? "單價 (HK$)" : "Unit Price (HK$)"}
            </Text>
            <Text style={styles.thQty}>
              {language === "Chi" ? "數量" : "Qty"}
            </Text>
            <Text style={styles.thUnit}>
              {language === "Chi" ? "單位" : "Unit"}
            </Text>
            <Text style={styles.thAmount}>
              {language === "Chi" ? "金額 (HK$)" : "Amount (HK$)"}
            </Text>
          </View>

          {/* Sections */}
          {sortedSections.map((section, sIdx) => {
            const sectionItems = getSectionItems(section.id);
            const sectionTotal = calcSectionTotal(section.id);
            const sectionNum = sIdx + 1;

            return (
              <View key={section.id}>
                {/* Section header */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionNo}>{sectionNum}</Text>
                  <Text style={styles.sectionName}>
                    {section.name || `Section ${sectionNum}`}
                  </Text>
                </View>

                {/* Items */}
                {sectionItems.map((item, iIdx) => {
                  const amount =
                    (item.quantity || 0) * (item.unit_price || 0);
                  const isFree =
                    !item.unit_price || item.unit_price === 0;
                  const displayAmount = isFree
                    ? language === "Chi"
                      ? "免費"
                      : "Free"
                    : formatCurrency(amount);

                  return (
                    <View key={item.id} style={styles.itemRow} wrap={false}>
                      <Text style={styles.itemNo}>
                        {sectionNum}.{iIdx + 1}
                      </Text>
                      <Text style={styles.itemDesc}>
                        {item.description || "—"}
                        {item.opt ? " *" : ""}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {isFree
                          ? ""
                          : item.unit_price
                          ? formatCurrency(item.unit_price)
                          : "—"}
                      </Text>
                      <Text style={styles.itemQty}>
                        {item.quantity ?? "—"}
                      </Text>
                      <Text style={styles.itemUnit}>
                        {item.unit || "—"}
                      </Text>
                      <Text style={styles.itemAmount}>{displayAmount}</Text>
                    </View>
                  );
                })}

                {/* Section subtotal */}
                {sectionItems.length > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>
                      {language === "Chi" ? "小計:" : "Sub-Total:"}
                    </Text>
                    <Text style={styles.subtotalValue}>
                      {formatCurrency(sectionTotal)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ─── TOTALS BLOCK ─────────────────────────────────────── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {language === "Chi"
                ? "Project Total 工程總價 (HK$)"
                : "Project Total (HK$)"}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.vipRow}>
              <Text style={styles.vipLabel}>
                {language === "Chi"
                  ? `VIP 工程優惠${
                      quotation.discount_method === "Percentage"
                        ? ` (${quotation.discount_percent}%)`
                        : ""
                    }`
                  : `Discount${
                      quotation.discount_method === "Percentage"
                        ? ` (${quotation.discount_percent}%)`
                        : ""
                    }`}
              </Text>
              <Text style={styles.vipValue}>
                {formatCurrency(grandTotal)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>
              {language === "Chi"
                ? "Grand Total 最終總價 (HK$)"
                : "GRAND TOTAL (HK$)"}
            </Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(grandTotal)}
            </Text>
          </View>
        </View>

        {/* ─── REMARKS ──────────────────────────────────────────── */}
        {quotation.remark_under_section ? (
          <View style={styles.remarksBlock}>
            <Text style={styles.remarksTitle}>
              {language === "Chi" ? "備註:" : "Remarks:"}
            </Text>
            <Text style={styles.remarksText}>
              {quotation.remark_under_section}
            </Text>
          </View>
        ) : null}

        {/* ─── TERMS & CONDITIONS (from template) ─────────────────── */}
        {quotation.terms_and_conditions ? (() => {
          const tncBlocks = parseTncHtml(quotation.terms_and_conditions!);
          return (
            <View style={styles.tncBlock}>
              <Text style={styles.tncTitle}>
                {language === "Chi" ? "條款及細則" : "Terms & Conditions"}
              </Text>
              {tncBlocks.map((block, idx) => {
                if (block.type === "heading") {
                  return (
                    <Text key={idx} style={styles.tncSectionHeading}>
                      {block.text}
                    </Text>
                  );
                }
                return (
                  <Text key={idx} style={styles.tncText}>
                    {block.text}
                  </Text>
                );
              })}
            </View>
          );
        })() : null}

        {/* ─── BANK INFORMATION ───────────────────────────────────── */}
        {bankNotes ? (
          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>
              {language === "Chi"
                ? "銀行資訊"
                : "Bank Information"}
            </Text>
            <Text style={styles.termsText}>{bankNotes}</Text>
          </View>
        ) : null}

        {/* ─── NOTICE BAR ───────────────────────────────────────── */}
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>
            {language === "Chi"
              ? "如雙方同意以上報單及合約條款內容，請於下方所屬位置簽署作實及即時生效。"
              : "If both parties agree to the above quotation and contract terms, please sign below to confirm."}
          </Text>
        </View>

        {/* ─── SIGNATURE ────────────────────────────────────────── */}
        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <Text style={styles.signLabel}>
              {language === "Chi"
                ? "客戶授權人簽署及公司蓋印"
                : "Client Authorized Signature & Company Chop"}
            </Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>
                {language === "Chi" ? "授權人名稱：" : "Name:"} {quotation.project_manager || ""}
              </Text>
              <Text style={styles.signSub}>
                {language === "Chi" ? "簽署日期：" : "Date:"} {formatDate(quotation.date)}
              </Text>
            </View>
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signLabel}>
              {language === "Chi"
                ? "公司名稱(需提供商業登記副本)"
                : "Company Name (BR copy required)"}
            </Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>
                {language === "Chi" ? "通訊地址：" : "Address:"} {quotation.company_address || ""}
              </Text>
              <Text style={styles.signSub}>
                {language === "Chi" ? "BR No. / HKID：" : "BR No. / HKID:"} {quotation.company_name || ""}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── FOOTER ───────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `第 ${pageNumber} 頁，共 ${totalPages} 頁`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
