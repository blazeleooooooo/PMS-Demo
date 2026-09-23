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
import { resolvePdfBranding, type PdfBranding } from "@/lib/pdf-branding";

// ─── REGISTER CJK FONT (Noto Sans SC for Chinese character support) ──
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

interface InvoiceSubItem {
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
}

interface InvoiceFormData {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  receiver_name: string | null;
  project_name: string | null;
  main_item_name: string | null;
  main_item_quantity: number | null;
  main_item_price: number | null;
  main_item_amount: number | null;
  enable_discount: boolean;
  discount_description: string | null;
  discount_amount: number | null;
  total_amount: number | null;
  note: string | null;
  system: string | null;
  cost_center_bu_id: string | null;
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

interface InvoicePDFProps {
  form: InvoiceFormData;
  subItems: InvoiceSubItem[];
  costCentre: CostCentre | null;
  mainAmount: number;
  subItemsTotal: number;
  grossTotal: number;
  discountVal: number;
  netTotal: number;
  canViewFinancialValues?: boolean;
  branding?: PdfBranding | null;
}

// ─── STYLES ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontSize: 8,
    fontFamily: "NotoSansSC",
    color: "#1a1a1a",
  },

  // ── Header ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
  },
  logoImg: {
    width: 100,
    height: 36,
    objectFit: "contain",
    marginBottom: 6,
  },
  companyName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 1,
  },
  companyNameChinese: {
    fontSize: 8.5,
    color: "#333",
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 6.5,
    color: "#666",
    lineHeight: 1.4,
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2563EB",
    letterSpacing: 1.5,
  },
  invoiceNumber: {
    fontSize: 8.5,
    color: "#555",
    marginTop: 2,
  },

  // ── Info Grid ──
  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  infoLeft: {
    flex: 1,
  },
  infoRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontSize: 6.5,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  infoValueSm: {
    fontSize: 8,
    color: "#555",
    marginBottom: 1,
  },

  // ── Table ──
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  colItem: {
    flex: 4,
    fontSize: 7.5,
  },
  colQty: {
    flex: 1,
    textAlign: "center",
    fontSize: 7.5,
  },
  colPrice: {
    flex: 1.5,
    textAlign: "right",
    fontSize: 7.5,
  },
  colAmount: {
    flex: 1.5,
    textAlign: "right",
    fontSize: 7.5,
    fontWeight: "bold",
  },
  colHeaderText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#555",
  },

  // ── Totals ──
  totalsBlock: {
    alignItems: "flex-end",
    marginTop: 10,
    marginBottom: 14,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 7.5,
    color: "#666",
  },
  totalsValue: {
    fontSize: 7.5,
    fontWeight: "bold",
  },
  totalsGrandLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  totalsGrandValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#2563EB",
  },
  totalsDivider: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginVertical: 4,
  },
  discountText: {
    color: "#EF4444",
  },

  // ── Note ──
  noteBlock: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#888",
    marginBottom: 3,
  },
  noteContent: {
    fontSize: 7,
    color: "#555",
    lineHeight: 1.5,
  },

  // ── Payment Info + Company Chop ──
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  paymentBlock: {
    flex: 1,
    padding: 8,
    paddingRight: 12,
  },
  paymentTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#888",
    marginBottom: 3,
  },
  paymentContent: {
    fontSize: 7,
    color: "#333",
    lineHeight: 1.4,
  },
  chopBox: {
    width: 90,
    alignItems: "center",
    paddingBottom: 2,
  },
  chopImg: {
    width: 70,
    height: 70,
    objectFit: "contain",
    marginBottom: -10,
  },
  chopLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    marginBottom: 4,
    height: 30,
    width: "100%",
  },
  chopLabel: {
    fontSize: 7,
    color: "#666",
    textAlign: "center",
  },

  // ── Footer ──
  footerSection: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
  },
  footerCopyright: {
    textAlign: "center",
    fontSize: 6,
    color: "#aaa",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
});

// ─── HELPERS ─────────────────────────────────────────────────

function formatPdfMoney(
  v: number | null | undefined,
  canViewFinancialValues = true
): string {
  if (!canViewFinancialValues) return FINANCIAL_MASK;
  if (v == null) return "-";
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateStr(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", {
      timeZone: "Asia/Hong_Kong",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

// ─── PDF DOCUMENT COMPONENT ─────────────────────────────────

export function InvoicePDFDocument({
  form,
  subItems,
  costCentre,
  mainAmount,
  subItemsTotal,
  grossTotal,
  discountVal,
  netTotal,
  canViewFinancialValues = true,
  branding,
}: InvoicePDFProps) {
  // Register fonts (idempotent)
  registerFonts();

  const formatMoney = (v: number | null | undefined) =>
    formatPdfMoney(v, canViewFinancialValues);

  const resolved = resolvePdfBranding(costCentre, branding);
  const showCompanyName = resolved.companyName.visible;
  const showCompanyLogo = resolved.companyLogo.visible;
  const showCompanyChop = resolved.companyChop.visible;
  const showPaymentInfo = resolved.paymentInfo.visible;
  const logoUrl = resolved.companyLogo.value.url || "";
  const companyDisplay = resolved.companyName.value.display || "Acme";
  const companyChinese = resolved.companyName.value.chineseDisplay;
  const bankNotes = resolved.paymentInfo.value.bankNotes;
  const chopUrl = resolved.companyChop.value.url;
  const showHeaderCompany = showCompanyName || showCompanyLogo;
  const showPaymentRow =
    (showPaymentInfo && !!bankNotes) ||
    (showCompanyChop && !!chopUrl);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ─── HEADER ─────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            {showHeaderCompany ? (
              <View>
                {showCompanyLogo && logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : null}
                {showCompanyName ? (
                  <Text style={styles.companyName}>
                    {companyDisplay}
                  </Text>
                ) : null}
                {showCompanyName && companyChinese ? (
                  <Text style={styles.companyNameChinese}>
                    {companyChinese}
                  </Text>
                ) : null}
                <Text style={styles.companyAddress}>
                  Room D-G, 5/F, Wah Lik Industrial Centre,{"\n"}
                  459-469 Castle Peak Road, Tsuen Wan, Hong Kong
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.invoiceTitle}>INVOICE 發票</Text>
            <Text style={styles.invoiceNumber}>
              #INV: {form.invoice_number || "-"}
            </Text>
          </View>
        </View>

        {/* ─── INFO GRID ──────────────────────────── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoLabel}>致 Bill To</Text>
            <Text style={styles.infoValue}>
              {form.receiver_name || "-"}
            </Text>
            <Text style={styles.infoValueSm}>
              項目: {form.project_name || "-"}
            </Text>
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoValueSm}>
              發票日期: {formatDateStr(form.invoice_date)}
            </Text>
            <Text style={styles.infoValueSm}>
              到期日: {formatDateStr(form.due_date)}
            </Text>
          </View>
        </View>

        {/* ─── ITEMS TABLE ────────────────────────── */}
        {/* Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colItem, styles.colHeaderText]}>
            項目 Item
          </Text>
          <Text style={[styles.colQty, styles.colHeaderText]}>
            數量 Qty
          </Text>
          <Text style={[styles.colPrice, styles.colHeaderText]}>
            單價 Price
          </Text>
          <Text style={[styles.colAmount, styles.colHeaderText]}>
            金額 Amount
          </Text>
        </View>

        {/* Main item — hide qty/price/amount when amount is 0 so the name can act as a breakdown header */}
        <View style={styles.tableRow}>
          <View style={[styles.colItem, { fontWeight: "bold" }]}>
            {(form.main_item_name || "-").split("\n").map((line, idx) => (
              <Text key={idx} style={idx === 0 ? { fontWeight: "bold" } : { fontWeight: "normal", fontSize: 8 }}>
                {line}
              </Text>
            ))}
          </View>
          <Text style={styles.colQty}>
            {mainAmount === 0 ? "" : (form.main_item_quantity || "-")}
          </Text>
          <Text style={styles.colPrice}>
            {mainAmount === 0 ? "" : formatMoney(form.main_item_price)}
          </Text>
          <Text style={styles.colAmount}>
            {mainAmount === 0 ? "" : formatMoney(mainAmount)}
          </Text>
        </View>

        {/* Sub items */}
        {subItems.map((si, i) => (
          <View style={styles.tableRow} key={i}>
            <Text style={[styles.colItem, { color: "#444" }]}>
              {si.item_name || "-"}
            </Text>
            <Text style={[styles.colQty, { color: "#666" }]}>
              {si.quantity || "-"}
            </Text>
            <Text style={[styles.colPrice, { color: "#666" }]}>
              {formatMoney(si.price)}
            </Text>
            <Text style={styles.colAmount}>
              {formatMoney(si.amount)}
            </Text>
          </View>
        ))}

        {/* ─── TOTALS ─────────────────────────────── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>小計 Subtotal</Text>
            <Text style={styles.totalsValue}>{formatMoney(grossTotal)}</Text>
          </View>
          {form.enable_discount && discountVal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, styles.discountText]}>
                折扣 Discount{" "}
                {form.discount_description
                  ? `(${form.discount_description})`
                  : ""}
              </Text>
              <Text style={[styles.totalsValue, styles.discountText]}>
                -{formatMoney(discountVal)}
              </Text>
            </View>
          )}
          <View style={styles.totalsDivider} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsGrandLabel}>合計 Total</Text>
            <Text style={styles.totalsGrandValue}>
              {formatMoney(netTotal)}
            </Text>
          </View>
        </View>

        {/* ─── FOOTER (Note + Payment Info + Copyright) ─── */}
        <View style={styles.footerSection}>
          {form.note && (
            <View style={styles.noteBlock}>
              <Text style={styles.noteTitle}>備註 Note:</Text>
              <Text style={styles.noteContent}>{form.note}</Text>
            </View>
          )}

          {showPaymentRow && (
            <View style={styles.paymentRow}>
              {showPaymentInfo && bankNotes ? (
                <View style={styles.paymentBlock}>
                  <Text style={styles.paymentTitle}>
                    付款資料 Payment Information:
                  </Text>
                  <Text style={styles.paymentContent}>
                    {bankNotes}
                  </Text>
                </View>
              ) : (
                <View style={styles.paymentBlock} />
              )}
              {showCompanyChop && chopUrl && (
                <View style={styles.chopBox}>
                  <Image src={chopUrl} style={styles.chopImg} />
                  <View style={styles.chopLine} />
                  <Text style={styles.chopLabel}>
                    公司印章 Company Chop
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.footerCopyright}>
            This is a computer generated invoice. |{" "}
            {companyDisplay} ©{" "}
            {new Date().getFullYear()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default InvoicePDFDocument;
