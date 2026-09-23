/** Service type UUID → schedule group label (matches Bubble / convert-project logic). */
export const SERVICE_TYPE_SCHEDULE_GROUPS: Record<string, string> = {
  "00231877-eae1-4ade-9217-77a773be6a62": "Design & Build",
  "7db39dd1-24d6-43fd-bb48-438795c39e16": "Design Only",
  "6a5b42cc-872d-436f-9bdd-a5159f0629ce": "Build Only",
};

/**
 * Compute os_schedule_group from service type + estimated income.
 * Income bands override service type (same cascading logic as pitching → project conversion).
 */
export function computeOsScheduleGroup(
  serviceTypeId: string | null | undefined,
  estimatedIncome: number | null | undefined,
): string | null {
  let result: string | null = null;
  if (serviceTypeId && SERVICE_TYPE_SCHEDULE_GROUPS[serviceTypeId]) {
    result = SERVICE_TYPE_SCHEDULE_GROUPS[serviceTypeId];
  }
  if (estimatedIncome != null) {
    if (estimatedIncome >= 40000 && estimatedIncome <= 150000) {
      result = "Small Build (<$40-150K)";
    }
    if (estimatedIncome < 30000) {
      result = "Mini Build (<$30K)";
    }
  }
  return result;
}

/**
 * Resolve the work-schedule group for display / tab visibility.
 * Uses the stored os_schedule_group when set; otherwise derives from service type + income.
 */
export function resolveOsScheduleGroup(
  serviceTypeId: string | null | undefined,
  estimatedIncome: number | null | undefined,
  storedGroup?: string | null,
): string | null {
  if (storedGroup) return storedGroup;
  return computeOsScheduleGroup(serviceTypeId, estimatedIncome);
}
