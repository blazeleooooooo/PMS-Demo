import { fetchAllRows, mapBatchesParallel, safeQuery, supabase } from "@/lib/data/_core";
import { todayHkYmd, toHkYmd } from "@/lib/date-utils";
import { incomeNetOutstanding } from "@/lib/income-outstanding";
import { countsForMoney } from "@/lib/project-status-rules";

export type ExpectedPaymentSource = "BWA" | "BWF";
export type ExpectedPaymentKind = "income" | "expense";
export type ExpectedPaymentBucketMode = "horizon" | "days30" | "month";
export type ExpectedPaymentDateBasis = "mixed" | "due_date" | "expected_payment_date";

export interface ExpectedPaymentLine {
  id: string;
  source: ExpectedPaymentSource;
  kind: ExpectedPaymentKind;
  projectId: string;
  amount: number;
  counterpart: number;
  outstanding: number;
  dueDate: string | null;
  expectedPaymentDate: string | null;
  effectiveDate: string;
}

export interface ExpectedPaymentProject {
  id: string;
  source: ExpectedPaymentSource;
  project_name: string | null;
  project_code: string | null;
  status: string | null;
  main_pm_id: string | null;
  pm_name: string | null;
  /** BWA `project_size`; BWF `os_size`. */
  project_size: string | null;
}

export type ExpectedPaymentInspectGroupBy = "none" | "staff" | "project_size" | "status";

export interface ExpectedPaymentInspectBucket {
  key: string;
  label: string;
  rows: ExpectedPaymentProjectGroup[];
  incomeOutstanding: number;
  expenseOutstanding: number;
  gpOutstanding: number;
}

export interface ExpectedPaymentProjectGroup {
  project: ExpectedPaymentProject;
  incomeOutstanding: number;
  expenseOutstanding: number;
  gpOutstanding: number;
}

export interface ExpectedPaymentBundle {
  lines: ExpectedPaymentLine[];
  projects: Record<string, ExpectedPaymentProject>;
}

export interface ExpectedPaymentColumn {
  key: string;
  label: string;
  minDays?: number;
  maxDays?: number;
  year?: number;
  month?: number;
}

export interface ExpectedPaymentCell {
  amount: number;
  counterpart: number;
}

export type ExpectedPaymentMatrix = Record<
  ExpectedPaymentSource,
  Record<ExpectedPaymentKind, Record<string, ExpectedPaymentCell>>
>;

const LINE_COLUMNS =
  "id, project_id, bwf_project_id, expected_payment_date, due_date";

export { todayHkYmd };

export function dateForBasis(
  expectedPaymentDate: string | null | undefined,
  dueDate: string | null | undefined,
  basis: ExpectedPaymentDateBasis = "mixed"
): string | null {
  if (basis === "due_date") return toHkYmd(dueDate);
  if (basis === "expected_payment_date") return toHkYmd(expectedPaymentDate);
  return toHkYmd(expectedPaymentDate) || toHkYmd(dueDate);
}

/** Mixed basis: expected_payment_date, falling back to due_date. */
export function effectivePaymentDate(
  expectedPaymentDate: string | null | undefined,
  dueDate: string | null | undefined
): string | null {
  return dateForBasis(expectedPaymentDate, dueDate, "mixed");
}

export function applyDateBasis(
  lines: ExpectedPaymentLine[],
  basis: ExpectedPaymentDateBasis
): ExpectedPaymentLine[] {
  const next: ExpectedPaymentLine[] = [];
  for (const line of lines) {
    const date = dateForBasis(line.expectedPaymentDate, line.dueDate, basis);
    if (!date) continue;
    next.push({ ...line, effectiveDate: date });
  }
  return next;
}

function sourceFromRow(row: {
  project_id?: string | null;
  bwf_project_id?: string | null;
}): ExpectedPaymentSource | null {
  if (row.project_id) return "BWA";
  if (row.bwf_project_id) return "BWF";
  return null;
}

function daysFromToday(ymd: string, todayYmd: string): number {
  const [y1, m1, d1] = todayYmd.split("-").map(Number);
  const [y2, m2, d2] = ymd.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000);
}

export function buildExpectedPaymentColumns(
  mode: ExpectedPaymentBucketMode,
  todayYmd: string
): ExpectedPaymentColumn[] {
  if (mode === "horizon") {
    return [
      { key: "d1_7", label: "1-7 Days", minDays: 0, maxDays: 7 },
      { key: "d7_14", label: "7-14 Days", minDays: 8, maxDays: 14 },
      { key: "d15_21", label: "15-21 Days", minDays: 15, maxDays: 21 },
      { key: "d21_30", label: "21-30 Days", minDays: 22, maxDays: 30 },
      { key: "d30_45", label: "30-45 Days", minDays: 31, maxDays: 45 },
      { key: "d45_59", label: "45-59 Days", minDays: 46, maxDays: 59 },
      { key: "d60", label: ">60 Days", minDays: 60, maxDays: 119 },
      { key: "d120", label: ">120 Days", minDays: 120, maxDays: 359 },
      { key: "d360", label: ">360 Days", minDays: 360 },
    ];
  }

  if (mode === "days30") {
    return Array.from({ length: 12 }, (_, i) => {
      const minDays = i === 0 ? 0 : i * 30 + 1;
      const maxDays = (i + 1) * 30;
      return {
        key: `p${minDays}_${maxDays}`,
        label: `${minDays}-${maxDays}天`,
        minDays,
        maxDays,
      };
    });
  }

  const year = Number(todayYmd.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => ({
    key: `m${year}-${String(i + 1).padStart(2, "0")}`,
    label: `${year}年${i + 1}月`,
    year,
    month: i + 1,
  }));
}

export function columnKeyForDate(
  ymd: string,
  todayYmd: string,
  columns: ExpectedPaymentColumn[],
  mode: ExpectedPaymentBucketMode
): string | null {
  if (mode === "month") {
    const [year, month] = ymd.split("-").map(Number);
    return columns.find((col) => col.year === year && col.month === month)?.key ?? null;
  }

  const days = daysFromToday(ymd, todayYmd);
  const match = columns.find((col) => {
    if (col.minDays == null) return false;
    if (days < col.minDays) return false;
    if (col.maxDays == null) return true;
    return days <= col.maxDays;
  });
  return match?.key ?? null;
}

function emptyCell(): ExpectedPaymentCell {
  return { amount: 0, counterpart: 0 };
}

export function emptyExpectedPaymentMatrix(
  columns: ExpectedPaymentColumn[]
): ExpectedPaymentMatrix {
  const makeKind = () =>
    Object.fromEntries(columns.map((col) => [col.key, emptyCell()])) as Record<
      string,
      ExpectedPaymentCell
    >;
  return {
    BWA: { income: makeKind(), expense: makeKind() },
    BWF: { income: makeKind(), expense: makeKind() },
  };
}

export function aggregateExpectedPayments(
  lines: ExpectedPaymentLine[],
  columns: ExpectedPaymentColumn[],
  mode: ExpectedPaymentBucketMode,
  todayYmd: string
): ExpectedPaymentMatrix {
  const matrix = emptyExpectedPaymentMatrix(columns);
  for (const line of lines) {
    const key = columnKeyForDate(line.effectiveDate, todayYmd, columns, mode);
    if (!key) continue;
    const cell = matrix[line.source][line.kind][key];
    if (!cell) continue;
    cell.amount += line.amount;
    cell.counterpart += line.counterpart;
  }
  return matrix;
}

export function lineMatchesColumn(
  line: ExpectedPaymentLine,
  columnKey: string | "total",
  columns: ExpectedPaymentColumn[],
  mode: ExpectedPaymentBucketMode,
  todayYmd: string
): boolean {
  const key = columnKeyForDate(line.effectiveDate, todayYmd, columns, mode);
  if (!key) return false;
  if (columnKey === "total") return true;
  return key === columnKey;
}

export function groupExpectedPaymentsByProject(
  lines: ExpectedPaymentLine[],
  projects: Record<string, ExpectedPaymentProject>,
  source: ExpectedPaymentSource,
  columnKey: string | "total",
  columns: ExpectedPaymentColumn[],
  mode: ExpectedPaymentBucketMode,
  todayYmd: string
): ExpectedPaymentProjectGroup[] {
  const grouped = new Map<string, ExpectedPaymentProjectGroup>();

  for (const line of lines) {
    if (line.source !== source) continue;
    if (!lineMatchesColumn(line, columnKey, columns, mode, todayYmd)) continue;

    const existing = grouped.get(line.projectId);
    const project =
      existing?.project ??
      projects[line.projectId] ?? {
        id: line.projectId,
        source,
        project_name: null,
        project_code: null,
        status: null,
        main_pm_id: null,
        pm_name: null,
        project_size: null,
      };
    const next = existing ?? {
      project,
      incomeOutstanding: 0,
      expenseOutstanding: 0,
      gpOutstanding: 0,
    };
    if (line.kind === "income") next.incomeOutstanding += line.outstanding;
    else next.expenseOutstanding += line.outstanding;
    next.gpOutstanding = next.incomeOutstanding - next.expenseOutstanding;
    grouped.set(line.projectId, next);
  }

  return [...grouped.values()].sort((a, b) => {
    const incomeDiff = b.incomeOutstanding - a.incomeOutstanding;
    if (incomeDiff !== 0) return incomeDiff;
    return (a.project.project_code || "").localeCompare(b.project.project_code || "");
  });
}

const UNSET_GROUP_LABEL = "未設定";

function inspectGroupIdentity(
  row: ExpectedPaymentProjectGroup,
  groupBy: Exclude<ExpectedPaymentInspectGroupBy, "none">
): { key: string; label: string } {
  if (groupBy === "staff") {
    const id = row.project.main_pm_id?.trim();
    if (!id) return { key: "unset", label: UNSET_GROUP_LABEL };
    return { key: id, label: row.project.pm_name?.trim() || "未命名" };
  }
  if (groupBy === "project_size") {
    const size = row.project.project_size?.trim();
    return { key: size || "unset", label: size || UNSET_GROUP_LABEL };
  }
  const status = row.project.status?.trim();
  return { key: status || "unset", label: status || UNSET_GROUP_LABEL };
}

function sumProjectGroups(rows: ExpectedPaymentProjectGroup[]): {
  incomeOutstanding: number;
  expenseOutstanding: number;
  gpOutstanding: number;
} {
  return rows.reduce(
    (acc, row) => ({
      incomeOutstanding: acc.incomeOutstanding + row.incomeOutstanding,
      expenseOutstanding: acc.expenseOutstanding + row.expenseOutstanding,
      gpOutstanding: acc.gpOutstanding + row.gpOutstanding,
    }),
    { incomeOutstanding: 0, expenseOutstanding: 0, gpOutstanding: 0 }
  );
}

export function groupInspectProjects(
  rows: ExpectedPaymentProjectGroup[],
  groupBy: ExpectedPaymentInspectGroupBy
): ExpectedPaymentInspectBucket[] {
  if (groupBy === "none") {
    return [
      {
        key: "all",
        label: "全部",
        rows,
        ...sumProjectGroups(rows),
      },
    ];
  }

  const buckets = new Map<string, ExpectedPaymentInspectBucket>();
  for (const row of rows) {
    const { key, label } = inspectGroupIdentity(row, groupBy);
    const existing = buckets.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.incomeOutstanding += row.incomeOutstanding;
      existing.expenseOutstanding += row.expenseOutstanding;
      existing.gpOutstanding += row.gpOutstanding;
    } else {
      buckets.set(key, {
        key,
        label,
        rows: [row],
        incomeOutstanding: row.incomeOutstanding,
        expenseOutstanding: row.expenseOutstanding,
        gpOutstanding: row.gpOutstanding,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => {
    const incomeDiff = b.incomeOutstanding - a.incomeOutstanding;
    if (incomeDiff !== 0) return incomeDiff;
    return a.label.localeCompare(b.label, "zh-Hant");
  });
}

function mapIncomeRow(row: {
  id: string;
  project_id?: string | null;
  bwf_project_id?: string | null;
  expected_payment_date?: string | null;
  due_date?: string | null;
  income_amount?: number | null;
  payment_amount?: number | null;
  outstanding?: number | null;
  bad_debts?: number | null;
}): ExpectedPaymentLine | null {
  const source = sourceFromRow(row);
  const expectedPaymentDate = toHkYmd(row.expected_payment_date);
  const dueDate = toHkYmd(row.due_date);
  const effectiveDate = dateForBasis(expectedPaymentDate, dueDate, "mixed");
  const projectId = row.project_id || row.bwf_project_id;
  if (!source || !effectiveDate || !projectId) return null;
  return {
    id: row.id,
    source,
    kind: "income",
    projectId,
    amount: Number(row.income_amount) || 0,
    counterpart: Number(row.payment_amount) || 0,
    outstanding: incomeNetOutstanding(row),
    dueDate,
    expectedPaymentDate,
    effectiveDate,
  };
}

function mapExpenseRow(row: {
  id: string;
  project_id?: string | null;
  bwf_project_id?: string | null;
  expected_payment_date?: string | null;
  due_date?: string | null;
  installment_amount?: number | null;
  paid_amount?: number | null;
  outstanding?: number | null;
}): ExpectedPaymentLine | null {
  const source = sourceFromRow(row);
  const expectedPaymentDate = toHkYmd(row.expected_payment_date);
  const dueDate = toHkYmd(row.due_date);
  const effectiveDate = dateForBasis(expectedPaymentDate, dueDate, "mixed");
  const projectId = row.project_id || row.bwf_project_id;
  if (!source || !effectiveDate || !projectId) return null;
  const installment = Number(row.installment_amount) || 0;
  const paid = Number(row.paid_amount) || 0;
  const outstanding =
    row.outstanding != null ? Number(row.outstanding) || 0 : Math.max(0, installment - paid);
  return {
    id: row.id,
    source,
    kind: "expense",
    projectId,
    amount: installment,
    counterpart: paid,
    outstanding,
    dueDate,
    expectedPaymentDate,
    effectiveDate,
  };
}

async function fetchProjectsByIds(
  table: "bwa_projects" | "bwf_projects",
  source: ExpectedPaymentSource,
  ids: string[]
): Promise<ExpectedPaymentProject[]> {
  if (ids.length === 0) return [];
  const sizeColumn = table === "bwf_projects" ? "os_size" : "project_size";
  const rows = await mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase
      .from(table)
      .select(`id, project_name, project_code, status, main_pm_id, ${sizeColumn}`)
      .in("id", batch);
    if (error) return [];
    return data ?? [];
  });

  const pmIds = [...new Set(rows.map((row: any) => row.main_pm_id).filter(Boolean))];
  const staffRows = await mapBatchesParallel(pmIds, 200, 4, async (batch) => {
    const { data, error } = await supabase.from("staff").select("id, name").in("id", batch);
    if (error) return [];
    return data ?? [];
  });
  const pmNames = new Map(staffRows.map((row: any) => [row.id, row.name || null]));

  return rows.map((row: any) => ({
    id: row.id,
    source,
    project_name: row.project_name || null,
    project_code: row.project_code || null,
    status: row.status || null,
    main_pm_id: row.main_pm_id || null,
    pm_name: row.main_pm_id ? pmNames.get(row.main_pm_id) || null : null,
    project_size:
      (table === "bwf_projects" ? row.os_size : row.project_size) || null,
  }));
}

export async function fetchExpectedPaymentLines(): Promise<ExpectedPaymentBundle> {
  return safeQuery(async () => {
    const applyLinked = (q: any) =>
      q.or("project_id.not.is.null,bwf_project_id.not.is.null");

    const [incomesRes, expensesRes] = await Promise.all([
      fetchAllRows(
        "incomes",
        `${LINE_COLUMNS}, income_amount, payment_amount, outstanding, bad_debts`,
        applyLinked
      ),
      fetchAllRows(
        "expenses",
        `${LINE_COLUMNS}, installment_amount, paid_amount, outstanding`,
        applyLinked
      ),
    ]);

    const lines: ExpectedPaymentLine[] = [];
    for (const row of incomesRes.data ?? []) {
      const mapped = mapIncomeRow(row);
      if (mapped) lines.push(mapped);
    }
    for (const row of expensesRes.data ?? []) {
      const mapped = mapExpenseRow(row);
      if (mapped) lines.push(mapped);
    }

    const bwaIds = [...new Set(lines.filter((l) => l.source === "BWA").map((l) => l.projectId))];
    const bwfIds = [...new Set(lines.filter((l) => l.source === "BWF").map((l) => l.projectId))];
    const [bwaProjects, bwfProjects] = await Promise.all([
      fetchProjectsByIds("bwa_projects", "BWA", bwaIds),
      fetchProjectsByIds("bwf_projects", "BWF", bwfIds),
    ]);

    const projects: Record<string, ExpectedPaymentProject> = {};
    for (const project of [...bwaProjects, ...bwfProjects]) {
      projects[project.id] = project;
    }

    return filterExpectedPaymentsForMoney(lines, projects);
  }, { lines: [], projects: {} }, "fetchExpectedPaymentLines");
}

/** Drop Case Closed / Internal Project (不計錢) from the page and inspect popup. */
export function filterExpectedPaymentsForMoney(
  lines: ExpectedPaymentLine[],
  projects: Record<string, ExpectedPaymentProject>
): ExpectedPaymentBundle {
  const keptProjects: Record<string, ExpectedPaymentProject> = {};
  for (const [id, project] of Object.entries(projects)) {
    if (countsForMoney(project.status)) keptProjects[id] = project;
  }
  return {
    lines: lines.filter((line) => {
      const project = projects[line.projectId];
      if (!project) return true;
      return countsForMoney(project.status);
    }),
    projects: keptProjects,
  };
}
