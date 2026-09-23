import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  type Styles,
} from "@react-pdf/renderer";

// ─── REGISTER CJK FONT ──────────────────────────────────────
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

// ─── INTERFACES ──────────────────────────────────────────────

interface WeeklyReportPDFSection {
  label: string;
  content: string;
}

interface WeeklyReportCostCentre {
  id: string;
  bu_code: string | null;
  display: string | null;
  chinese_display: string | null;
  business_logo: string | null;
}

interface WeeklyReportPDFProps {
  projectName: string;
  projectCode: string;
  pmName: string;
  designerName: string;
  weekNumber: number;
  meetingDate: string;
  createdDate: string;
  meetingTeam: string;
  keyFocus: string;
  sections: WeeklyReportPDFSection[];
  appendix: string;
  costCentre?: WeeklyReportCostCentre | null;
}

// ─── STYLES ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "NotoSansSC",
    color: "#1a1a1a",
    lineHeight: 1.5,
  },

  // Header — aligned with Invoice/Receipt PDF
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
  reportTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A2035",
    letterSpacing: 0.5,
  },
  reportPeriod: {
    fontSize: 8.5,
    color: "#555",
    marginTop: 8,
  },

  // Info grid (below header)
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

  // Meeting Team row (full width, above Key Focus)
  meetingTeamRow: {
    marginBottom: 12,
    marginLeft: 0,
    marginRight: 0,
  },
  meetingTeamLabel: {
    fontSize: 8,
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 4,
  },
  meetingTeamValue: {
    fontSize: 8,
    color: "#1a1a1a",
    fontWeight: "bold",
    lineHeight: 1.5,
  },

  // Key Focus box
  keyFocusBox: {
    marginBottom: 14,
    padding: "8 12",
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    borderRadius: 3,
  },
  keyFocusTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#92400E",
    marginBottom: 4,
  },
  keyFocusContent: {
    width: "100%",
    fontSize: 9,
    color: "#1a1a1a",
    lineHeight: 1.5,
  },

  // Table — left/right borders on each cell so they survive page wraps
  table: {
    width: "100%",
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#4a5568",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableHeaderCell1: {
    width: "25%",
    padding: "6 10",
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    borderLeftWidth: 1,
    borderLeftColor: "#d1d5db",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableHeaderCell2: {
    width: "75%",
    padding: "6 10",
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableLabelCell: {
    width: "25%",
    padding: "7 10",
    backgroundColor: "#f9fafb",
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    borderLeftWidth: 1,
    borderLeftColor: "#d1d5db",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableContentCell: {
    width: "75%",
    padding: "7 10",
    fontSize: 9,
    color: "#1a1a1a",
    lineHeight: 1.6,
    flexDirection: "column",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  contentText: {
    width: "100%",
    fontSize: 9,
    color: "#1a1a1a",
    lineHeight: 1.6,
  },

  // Appendix
  appendixSection: {
    marginTop: 20,
  },
  appendixTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1A2035",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  appendixContent: {
    width: "100%",
    fontSize: 9,
    color: "#1a1a1a",
    lineHeight: 1.5,
  },

  /**
   * Full-width wrapper forces images onto their own row.
   * react-pdf will otherwise lay Image beside sibling Text (float-like overlap).
   * Explicit width+height on the Image is required so Yoga reserves vertical space.
   */
  imageBlock: {
    width: "100%",
    marginVertical: 6,
  },
  contentImage: {
    width: 200,
    height: 150,
    objectFit: "contain" as any,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
});

// ─── HELPER: Parse HTML into text segments and image URLs ─────

interface ContentBlock {
  type: "text" | "image";
  value: string; // text content or image src URL
  /** Optional pixel size from editor resize controls */
  width?: number;
  height?: number;
}

const PDF_IMAGE_MAX_WIDTH = 280;
const PDF_IMAGE_DEFAULT_WIDTH = 200;
const PDF_IMAGE_DEFAULT_HEIGHT = 150;

function parseImgDimension(
  tag: string,
  attr: "width" | "height"
): number | undefined {
  const attrRe = new RegExp(`\\b${attr}=["']?(\\d+(?:\\.\\d+)?)["']?`, "i");
  const attrMatch = tag.match(attrRe);
  if (attrMatch) {
    const n = Number(attrMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const styleRe = new RegExp(
    `style=["'][^"']*${attr}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`,
    "i"
  );
  const styleMatch = tag.match(styleRe);
  if (styleMatch) {
    const n = Number(styleMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function imageLayoutSize(block: ContentBlock): { width: number; height: number } {
  const rawW = block.width ?? PDF_IMAGE_DEFAULT_WIDTH;
  const width = Math.min(Math.max(rawW, 40), PDF_IMAGE_MAX_WIDTH);
  if (block.height && block.width) {
    const height = Math.min(
      Math.max((block.height / block.width) * width, 40),
      220
    );
    return { width, height };
  }
  // Preserve ~4:3 box when only width (or neither) is known
  const height = Math.min(
    Math.max(width * (PDF_IMAGE_DEFAULT_HEIGHT / PDF_IMAGE_DEFAULT_WIDTH), 40),
    220
  );
  return { width, height };
}

function parseHtmlToBlocks(html: string): ContentBlock[] {
  if (!html) return [];

  const blocks: ContentBlock[] = [];
  // Split by <img> tags; capture full tag so width/height attrs survive
  const imgRegex = /<img\b[^>]*>/gi;
  let lastIndex = 0;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const textBefore = html.slice(lastIndex, match.index);
    const stripped = stripHtmlText(textBefore);
    if (stripped) {
      blocks.push({ type: "text", value: stripped });
    }
    const tag = match[0];
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      blocks.push({
        type: "image",
        value: srcMatch[1],
        width: parseImgDimension(tag, "width"),
        height: parseImgDimension(tag, "height"),
      });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = html.slice(lastIndex);
  const strippedRemaining = stripHtmlText(remaining);
  if (strippedRemaining) {
    blocks.push({ type: "text", value: strippedRemaining });
  }

  return blocks;
}

function renderContentBlocks(
  blocks: ContentBlock[],
  textStyle?: Styles[string]
) {
  return blocks.map((block, bIdx) => {
    if (block.type === "image") {
      const size = imageLayoutSize(block);
      return (
        <View key={bIdx} style={styles.imageBlock} wrap={false}>
          <Image
            src={block.value}
            style={{
              width: size.width,
              height: size.height,
              objectFit: "contain",
            }}
          />
        </View>
      );
    }
    return (
      <Text key={bIdx} style={textStyle ?? styles.contentText}>
        {block.value}
      </Text>
    );
  });
}

function stripHtmlText(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.trim();
}

// Legacy function still used for single-line fields (keyFocus, appendix headings, etc.)
function stripHtml(html: string): string {
  return stripHtmlText(html);
}

// ─── PDF DOCUMENT COMPONENT ──────────────────────────────────

export function WeeklyReportPDFDocument(props: WeeklyReportPDFProps) {
  registerFonts();

  const {
    projectName,
    projectCode,
    pmName,
    designerName,
    weekNumber,
    meetingDate,
    createdDate,
    meetingTeam,
    keyFocus,
    sections,
    appendix,
    costCentre = null,
  } = props;

  const hasKeyFocus = keyFocus && keyFocus.trim().length > 0 && keyFocus !== "<p></p>";
  const hasAppendix = appendix && appendix.trim().length > 0 && appendix !== "<p></p>";
  const logoUrl = costCentre?.business_logo || "";
  const companyDisplay = costCentre?.display || "Acme";

  // Filter non-empty sections
  const filteredSections = sections.filter(
    (sec) => sec.content && sec.content.trim().length > 0 && sec.content !== "<p></p>"
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header — Invoice/Receipt style, cost-centre driven */}
        <View style={styles.headerRow}>
          <View>
            {logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : null}
            <Text style={styles.companyName}>{companyDisplay}</Text>
            {costCentre?.chinese_display ? (
              <Text style={styles.companyNameChinese}>
                {costCentre.chinese_display}
              </Text>
            ) : null}
            <Text style={styles.companyAddress}>
              Room D-G, 5/F, Wah Lik Industrial Centre,{"\n"}
              459-469 Castle Peak Road, Tsuen Wan, Hong Kong
            </Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.reportTitle}>工地報告 Site Status Report</Text>
          </View>
        </View>

        {/* Project meta — same info-grid pattern as Invoice/Receipt */}
        <View style={styles.infoGrid}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoLabel}>項目 Project</Text>
            {(projectName || "-").split(/\r?\n/).filter(Boolean).map((line, i) => (
              <Text key={i} style={styles.infoValue}>
                {line}
              </Text>
            ))}
            <Text style={styles.infoValueSm}>項目編號: {projectCode || "-"}</Text>
            <Text style={styles.infoValueSm}>項目經理: {pmName || "-"}</Text>
            <Text style={styles.infoValueSm}>設計師: {designerName || "-"}</Text>
          </View>
          <View style={styles.infoRight}>
            {meetingDate.trim() ? (
              <Text style={styles.infoValueSm}>會議日期: {meetingDate}</Text>
            ) : null}
            <Text style={styles.infoValueSm}>建立日期: {createdDate}</Text>
          </View>
        </View>

        {/* Meeting Team - full width row */}
        {meetingTeam && meetingTeam.trim().length > 0 && (
          <View style={styles.meetingTeamRow}>
            <Text style={styles.meetingTeamLabel}>會議參與團隊:</Text>
            <Text style={styles.meetingTeamValue}>{meetingTeam}</Text>
          </View>
        )}

        {/* Key Focus */}
        {hasKeyFocus && (() => {
          const keyFocusBlocks = parseHtmlToBlocks(keyFocus);
          return (
            <View style={styles.keyFocusBox}>
              <Text style={styles.keyFocusTitle}>本期重點 Key Focus:</Text>
              {renderContentBlocks(keyFocusBlocks, styles.keyFocusContent)}
            </View>
          );
        })()}

        {/* Main Table */}
        {filteredSections.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell1}>項目</Text>
              <Text style={styles.tableHeaderCell2}>內容</Text>
            </View>
            {filteredSections.map((sec, idx) => {
              const blocks = parseHtmlToBlocks(sec.content);
              return (
                // Do not use wrap={false}: tall image rows overflow and paint
                // images on top of the text instead of growing the cell.
                <View key={idx} style={styles.tableRow}>
                  <Text style={styles.tableLabelCell}>{sec.label}</Text>
                  <View style={styles.tableContentCell}>
                    {renderContentBlocks(blocks)}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Appendix */}
        {hasAppendix && (() => {
          const appendixBlocks = parseHtmlToBlocks(appendix);
          return (
            <View style={styles.appendixSection}>
              <Text style={styles.appendixTitle}>附錄 Appendix</Text>
              {renderContentBlocks(appendixBlocks, styles.appendixContent)}
            </View>
          );
        })()}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {`${companyDisplay} — 10 Day's Report ${weekNumber * 10} Days`}
          </Text>
          <Text style={styles.footerText}>
            {[projectCode, (projectName || "").split(/\r?\n/)[0]].filter(Boolean).join(" ")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
