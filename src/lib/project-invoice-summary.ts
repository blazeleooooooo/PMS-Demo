import { incomeNetOutstanding, isIncomeSettledByStatus } from "@/lib/income-outstanding";
import { formatDate, formatDateShort, formatMoney2 } from "@/lib/date-utils";

export interface ProjectInvoiceIncome {
  id: string;
  amount: number | null;
  payment_amount: number | null;
  outstanding?: number | null;
  bad_debts?: number | null;
  payment_date: string | null;
  due_date: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  issued_invoice_number?: string | null;
  n_contract_type_id: string | null;
  contract_type_name: string | null;
  type_display: string | null;
  created_date: string | null;
}

export interface ProjectInvoiceSummaryInput {
  incomes: ProjectInvoiceIncome[];
  projectCode?: string | null;
  projectName?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  pmName?: string | null;
  companyName?: string | null;
  companyChineseName?: string | null;
  logoUrl?: string | null;
}

export type InvoiceDueStatus = "overdue" | "due-soon" | "upcoming" | "paid" | "no-date";

export interface ProjectInvoiceContractGroup {
  contractTypeId: string | null;
  contractTypeName: string;
  incomes: ProjectInvoiceIncome[];
  totalAmount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getInvoiceDueStatus(income: ProjectInvoiceIncome): InvoiceDueStatus {
  const amount = income.amount || 0;
  const paid = income.payment_amount || 0;
  if (amount > 0 && paid >= amount) return "paid";
  if (incomeNetOutstanding(income) <= 0) return "paid";
  if (isIncomeSettledByStatus(income.payment_status)) return "paid";
  const days = getDaysUntil(income.due_date);
  if (days === null) return "no-date";
  if (days < 0) return "overdue";
  if (days <= 7) return "due-soon";
  return "upcoming";
}

export function getPaymentStatusLabel(income: ProjectInvoiceIncome): string {
  if (getInvoiceDueStatus(income) === "paid") {
    const payDate = income.payment_date ? formatDateShort(income.payment_date) : "";
    return payDate ? `已付 ${payDate}` : "已付";
  }
  return "未付款";
}

export function getDaysRemainingLabel(income: ProjectInvoiceIncome): string {
  if (getInvoiceDueStatus(income) === "paid") return "/";
  const days = getDaysUntil(income.due_date);
  if (days === null) return "尚餘0天";
  if (days < 0) return `逾期${Math.abs(days)}天`;
  if (days === 0) return "尚餘0天";
  return `尚餘${days}天`;
}

export function formatProjectInvoiceRowHash(income: {
  contract_type_name?: string | null;
  type_display?: string | null;
  invoice_number?: string | null;
}): string {
  const typeName = income.contract_type_name || income.type_display || "未分類";
  const installment = income.invoice_number?.trim();
  return `${typeName} #${installment || "/"}`;
}

export function formatIssuedInvoiceNumber(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "/";
}

export function attachIssuedInvoiceNumbers<T extends { id: string }>(
  incomes: T[],
  issuedByIncomeId: Record<string, string | null>
): Array<T & { issued_invoice_number: string | null }> {
  return incomes.map((income) => ({
    ...income,
    issued_invoice_number: issuedByIncomeId[income.id] ?? null,
  }));
}

export function groupProjectInvoiceIncomes(
  incomes: ProjectInvoiceIncome[]
): ProjectInvoiceContractGroup[] {
  const UNCATEGORIZED = "__uncategorized__";
  const map = new Map<string, ProjectInvoiceContractGroup>();
  const order: string[] = [];
  const valid = incomes.filter((i) => (i.amount || 0) > 0 || (i.payment_amount || 0) > 0);

  for (const inc of valid) {
    const key = inc.n_contract_type_id || UNCATEGORIZED;
    if (!map.has(key)) {
      map.set(key, {
        contractTypeId: inc.n_contract_type_id,
        contractTypeName: inc.contract_type_name || inc.type_display || "未分類",
        incomes: [],
        totalAmount: 0,
      });
      order.push(key);
    }
    const group = map.get(key)!;
    group.incomes.push(inc);
    group.totalAmount += inc.amount || 0;
  }

  return order.map((key) => map.get(key)!);
}

function money(value: number | null | undefined): string {
  return escapeHtml(formatMoney2(value));
}

function dateCell(value: string | null): string {
  return value ? escapeHtml(formatDate(value)) : "";
}

function th(label: string): string {
  return `<th style="padding:4px 8px;text-align:center;font-weight:600;color:#ffffff;background:#1f2937;font-size:13px;">${escapeHtml(label)}</th>`;
}

function buildIncomeRows(incomes: ProjectInvoiceIncome[]): string {
  return incomes
    .map((income, idx) => {
      const paid = getInvoiceDueStatus(income) === "paid";
      const bg = idx % 2 === 1 ? "background:#f9fafb;" : "";
      return `<tr>
        <td style="padding:8px;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(formatProjectInvoiceRowHash(income))}</td>
        <td style="padding:8px;text-align:right;font-family:ui-monospace,monospace;color:#1f2937;border-bottom:1px solid #f3f4f6;${bg}">${money(income.amount)}</td>
        <td style="padding:8px;text-align:center;font-family:ui-monospace,monospace;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(formatIssuedInvoiceNumber(income.issued_invoice_number))}</td>
        <td style="padding:8px;text-align:center;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${dateCell(income.created_date)}</td>
        <td style="padding:8px;text-align:center;color:#6b7280;border-bottom:1px solid #f3f4f6;${bg}">N/A</td>
        <td style="padding:8px;text-align:center;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${dateCell(income.due_date)}</td>
        <td style="padding:8px;text-align:center;font-weight:500;border-bottom:1px solid #f3f4f6;${bg}${paid ? "color:#047857;" : "color:#dc2626;"}">${escapeHtml(getPaymentStatusLabel(income))}</td>
        <td style="padding:8px;text-align:center;color:#6b7280;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(getDaysRemainingLabel(income))}</td>
      </tr>`;
    })
    .join("");
}

export function buildProjectInvoiceSummaryHtml(input: ProjectInvoiceSummaryInput): string {
  const companyName = input.companyName || "Acme Design Limited";
  const companyChineseName = input.companyChineseName || "Acme 設計有限公司";
  const groups = groupProjectInvoiceIncomes(input.incomes);
  const validIncomes = input.incomes.filter((i) => (i.amount || 0) > 0 || (i.payment_amount || 0) > 0);
  const unpaidIncomes = validIncomes.filter((i) => getInvoiceDueStatus(i) !== "paid");
  const unpaidTotal = unpaidIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const logo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="Company Logo" style="height:40px;width:auto;object-fit:contain;margin-bottom:8px;display:block;" />`
    : "";

  const groupBlocks = groups
    .map((group, gIdx) => {
      const sorted = [...group.incomes].sort((a, b) => (b.amount || 0) - (a.amount || 0));
      return `<div style="margin-top:${gIdx > 0 ? "24px" : "0"};">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="font-size:16px;font-weight:800;color:#111827;">${escapeHtml(group.contractTypeName)}</td>
            <td style="text-align:right;font-size:14px;color:#6b7280;">總額 <span style="font-weight:700;font-family:ui-monospace,monospace;color:#1f2937;font-size:16px;">${money(group.totalAmount)}</span></td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              ${th("#")}
              ${th("金額")}
              ${th("發票號碼")}
              ${th("發票日期")}
              ${th("支票號碼")}
              ${th("到期日")}
              ${th("付款狀態")}
              ${th("客人跟進")}
            </tr>
          </thead>
          <tbody>${buildIncomeRows(sorted)}</tbody>
        </table>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #d1d5db;font-size:13px;color:#6b7280;">
          總額 <span style="font-weight:700;font-family:ui-monospace,monospace;color:#111827;font-size:15px;margin-left:8px;">${money(group.totalAmount)}</span>
        </div>
      </div>`;
    })
    .join("");

  const unpaidRows = unpaidIncomes
    .map((income, idx) => {
      const bg = idx % 2 === 1 ? "background:#f9fafb;" : "";
      return `<tr>
        <td style="padding:8px;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(formatProjectInvoiceRowHash(income))}</td>
        <td style="padding:8px;text-align:right;font-family:ui-monospace,monospace;color:#1f2937;border-bottom:1px solid #f3f4f6;${bg}">${money(income.amount)}</td>
        <td style="padding:8px;text-align:center;font-family:ui-monospace,monospace;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(formatIssuedInvoiceNumber(income.issued_invoice_number))}</td>
        <td style="padding:8px;text-align:center;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${dateCell(income.created_date)}</td>
        <td style="padding:8px;text-align:center;color:#4b5563;border-bottom:1px solid #f3f4f6;${bg}">${dateCell(income.due_date)}</td>
        <td style="padding:8px;text-align:center;font-weight:500;color:#dc2626;border-bottom:1px solid #f3f4f6;${bg}">未付款</td>
        <td style="padding:8px;text-align:center;color:#6b7280;border-bottom:1px solid #f3f4f6;${bg}">${escapeHtml(getDaysRemainingLabel(income))}</td>
      </tr>`;
    })
    .join("");

  const unpaidBlock =
    unpaidIncomes.length > 0
      ? `<div style="margin-top:32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td style="font-size:16px;font-weight:800;color:#111827;">Summary - 應付未付</td>
            <td style="text-align:right;font-size:14px;color:#6b7280;">總額 <span style="font-weight:700;font-family:ui-monospace,monospace;color:#1f2937;font-size:16px;">${money(unpaidTotal)}</span></td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              ${th("#")}
              ${th("金額")}
              ${th("發票號碼")}
              ${th("發票日期")}
              ${th("到期日")}
              ${th("付款狀態")}
              ${th("客人跟進")}
            </tr>
          </thead>
          <tbody>${unpaidRows}</tbody>
        </table>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #d1d5db;font-size:13px;color:#6b7280;">
          總額 <span style="font-weight:700;font-family:ui-monospace,monospace;color:#111827;font-size:15px;margin-left:8px;">${money(unpaidTotal)}</span>
        </div>
      </div>`
      : "";

  const address = input.customerAddress
    ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml(input.customerAddress)}</div>`
    : "";

  return `<div style="background:#ffffff;color:#111827;font-family:'Segoe UI',Arial,sans-serif;max-width:850px;margin:0 auto;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:24px;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          ${logo}
          <div style="font-size:15px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(companyName)}</div>
          <div style="font-size:15px;color:#374151;line-height:1.4;">${escapeHtml(companyChineseName)}</div>
          <div style="margin-top:8px;font-size:13px;color:#4b5563;">
            <div style="font-weight:500;">Bill To:</div>
            <div>${escapeHtml(input.customerName || "-")}</div>
            ${address}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-size:24px;font-weight:900;letter-spacing:0.08em;color:#111827;">工程對數表</div>
          <div style="font-size:13px;color:#6b7280;">Project Invoice &amp; Payment Summary</div>
          <table cellpadding="0" cellspacing="0" style="margin-top:12px;margin-left:auto;font-size:13px;">
            <tr>
              <td style="color:#6b7280;padding:2px 8px 2px 0;text-align:right;">Project Manager:</td>
              <td style="font-weight:500;color:#1f2937;text-align:right;">${escapeHtml(input.pmName || "-")}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:2px 8px 2px 0;text-align:right;">Project Code:</td>
              <td style="font-weight:500;color:#1f2937;text-align:right;">${escapeHtml(input.projectCode || "-")}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:2px 8px 2px 0;text-align:right;">Project Name:</td>
              <td style="font-weight:500;color:#1f2937;text-align:right;max-width:180px;">${escapeHtml(input.projectName || "-")}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${groupBlocks}
    ${unpaidBlock}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      <tr>
        <td>www.bwdesign.asia | (+852) 2127 4915</td>
        <td style="text-align:right;">第1頁 | 共1頁</td>
      </tr>
    </table>
  </div>`;
}

export function buildProjectInvoiceSummaryText(input: ProjectInvoiceSummaryInput): string {
  const unpaid = input.incomes.filter((i) => getInvoiceDueStatus(i) !== "paid");
  const lines = [
    `工程對數表 — ${input.projectCode || "-"} ${input.projectName || ""}`.trim(),
    `Bill To: ${input.customerName || "-"}`,
    `Project Manager: ${input.pmName || "-"}`,
    "",
    "應付未付：",
    ...unpaid.map((income) => {
      return `- ${formatProjectInvoiceRowHash(income)} ${formatMoney2(income.amount)} 發票 ${formatIssuedInvoiceNumber(income.issued_invoice_number)} 到期 ${income.due_date ? formatDate(income.due_date) : "-"} ${getDaysRemainingLabel(income)}`;
    }),
  ];
  if (unpaid.length === 0) lines.push("- 沒有未付款項");
  return lines.join("\n");
}

export function greetingToHtml(body: string): string {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line)).join("<br />");
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1f2937;">${lines}</p>`;
    })
    .join("");
}

export function buildCollectionEmailHtml(
  body: string,
  summaryHtml: string,
  signature = ""
): string {
  const greeting = greetingToHtml(body);
  const signOff = greetingToHtml(signature);
  return `<div style="background:#f3f4f6;padding:16px 0;">
    <div style="max-width:850px;margin:0 auto;padding:0 16px 16px;">${greeting}</div>
    ${summaryHtml}
    <div style="max-width:850px;margin:0 auto;padding:16px 16px 0;">${signOff}</div>
  </div>`;
}

export type CollectionEmailMode = "progress" | "overdue";

export const COLLECTION_EMAIL_COMPANY_PHONE = "2127 4915";
export const COLLECTION_EMAIL_DEADLINE_WORKING_DAYS = 3;

export const COLLECTION_EMAIL_MODES: Array<{
  value: CollectionEmailMode;
  label: string;
  description: string;
}> = [
  {
    value: "progress",
    label: "按工程進度收款",
    description: "情景：按工程進度收款（提醒性質，語氣平和）",
  },
  {
    value: "overdue",
    label: "完工後逾期未付清尾數",
    description: "情景：完工後逾期未付清尾數（催款性質，語氣強硬）",
  },
];

export interface CollectionEmailCopyInput {
  projectName?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  incomes?: ProjectInvoiceIncome[];
  handoverDate?: string | null;
  contactPhone?: string | null;
  deadlineDays?: number;
  asOf?: Date | string;
}

export interface CollectionEmailCopy {
  subject: string;
  body: string;
  signature: string;
}

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function toChineseNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const value = Math.floor(n);
  if (value <= 10) return CN_DIGITS[value];
  if (value < 20) return `十${CN_DIGITS[value - 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${CN_DIGITS[tens]}十${ones === 0 ? "" : CN_DIGITS[ones]}`;
  }
  return String(value);
}

function hongKongTodayParts(asOf?: Date | string): { y: number; m: number; d: number } {
  if (typeof asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    const [y, m, d] = asOf.split("-").map(Number);
    return { y, m, d };
  }
  const date = asOf instanceof Date ? asOf : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function addHongKongWorkingDays(
  days: number,
  asOf?: Date | string
): string {
  const start = hongKongTodayParts(asOf);
  const date = new Date(start.y, start.m - 1, start.d);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function formatCollectionAmount(value: number | null | undefined): string {
  return formatMoney2(value, { prefix: "", fallback: "-" });
}

export function resolveCollectionInvoiceFacts(incomes: ProjectInvoiceIncome[] = []) {
  const valid = incomes.filter((income) => (income.amount || 0) > 0 || (income.payment_amount || 0) > 0);
  const sorted = [...valid].sort((a, b) => {
    const aDate = a.created_date || "";
    const bDate = b.created_date || "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.id.localeCompare(b.id);
  });
  const unpaid = sorted.filter((income) => getInvoiceDueStatus(income) !== "paid");
  const targets = unpaid.length > 0 ? unpaid : sorted.slice(-1);
  const installmentNos = targets.map((income) => {
    const idx = sorted.findIndex((row) => row.id === income.id);
    return idx >= 0 ? idx + 1 : 1;
  });
  const uniqueInstallments = [...new Set(installmentNos.length ? installmentNos : [1])];
  const amount = unpaid.reduce((sum, income) => sum + incomeNetOutstanding(income), 0);
  const invoiceNumbers = unpaid
    .map((income) => income.issued_invoice_number?.trim())
    .filter((value): value is string => !!value);

  return {
    installmentNo: uniqueInstallments.join("、"),
    progressStage: uniqueInstallments.map((n) => `第${toChineseNumeral(n)}期完成`).join("、"),
    amountLabel: unpaid.length > 0 ? formatCollectionAmount(amount) : "-",
    invoiceNumbers: invoiceNumbers.length > 0 ? invoiceNumbers.join("、") : "-",
  };
}

export function buildCollectionEmailCopy(
  mode: CollectionEmailMode,
  input: CollectionEmailCopyInput
): CollectionEmailCopy {
  const projectName = displayOrDash(input.projectName);
  const customerName = displayOrDash(input.customerName || "客戶");
  const companyName = displayOrDash(input.companyName || "Acme 設計有限公司");
  const phone = displayOrDash(input.contactPhone || COLLECTION_EMAIL_COMPANY_PHONE);
  const facts = resolveCollectionInvoiceFacts(input.incomes);
  const handoverDate = input.handoverDate ? formatDate(input.handoverDate) : "-";
  const deadlineDays = input.deadlineDays ?? COLLECTION_EMAIL_DEADLINE_WORKING_DAYS;
  const deadline = addHongKongWorkingDays(deadlineDays, input.asOf);

  if (mode === "overdue") {
    return {
      subject: `【重要催繳通知】${projectName} - 尾數款項逾期未付警告`,
      body: `${customerName} 台照：

本公司曾多次就 ${projectName} 之工程尾數（發票號碼：${facts.invoiceNumbers}，金額：港幣 ${facts.amountLabel} 元）向 貴司發出付款通知。該項工程已於 ${handoverDate} 順利完工並交付，惟至今仍未收到相關款項，已嚴重逾期。

請 貴司於收到此信後 ${deadlineDays} 個工作天內（即 ${deadline} 前）全數結清上述款項。若逾期仍未收到款項，本公司將不得不採取法律行動或交由收數公司處理，屆時衍生之額外費用及法律責任將由 貴司承擔。

如對賬目有任何疑問，請致電 ${phone} 與項目經理查詢。`,
      signature: `${companyName} 會計部 啟`,
    };
  }

  return {
    subject: `【付款提醒】${projectName} - 第 ${facts.installmentNo} 期工程進度款項通知`,
    body: `尊貴的 ${customerName}：

您好！感謝 貴司一直以來對本公司的信任與支持。

關於 ${projectName}，目前工程已順利推進至 ${facts.progressStage}。根據合約條款，現需向 貴司收取第 ${facts.installmentNo} 期工程款項，金額為港幣 ${facts.amountLabel} 元。隨信附上相關發票（Invoice No.: ${facts.invoiceNumbers}），敬請安排付款。

如對工程進度或賬單內容有任何疑問，請致電 ${phone} 與項目經理查詢。

祝 業務蒸蒸日上！`,
    signature: `${companyName} 會計部 謹啟`,
  };
}

export function defaultCollectionEmailSubject(
  projectCode: string | null | undefined,
  projectName: string | null | undefined
): string {
  return buildCollectionEmailCopy("progress", {
    projectName: projectName || projectCode,
  }).subject;
}

export function defaultCollectionEmailBody(input: {
  projectCode?: string | null;
  projectName?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  incomes?: ProjectInvoiceIncome[];
  handoverDate?: string | null;
  contactPhone?: string | null;
}): string {
  return buildCollectionEmailCopy("progress", {
    projectName: input.projectName || input.projectCode,
    customerName: input.customerName,
    companyName: input.companyName,
    incomes: input.incomes,
    handoverDate: input.handoverDate,
    contactPhone: input.contactPhone,
  }).body;
}

export function defaultCollectionEmailSignature(input: {
  companyName?: string | null;
} = {}): string {
  return buildCollectionEmailCopy("progress", {
    companyName: input.companyName,
  }).signature;
}
