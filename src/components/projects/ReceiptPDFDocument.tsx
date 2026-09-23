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

interface ReceiptFormData {
  receipt_number: string | null;
  receipt_date: string | null;
  receiver_name: string | null;
  project_name: string | null;
  amount_received: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  enable_price_difference: boolean;
  price_difference: number | null;
  price_difference_description: string | null;
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

interface ReceiptSubItem {
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
}

interface ReceiptPDFProps {
  form: ReceiptFormData;
  subItems?: ReceiptSubItem[];
  subItemsTotal?: number;
  costCentre: CostCentre | null;
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
  receiptTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#059669",
    letterSpacing: 1.5,
  },
  receiptNumber: {
    fontSize: 8.5,
    color: "#555",
    marginTop: 2,
  },
  buCode: {
    fontSize: 6.5,
    color: "#888",
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

  // ── Receipt Body ──
  bodyBlock: {
    marginTop: 10,
    marginBottom: 14,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bodyLabel: {
    fontSize: 7,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bodyAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  bodyAmountLabel: {
    fontSize: 9,
    color: "#333",
  },
  bodyAmountValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#059669",
  },
  bodyDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  bodyDetailLabel: {
    fontSize: 7.5,
    color: "#666",
  },
  bodyDetailValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#333",
  },

  // ── Sub items table ──
  subTableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d5db",
  },
  subTableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  subColItem: {
    flex: 3,
    fontSize: 7.5,
    color: "#444",
  },
  subColQty: {
    flex: 1,
    fontSize: 7.5,
    color: "#666",
    textAlign: "center",
  },
  subColPrice: {
    flex: 1.2,
    fontSize: 7.5,
    color: "#666",
    textAlign: "right",
  },
  subColAmount: {
    flex: 1.2,
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#333",
    textAlign: "right",
  },
  subColHeaderText: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },

  // ── Price Difference ──
  priceDiffBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
  },
  priceDiffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  priceDiffLabel: {
    fontSize: 7.5,
    color: "#EF4444",
  },
  priceDiffValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#EF4444",
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
    color: "#059669",
  },
  totalsDivider: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginVertical: 4,
  },

  // ── Acknowledgement ──
  ackBlock: {
    marginTop: 20,
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#ecfdf5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  ackText: {
    fontSize: 8,
    color: "#065f46",
    textAlign: "center",
    fontWeight: "bold",
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

  // ── Signature ──
  signatureBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 30,
    marginBottom: 20,
  },
  signatureBox: {
    width: "40%",
  },
  signatureBoxCenter: {
    width: 120,
    alignItems: "center",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    marginBottom: 4,
    height: 30,
    width: "100%",
  },
  signatureLabel: {
    fontSize: 7,
    color: "#666",
    textAlign: "center",
  },
  chopImg: {
    width: 60,
    height: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  chopImgCenter: {
    width: 70,
    height: 70,
    objectFit: "contain",
    marginBottom: -10,
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

export function ReceiptPDFDocument({
  form,
  subItems = [],
  subItemsTotal = 0,
  costCentre,
  netTotal,
  canViewFinancialValues = true,
  branding,
}: ReceiptPDFProps) {
  // Register fonts (idempotent)
  registerFonts();

  const formatMoney = (v: number | null | undefined) =>
    formatPdfMoney(v, canViewFinancialValues);

  const resolved = resolvePdfBranding(costCentre, branding);
  const showCompanyName = resolved.companyName.visible;
  const showCompanyLogo = resolved.companyLogo.visible;
  const showCompanyChop = resolved.companyChop.visible;
  const logoUrl = resolved.companyLogo.value.url || "";
  const companyDisplay = resolved.companyName.value.display || "Acme";
  const companyChinese = resolved.companyName.value.chineseDisplay;
  const chopUrl = resolved.companyChop.value.url;
  const showHeaderCompany = showCompanyName || showCompanyLogo;
  const amountReceived = form.amount_received || 0;
  const hideMainAmount = amountReceived === 0;
  const receivedSubtotal = amountReceived + (subItemsTotal || 0);

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
            <Text style={styles.receiptTitle}>RECEIPT 收據</Text>
            <Text style={styles.receiptNumber}>
              #REC: {form.receipt_number || "-"}
            </Text>

          </View>
        </View>

        {/* ─── INFO GRID ──────────────────────────── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoLabel}>收款自 Received From</Text>
            <Text style={styles.infoValue}>
              {form.receiver_name || "-"}
            </Text>
            <Text style={styles.infoValueSm}>
              項目: {form.project_name || "-"}
            </Text>
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoValueSm}>
              收據日期: {formatDateStr(form.receipt_date)}
            </Text>
            <Text style={styles.infoValueSm}>
              付款日期: {formatDateStr(form.payment_date)}
            </Text>
            {form.payment_method && (
              <Text style={styles.infoValueSm}>
                付款方式: {form.payment_method}
              </Text>
            )}
          </View>
        </View>

        {/* ─── RECEIPT BODY ────────────────────────── */}
        <View style={styles.bodyBlock}>
          <Text style={styles.bodyLabel}>付款詳情 Payment Details</Text>
          {/* Hide $0 main amount so sub-items can serve as the breakdown */}
          {!hideMainAmount && (
            <View style={styles.bodyAmountRow}>
              <Text style={styles.bodyAmountLabel}>收到金額 Amount Received</Text>
              <Text style={styles.bodyAmountValue}>
                {formatMoney(form.amount_received)}
              </Text>
            </View>
          )}

          {subItems.length > 0 && (
            <View>
              <View style={styles.subTableHeader}>
                <Text style={[styles.subColItem, styles.subColHeaderText]}>項目 Item</Text>
                <Text style={[styles.subColQty, styles.subColHeaderText]}>數量 Qty</Text>
                <Text style={[styles.subColPrice, styles.subColHeaderText]}>單價 Price</Text>
                <Text style={[styles.subColAmount, styles.subColHeaderText]}>金額 Amount</Text>
              </View>
              {subItems.map((si, i) => (
                <View style={styles.subTableRow} key={i}>
                  <Text style={styles.subColItem}>{si.item_name || "-"}</Text>
                  <Text style={styles.subColQty}>{si.quantity ?? "-"}</Text>
                  <Text style={styles.subColPrice}>{formatMoney(si.price)}</Text>
                  <Text style={styles.subColAmount}>{formatMoney(si.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          {form.enable_price_difference && form.price_difference != null && form.price_difference !== 0 && (
            <View style={styles.priceDiffBlock}>
              <View style={styles.priceDiffRow}>
                <Text style={styles.priceDiffLabel}>
                  差額 Price Difference{" "}
                  {form.price_difference_description
                    ? `(${form.price_difference_description})`
                    : ""}
                </Text>
                <Text style={styles.priceDiffValue}>
                  {formatMoney(form.price_difference)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ─── TOTALS ─────────────────────────────── */}
        <View style={styles.totalsBlock}>
          {!hideMainAmount && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>收到金額 Received</Text>
              <Text style={styles.totalsValue}>{formatMoney(form.amount_received)}</Text>
            </View>
          )}
          {subItems.length > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {hideMainAmount ? "小計 Subtotal" : "附加項目 Sub Items"}
              </Text>
              <Text style={styles.totalsValue}>{formatMoney(subItemsTotal)}</Text>
            </View>
          )}
          {!hideMainAmount && subItems.length > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>小計 Subtotal</Text>
              <Text style={styles.totalsValue}>{formatMoney(receivedSubtotal)}</Text>
            </View>
          )}
          {form.enable_price_difference && form.price_difference != null && form.price_difference !== 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: "#EF4444" }]}>差額 Diff</Text>
              <Text style={[styles.totalsValue, { color: "#EF4444" }]}>{formatMoney(form.price_difference)}</Text>
            </View>
          )}
          <View style={styles.totalsDivider} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsGrandLabel}>實收合計 Net Total</Text>
            <Text style={styles.totalsGrandValue}>
              {formatMoney(netTotal)}
            </Text>
          </View>
        </View>

        {/* ─── ACKNOWLEDGEMENT ─────────────────────── */}
        <View style={styles.ackBlock}>
          <Text style={styles.ackText}>
            茲確認收到上述款項。{"\n"}
            We hereby acknowledge receipt of the above payment.
          </Text>
        </View>

        {/* ─── SIGNATURE ──────────────────────────── */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureBoxCenter}>
            {showCompanyChop && chopUrl && (
              <Image src={chopUrl} style={styles.chopImgCenter} />
            )}
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              公司印章 Company Chop
            </Text>
          </View>
        </View>

        {/* ─── FOOTER (Note + Copyright) ─── */}
        <View style={styles.footerSection}>
          {form.notes && (
            <View style={styles.noteBlock}>
              <Text style={styles.noteTitle}>備註 Note:</Text>
              <Text style={styles.noteContent}>{form.notes}</Text>
            </View>
          )}

          <Text style={styles.footerCopyright}>
            This is a computer generated receipt. |{" "}
            {companyDisplay} ©{" "}
            {new Date().getFullYear()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default ReceiptPDFDocument;
