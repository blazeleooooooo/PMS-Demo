/** Effective staff.id for the current browser tab (includes impersonation). */
let actingStaffId: string | null = null;

export function setActingStaffId(staffId: string | null): void {
  actingStaffId = staffId;
}

export function getActingStaffId(): string | null {
  return actingStaffId;
}
