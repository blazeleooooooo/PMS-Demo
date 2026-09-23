/**
 * Shared monthly work-report status helpers used by /work-report-check and
 * /work-report-leaderboard (same「缺 n」rules).
 */
import { endOfMonth, format, startOfMonth } from "date-fns";
import type { HolidayInfo } from "@/hooks/use-holidays";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { toEntryDateStr } from "@/lib/data/staff";
import {
  calcManHourReportCompletion,
  getManHourDatesForStaffInRange,
  getManHourTasksByDateIds,
  type ManHourDate,
} from "@/lib/man-hour-service";

export type DayReportStatus =
  | "complete"
  | "draft"
  | "leave"
  | "rest"
  | "empty"
  | "future";

export interface MonthlyDayCell {
  dateStr: string;
  dayOfMonth: number;
  status: DayReportStatus;
  manHourDateId: string | null;
}

export interface MonthlyStaffCard {
  staffId: string;
  name: string;
  position: string | null;
  buName: string | null;
  teamName: string | null;
  /** BU id for holiday region rules (not shown in UI). */
  buId?: string | null;
  missingCount: number;
  weeks: (MonthlyDayCell | null)[][];
}

/** Mainland China cost centre — use CN public holidays for 休. */
export const MAINLAND_CHINA_BU_ID = "63f26ec3-6ece-4066-859e-7ff2b0d73f5a";

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** YYYY-MM-DD from timestamptz using browser local timezone (HK for this app). */
function extractLocalDate(timestamptz: string): string {
  const d = new Date(timestamptz);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getManHourTasksByDateIdsChunked(dateIds: string[]) {
  const CHUNK = 200;
  const all = [];
  for (let i = 0; i < dateIds.length; i += CHUNK) {
    const chunk = await getManHourTasksByDateIds(dateIds.slice(i, i + CHUNK));
    all.push(...chunk);
  }
  return all;
}

/** Monday-start calendar weeks for a given month (month is 0-indexed). */
export function buildMonthWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array.from({ length: startPad }, () => null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

/**
 * 休: Saturday, Sunday, plus region public holiday.
 * - Mainland BU → China holidays (isOffDay); CN 調休上班 overrides weekend rest.
 * - Everyone else → Hong Kong public holidays.
 */
export function isRestDay(
  dateStr: string,
  date: Date,
  holidayMap: Map<string, HolidayInfo>,
  buId?: string | null,
): boolean {
  const holiday = holidayMap.get(dateStr);
  const isMainland = buId === MAINLAND_CHINA_BU_ID;

  if (isMainland) {
    if (holiday?.cn && !holiday.cn.isOffDay) return false; // 調休上班
    if (holiday?.cn?.isOffDay) return true;
  } else if (holiday?.hk) {
    return true;
  }

  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export interface FetchMonthlyStaffCardsOptions {
  staffIds: string[];
  directory: StaffDirectoryRow[];
  monthCursor: Date;
  holidayMap: Map<string, HolidayInfo>;
  /** Defaults to today in local TZ. */
  todayStr?: string;
}

/**
 * Build monthly staff cards with「缺 n」counts — identical rules to
 * /work-report-check 月報 view.
 */
export async function fetchMonthlyStaffCards(
  opts: FetchMonthlyStaffCardsOptions,
): Promise<MonthlyStaffCard[]> {
  const { staffIds, directory, monthCursor, holidayMap } = opts;
  if (staffIds.length === 0) return [];

  const todayStr = opts.todayStr ?? toDateStr(new Date());
  const monthStartStr = toDateStr(startOfMonth(monthCursor));
  const monthEndStr = toDateStr(endOfMonth(monthCursor));

  const dates = await getManHourDatesForStaffInRange(
    staffIds,
    monthStartStr,
    monthEndStr,
  );
  const dateIds = dates.map((d) => d.id);
  const tasks = await getManHourTasksByDateIdsChunked(dateIds);

  const tasksByDateId = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByDateId.get(t.man_hour_date_id) ?? [];
    list.push(t);
    tasksByDateId.set(t.man_hour_date_id, list);
  }

  const dateByStaffAndDay = new Map<string, ManHourDate>();
  for (const d of dates) {
    if (!d.staff_id) continue;
    const day = extractLocalDate(d.report_date);
    dateByStaffAndDay.set(`${d.staff_id}|${day}`, d);
  }

  const weeks = buildMonthWeeks(monthCursor.getFullYear(), monthCursor.getMonth());
  const cards: MonthlyStaffCard[] = [];

  for (const staffId of staffIds) {
    const staff = directory.find((s) => s.id === staffId);
    const entryDateStr = toEntryDateStr(staff?.entry_date);
    let missingCount = 0;
    const cardWeeks: (MonthlyDayCell | null)[][] = weeks.map((week) =>
      week.map((date) => {
        if (!date) return null;
        const cellDateStr = toDateStr(date);
        const dateRow = dateByStaffAndDay.get(`${staffId}|${cellDateStr}`);
        const rest = isRestDay(cellDateStr, date, holidayMap, staff?.bu_id);
        const isFuture = cellDateStr > todayStr;
        const isToday = cellDateStr === todayStr;
        // Days before 入職日期 are not required — do not count as 缺.
        const isBeforeEntry = !!entryDateStr && cellDateStr < entryDateStr;
        // 缺 n excludes today and future days (today may still be in progress).
        const countsTowardMissing = !isToday && !isFuture && !isBeforeEntry;

        let status: MonthlyDayCell["status"] = "empty";
        // Report on that date always wins over 休 (weekend / public holiday).
        if (dateRow) {
          const totalHours = dateRow.total_work_hour ?? 0;
          if (totalHours === 0) {
            // 假: staff marked the day with 0 work hours (leave / off)
            status = "leave";
          } else {
            const staffTasks = tasksByDateId.get(dateRow.id) ?? [];
            const { isReportComplete } = calcManHourReportCompletion(
              totalHours,
              staffTasks,
            );
            status = isReportComplete ? "complete" : "draft";
            if (!isReportComplete && countsTowardMissing) missingCount += 1;
          }
        } else if (rest) {
          status = "rest";
        } else if (isFuture || isBeforeEntry) {
          status = "future";
        } else if (countsTowardMissing) {
          missingCount += 1;
        }

        return {
          dateStr: cellDateStr,
          dayOfMonth: date.getDate(),
          status,
          manHourDateId: dateRow?.id ?? null,
        };
      }),
    );

    cards.push({
      staffId,
      name: staff?.name ?? staffId,
      position: staff?.position ?? null,
      buName: staff?.bu_name ?? null,
      teamName: staff?.team_name ?? null,
      buId: staff?.bu_id ?? null,
      missingCount,
      weeks: cardWeeks,
    });
  }

  cards.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return cards;
}
