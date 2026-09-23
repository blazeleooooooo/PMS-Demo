import { incomeNetOutstanding, isIncomeSettledByStatus } from "@/lib/income-outstanding";
import type { ArReceiveDateIncomeRow, ArReceiveDateSource } from "@/lib/data/ar-receive-dates";

export interface CollectionEmailProjectRow {
  project_id: string;
  bw_type: ArReceiveDateSource;
  project_code: string | null;
  project_name: string | null;
  project_status: string | null;
  pm_name: string | null;
  asana_link: string | null;
  created_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  income_count: number;
  installment_label: string;
  income_amount: number;
  payment_amount: number;
  outstanding: number;
  payment_status: string | null;
  remark: string | null;
  incomes: ArReceiveDateIncomeRow[];
}

function earliestDate(values: Array<string | null>): string | null {
  let best: string | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (isNaN(ms) || ms >= bestMs) continue;
    bestMs = ms;
    best = value;
  }
  return best;
}

function uniqueJoin(values: Array<string | null>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = (value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out.length ? out.join("、") : null;
}

export function groupArIncomesByProject(
  rows: ArReceiveDateIncomeRow[]
): CollectionEmailProjectRow[] {
  const map = new Map<string, ArReceiveDateIncomeRow[]>();
  const order: string[] = [];

  for (const row of rows) {
    if (!row.project_id) continue;
    const key = `${row.bw_type}:${row.project_id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(row);
  }

  return order.map((key) => {
    const incomes = map.get(key)!;
    const first = incomes[0];
    const outstandingRows = incomes.filter((row) => incomeNetOutstanding(row) > 0);
    const dateSource = outstandingRows.length ? outstandingRows : incomes;
    const statuses = incomes.map((row) => (row.payment_status || "").trim()).filter(Boolean);
    const uniqueStatuses = [...new Set(statuses)];
    const allSettled = incomes.every(
      (row) => isIncomeSettledByStatus(row.payment_status) || incomeNetOutstanding(row) <= 0
    );
    const noneSettled = incomes.every(
      (row) => !isIncomeSettledByStatus(row.payment_status) && incomeNetOutstanding(row) > 0
    );
    const paymentStatus = allSettled
      ? uniqueStatuses[0] || "Received"
      : noneSettled
        ? uniqueStatuses[0] || "Not Received"
        : "部分已收";

    return {
      project_id: first.project_id!,
      bw_type: first.bw_type,
      project_code: first.project_code,
      project_name: first.project_name,
      project_status: first.project_status,
      pm_name: first.pm_name,
      asana_link: first.asana_link,
      created_date: earliestDate(incomes.map((row) => row.created_date)),
      due_date: earliestDate(dateSource.map((row) => row.due_date)),
      expected_payment_date: earliestDate(dateSource.map((row) => row.expected_payment_date)),
      income_count: incomes.length,
      installment_label: `${incomes.length} 筆`,
      income_amount: incomes.reduce((sum, row) => sum + (row.income_amount || 0), 0),
      payment_amount: incomes.reduce((sum, row) => sum + (row.payment_amount || 0), 0),
      outstanding: incomes.reduce((sum, row) => sum + incomeNetOutstanding(row), 0),
      payment_status: paymentStatus,
      remark: uniqueJoin(incomes.map((row) => row.remark)),
      incomes,
    };
  });
}

export const COLLECTION_FINANCE_BCC_EMAIL = "finance@example.com";
export const COLLECTION_BCC_EXCLUDED_EMAIL = "excluded@example.com";
export const COLLECTION_ALWAYS_BCC_STAFF_IDS = [
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
] as const;

export type CollectionBccSource = "finance" | "collaborator" | "always";

export interface CollectionBccPick {
  staffId: string | null;
  email: string;
  name: string | null;
  source: CollectionBccSource;
}

export function isCollectionFinanceBccEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === COLLECTION_FINANCE_BCC_EMAIL;
}

export function isCollectionBccExcludedEmail(email: string | null | undefined): boolean {
  return parseEmailList(email || "").some(
    (addr) => addr.toLowerCase() === COLLECTION_BCC_EXCLUDED_EMAIL
  );
}

function firstUsableBccEmail(
  email: string | null | undefined,
  blocked: Set<string>
): string | null {
  return (
    parseEmailList(email || "").find((addr) => !blocked.has(addr.toLowerCase())) ?? null
  );
}

export function pickDefaultCollectionBcc(input: {
  staff: Array<{ id: string; email: string | null; name?: string | null }>;
  collaborators: Array<{
    id?: string | null;
    email?: string | null;
    name?: string | null;
    status?: string | null;
  }>;
  toEmails?: Iterable<string>;
}): CollectionBccPick[] {
  const toBlocked = new Set(
    [...(input.toEmails ?? [])].map((addr) => addr.trim().toLowerCase()).filter(Boolean)
  );
  const out: CollectionBccPick[] = [];
  const seenStaffIds = new Set<string>();
  const seenOrphanEmails = new Set<string>();

  const push = (
    staffId: string | null | undefined,
    email: string | null | undefined,
    name: string | null | undefined,
    source: CollectionBccSource
  ) => {
    if (isCollectionBccExcludedEmail(email)) return;
    if (staffId && seenStaffIds.has(staffId)) return;
    const usable = firstUsableBccEmail(email, toBlocked);
    if (!usable || isCollectionBccExcludedEmail(usable)) return;
    if (!staffId) {
      const key = usable.toLowerCase();
      if (seenOrphanEmails.has(key)) return;
      seenOrphanEmails.add(key);
    } else {
      seenStaffIds.add(staffId);
    }
    out.push({
      staffId: staffId || null,
      email: usable,
      name: name || null,
      source,
    });
  };

  for (const person of input.staff) {
    if (!isCollectionFinanceBccEmail(person.email)) continue;
    push(person.id, person.email, person.name, "finance");
  }

  for (const handler of input.collaborators) {
    if (handler.status && handler.status !== "Active") continue;
    push(handler.id || null, handler.email, handler.name, "collaborator");
  }

  const staffById = new Map(input.staff.map((row) => [row.id, row]));
  for (const id of COLLECTION_ALWAYS_BCC_STAFF_IDS) {
    const person = staffById.get(id);
    if (!person) continue;
    push(person.id, person.email, person.name, "always");
  }

  return out.filter((row) => !isCollectionBccExcludedEmail(row.email));
}

export function parseEmailList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,;\n]+/)) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254 || /\s/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Returns unique valid To addresses, or null when the field is empty or any token is not an email. */
export function parseValidEmailList(value: string): string[] | null {
  const parts = value
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!isValidEmailAddress(part)) return null;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function formatEmailList(emails: string[]): string {
  return emails.join(", ");
}
