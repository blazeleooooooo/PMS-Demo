// Session persistence for Project / Staff / L2 filter state shared across
// /business-reports, /design-reports, /team-reports (alongside date/source
// already stored in ReportDateRangeContext).

import {
  EMPTY_PROJECT_FILTERS,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  EMPTY_STAFF_FILTERS,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import type { MoneyBasis } from "@/components/reports/MoneyBasisToggle";

const STORAGE_KEY = "pms3:report-aligned-filters";

export interface PersistedAlignedFilters {
  project: ProjectFilterState;
  staff: StaffFilterState;
  moneyBasis: MoneyBasis;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function readProject(raw: unknown): ProjectFilterState {
  if (!isRecord(raw)) return { ...EMPTY_PROJECT_FILTERS };
  return {
    search: typeof raw.search === "string" ? raw.search : "",
    status: typeof raw.status === "string" ? raw.status : "all",
    pm: "all",
    bu: typeof raw.bu === "string" ? raw.bu : "all",
    serviceType: typeof raw.serviceType === "string" ? raw.serviceType : "all",
    projectType: typeof raw.projectType === "string" ? raw.projectType : "all",
    size: typeof raw.size === "string" ? raw.size : "all",
    financialYear:
      typeof raw.financialYear === "string" ? raw.financialYear : "all",
    collectionStatus:
      raw.collectionStatus === "fully_paid" ||
      raw.collectionStatus === "incomplete"
        ? raw.collectionStatus
        : "all",
    siteStatus:
      raw.siteStatus === "started" ||
      raw.siteStatus === "started_30" ||
      raw.siteStatus === "started_60" ||
      raw.siteStatus === "started_90" ||
      raw.siteStatus === "in_progress" ||
      raw.siteStatus === "handed_over"
        ? raw.siteStatus
        : "all",
  };
}

function readStaff(raw: unknown): StaffFilterState {
  if (!isRecord(raw)) return { ...EMPTY_STAFF_FILTERS };
  return {
    status: "all",
    role: "all",
    bu: typeof raw.bu === "string" ? raw.bu : "all",
    team: typeof raw.team === "string" ? raw.team : "all",
    position: typeof raw.position === "string" ? raw.position : "all",
    staffId: typeof raw.staffId === "string" ? raw.staffId : "all",
  };
}

export function readAlignedFilters(): PersistedAlignedFilters | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      project: readProject(parsed.project),
      staff: readStaff(parsed.staff),
      moneyBasis: parsed.moneyBasis === "l3" ? "l3" : "l2",
    };
  } catch {
    return null;
  }
}

export function writeAlignedFilters(state: PersistedAlignedFilters): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
