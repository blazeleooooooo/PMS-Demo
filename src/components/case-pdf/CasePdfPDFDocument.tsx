import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  Svg,
  Path,
  Circle,
  Rect,
} from "@react-pdf/renderer";
import type { CasePdfProjectRow } from "@/lib/data-service";
import {
  buildCasePdfMetaRows,
  formatCasePdfDealAmount,
  type CasePdfMetaKey,
} from "@/lib/case-pdf-meta";
import { DEFAULT_CASE_PDF_TITLE } from "@/lib/case-pdf-storage";

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

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 36,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 9,
    color: "#888888",
    marginBottom: 20,
  },
  card: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 14,
    marginBottom: 14,
    minHeight: 165,
  },
  thumbWrap: {
    width: 220,
    height: 165,
    marginLeft: 16,
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumb: {
    width: 220,
    height: 165,
    objectFit: "cover",
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  typeTag: {
    fontSize: 8,
    color: "#2563eb",
    marginBottom: 4,
  },
  projectName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 6,
  },
  metaList: {
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  metaIcon: {
    width: 9,
    height: 9,
    marginRight: 6,
    flexShrink: 0,
  },
  metaText: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  amount: {
    fontSize: 9,
    color: "#111827",
    marginBottom: 4,
  },
  works: {
    fontSize: 8,
    color: "#4b5563",
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

const ICON_STROKE = "#6b7280";

function MetaIcon({ name }: { name: CasePdfMetaKey }) {
  const common = {
    stroke: ICON_STROKE,
    strokeWidth: 2,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg style={styles.metaIcon} viewBox="0 0 24 24">
      {name === "district" ? (
        <>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" {...common} />
          <Circle cx={12} cy={10} r={3} {...common} />
        </>
      ) : null}
      {name === "building" ? (
        <>
          <Path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" {...common} />
          <Path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" {...common} />
          <Path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" {...common} />
          <Path d="M10 6h4" {...common} />
          <Path d="M10 10h4" {...common} />
          <Path d="M10 14h4" {...common} />
          <Path d="M10 18h4" {...common} />
        </>
      ) : null}
      {name === "size" ? (
        <>
          <Path
            d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"
            {...common}
          />
          <Path d="m14.5 12.5 2-2" {...common} />
          <Path d="m11.5 9.5 2-2" {...common} />
          <Path d="m8.5 6.5 2-2" {...common} />
          <Path d="m17.5 15.5 2-2" {...common} />
        </>
      ) : null}
      {name === "period" ? (
        <>
          <Path d="M8 2v4" {...common} />
          <Path d="M16 2v4" {...common} />
          <Rect x={3} y={4} width={18} height={18} rx={2} {...common} />
          <Path d="M3 10h18" {...common} />
          <Path d="M17 14h-6" {...common} />
          <Path d="M13 18H7" {...common} />
          <Path d="M7 14h.01" {...common} />
          <Path d="M17 18h.01" {...common} />
        </>
      ) : null}
      {name === "days" ? (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Path d="M12 6v6l4 2" {...common} />
        </>
      ) : null}
    </Svg>
  );
}

function MetaRows({ row }: { row: CasePdfProjectRow }) {
  const items = buildCasePdfMetaRows(row);
  if (items.length === 0) return null;
  return (
    <View style={styles.metaList}>
      {items.map((item) => (
        <View key={item.key} style={styles.metaRow}>
          <MetaIcon name={item.key} />
          <Text style={styles.metaText}>{item.display}</Text>
        </View>
      ))}
    </View>
  );
}

interface CasePdfPDFDocumentProps {
  rows: CasePdfProjectRow[];
  /** Pre-resolved data URLs keyed by project id (avoids CORS grey boxes). */
  imageDataUrls?: Record<string, string>;
  documentTitle?: string;
}

export function CasePdfPDFDocument({
  rows,
  imageDataUrls = {},
  documentTitle = DEFAULT_CASE_PDF_TITLE,
}: CasePdfPDFDocumentProps) {
  registerFonts();
  const heading = documentTitle.trim() || DEFAULT_CASE_PDF_TITLE;

  return (
    <Document title={heading}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.subtitle}>共 {rows.length} 個項目</Text>

        {rows.map((row) => {
          const imgUrl = imageDataUrls[row.id] || null;
          return (
            <View key={row.id} style={styles.card} wrap={false}>
              <View style={styles.body}>
                {row.projectTypeName ? (
                  <Text style={styles.typeTag}>{row.projectTypeName}</Text>
                ) : null}
                <Text style={styles.projectName}>
                  {row.projectName || "（未命名項目）"}
                </Text>
                <MetaRows row={row} />
                {row.dealAmountDisplay ? (
                  <Text style={styles.amount}>
                    成交金額：{formatCasePdfDealAmount(row.dealAmountDisplay)}
                  </Text>
                ) : null}
                {row.involvedWorks ? (
                  <Text style={styles.works}>
                    牽涉工程：{row.involvedWorks}
                  </Text>
                ) : null}
              </View>
              {imgUrl ? (
                <View style={styles.thumbWrap}>
                  <Image src={imgUrl} style={styles.thumb} />
                </View>
              ) : null}
            </View>
          );
        })}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export default CasePdfPDFDocument;
