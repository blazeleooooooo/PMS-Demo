import { supabase, adminFetch, logError, safeQuery } from "@/lib/data/_core";
import { isTeamOrAssignedScope } from "@/lib/staff-data-scope";

// ─── STAFF ──────────────────────────────────────────────

export interface StaffMember {
  id: string;
  name: string;
  position: string | null;
  avatar_url: string | null;
}

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  return safeQuery(async () => {
    // Paginate — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("staff")
        .select("id, name, role, image, status")
        .order("name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchStaffMembers", error);
        break;
      }
      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Filter: active or no status set
    const filtered = allData.filter((s) => {
      if (!s.status) return true;
      return s.status.toLowerCase() === "active";
    });

    // If zero after filtering, return all (Bubble might not have "Active" status values)
    const result = filtered.length > 0 ? filtered : allData;

    return result.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.role,
      avatar_url: s.image || null,
    }));
  }, [], "fetchStaffMembers");
}

// ─── STAFF MANAGEMENT (角色管理 Page) ─────────────────────

export interface StaffManagementRow {
  id: string;
  bubble_id: string | null;
  // `name` is the primary display name (the 姓名 field). `full_name` is the
  // optional longer/legal name. Both are carried raw so the edit form can
  // populate each field independently.
  name: string;
  full_name: string | null;
  email: string | null;
  // `bu` is the resolved cost-centre display (for the table). `bu_id` is the
  // raw FK (staff.bu_id → cost_centres.id) the edit form selects.
  bu: string | null;
  bu_id: string | null;
  // `n_team_type` is the resolved team display (for the table); `n_team_type_id`
  // is the raw FK (staff.n_team_type_id → team_types.id) the edit form selects.
  n_team_type: string | null;
  n_team_type_id: string | null;
  position: string | null;
  role: string | null;
  status: string | null;
  dual_system: boolean | null;
  entry_date: string | null;
  image: string | null;
  private_phone: string | null;
  work_phone: string | null;
  // Used when generating quotation / pitching / project codes for this staff member.
  quote_initial: string | null;
  // Joined from users table
  user_type: string | null;
  view_system: string | null;
}

export async function fetchStaffForManagement(): Promise<StaffManagementRow[]> {
  return safeQuery(async () => {
    // Step 7: Use FK joins for team_type (n_team_type_id → team_types) and
    // fetch users with member_id FK join to staff
    const staffSelect =
      "id, bubble_id, name, full_name, email, bu, bu_id, n_team_type_id, position, role, status, dual_system, entry_date, image, private_phone, work_phone, quote_initial, " +
      "team_type:team_types!fk_staff_n_team_type_id(display), " +
      "cost_centre:cost_centres!fk_staff_bu_id(display, bu_code)";

    // Paginate staff — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let staffData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("staff")
        .select(staffSelect)
        .order("name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchStaffForManagement/staff", error);
        break;
      }
      staffData = staffData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Paginate users
    let usersData: any[] = [];
    from = 0;
    hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("users")
        .select("member_id, user_type, view_system")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchStaffForManagement/users", error);
        break;
      }
      usersData = usersData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Build user lookup by member_id (UUID FK → staff.id)
    const userMap = new Map<string, { user_type: string | null; view_system: string | null }>();
    usersData.forEach((u: any) => {
      if (u.member_id) {
        userMap.set(u.member_id, { user_type: u.user_type, view_system: u.view_system });
      }
    });

    return staffData.map((s: any) => {
      // user lookup now uses staff.id directly (users.member_id → staff.id)
      const user = userMap.get(s.id);
      // team_type is resolved via FK join — returned as { display: string } or null
      const resolvedTeam = s.team_type?.display ?? null;
      // cost_centre resolved via FK join (bu_id → cost_centres) — NO fallback to raw bubble ID
      const resolvedBu = s.cost_centre?.display ?? null;
      return {
        id: s.id,
        bubble_id: s.bubble_id,
        // Display name prefers the `name` column (the 姓名 field the form edits);
        // fall back to full_name only when name is empty.
        name: s.name || s.full_name || "",
        full_name: s.full_name ?? null,
        email: s.email,
        bu: resolvedBu,
        bu_id: s.bu_id ?? null,
        n_team_type: resolvedTeam,
        n_team_type_id: s.n_team_type_id ?? null,
        position: s.position,
        role: s.role,
        status: s.status,
        dual_system: s.dual_system,
        entry_date: s.entry_date,
        image: s.image,
        private_phone: s.private_phone ?? null,
        work_phone: s.work_phone ?? null,
        quote_initial: s.quote_initial ?? null,
        user_type: user?.user_type ?? null,
        view_system: user?.view_system ?? null,
      };
    });
  }, [], "fetchStaffForManagement");
}

// ─── CURRENT USER DISPLAY NAME (for Sidebar / header) ──

export async function fetchCurrentUserDisplayName(authEmail: string): Promise<string | null> {
  return safeQuery(async () => {
    const email = authEmail.toLowerCase().trim();
    if (!email) return null;

    console.log("[fetchCurrentUserDisplayName] Looking up:", email);

    // 1. Look up the users table by email (exact match)
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("member_id, member, name")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      logError("fetchCurrentUserDisplayName/users", userError);
    }

    console.log("[fetchCurrentUserDisplayName] users exact match:", userRecord);

    if (!userRecord) {
      // Try case-insensitive match via ilike
      const { data: userRecordIlike, error: userErrorIlike } = await supabase
        .from("users")
        .select("member_id, member, name")
        .ilike("email", email)
        .maybeSingle();

      if (userErrorIlike) {
        logError("fetchCurrentUserDisplayName/users-ilike", userErrorIlike);
      }

      console.log("[fetchCurrentUserDisplayName] users ilike match:", userRecordIlike);

      if (userRecordIlike) {
        const nameFromUsers = await resolveStaffName(userRecordIlike);
        if (nameFromUsers) return nameFromUsers;
      }

      // 2. Fallback: try looking up the staff table directly by email
      console.log("[fetchCurrentUserDisplayName] Trying staff table directly by email");
      return resolveStaffByEmail(email);
    }

    const nameFromUsers = await resolveStaffName(userRecord);
    if (nameFromUsers) return nameFromUsers;

    // 3. Fallback: try looking up the staff table directly by email
    console.log("[fetchCurrentUserDisplayName] userRecord found but no staff name, trying staff by email");
    return resolveStaffByEmail(email);
  }, null, "fetchCurrentUserDisplayName");
}

async function resolveStaffByEmail(email: string): Promise<string | null> {
  // Try exact match on staff.email
  const { data: staffRecord, error: staffError } = await supabase
    .from("staff")
    .select("name, full_name")
    .eq("email", email)
    .maybeSingle();

  if (staffError) {
    logError("fetchCurrentUserDisplayName/staff-email", staffError);
  }

  if (staffRecord) {
    return staffRecord.full_name || staffRecord.name || null;
  }

  // Try case-insensitive match
  const { data: staffRecordIlike, error: staffErrorIlike } = await supabase
    .from("staff")
    .select("name, full_name")
    .ilike("email", email)
    .maybeSingle();

  if (staffErrorIlike) {
    logError("fetchCurrentUserDisplayName/staff-email-ilike", staffErrorIlike);
  }

  if (staffRecordIlike) {
    return staffRecordIlike.full_name || staffRecordIlike.name || null;
  }

  return null;
}

async function resolveStaffName(userRecord: { member_id: string | null; member: string | null; name: string | null }): Promise<string | null> {
  // 2. If we have a member_id UUID FK, look up the staff name directly
  if (userRecord.member_id) {
    const { data: staffRecord, error: staffError } = await supabase
      .from("staff")
      .select("name, full_name")
      .eq("id", userRecord.member_id)
      .maybeSingle();

    if (staffError) {
      logError("fetchCurrentUserDisplayName/staff-uuid", staffError);
    }

    if (staffRecord) {
      return staffRecord.full_name || staffRecord.name || null;
    }
  }

  // 3. Fallback: try legacy TEXT member field (bubble_id)
  if (userRecord.member) {
    const { data: staffRecord, error: staffError } = await supabase
      .from("staff")
      .select("name, full_name")
      .eq("bubble_id", userRecord.member)
      .maybeSingle();

    if (staffError) {
      logError("fetchCurrentUserDisplayName/staff-bubbleid", staffError);
    }

    if (staffRecord) {
      return staffRecord.full_name || staffRecord.name || null;
    }
  }

  // 4. Fallback: return users.name if available
  if (userRecord.name) {
    return userRecord.name;
  }

  return null;
}

// ─── USER ACCOUNTS MANAGEMENT (帳戶管理 Page) ─────────────────

export interface UserAccountRow {
  id: string;
  bubble_id: string | null;
  email: string | null;
  user_type: string | null;
  view_system: string | null;
  special: string | null;
  ip: string | null;
  approval_status: string | null; // "pending" | "approved"
  created_date: string | null;
  modified_date: string | null;
  // Raw FK fields — used for binding status checks
  member: string | null;
  member_id: string | null;
  supplier: string | null;
  supplier_id: string | null;
  customer: string | null;
  customer_id: string | null;
  // Joined from staff table (via member_id FK)
  staff_name: string | null; // SHORT name (staff.name) — used by the 帳戶名稱 column
  staff_full_name: string | null; // full name — shown in the detail panel
  staff_email: string | null;
  staff_position: string | null;
  staff_role: string | null;
  staff_status: string | null;
  staff_image: string | null;
  staff_bu: string | null;
  // Joined from suppliers table (via supplier_id FK)
  supplier_name: string | null;
  // Joined from customers table (via customer_id FK)
  customer_name: string | null;
}

export async function fetchUserAccounts(): Promise<UserAccountRow[]> {
  return safeQuery(async () => {
    // Paginate all tables — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;

    // Helper to paginate a single query
    async function paginatedFetch(
      table: string,
      select: string,
      orderCol?: string,
      orderOpts?: { ascending: boolean; nullsFirst: boolean }
    ): Promise<any[]> {
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        let query = supabase.from(table).select(select);
        if (orderCol) {
          query = query.order(orderCol, orderOpts);
        }
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError(`fetchUserAccounts/${table}`, error);
          break;
        }
        allData = allData.concat(data ?? []);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData;
    }

    const [usersData, staffData, suppliersData, customersData] = await Promise.all([
      paginatedFetch(
        "users",
        "id, bubble_id, email, user_type, view_system, special, ip, approval_status, created_date, modified_date, member, member_id, supplier, supplier_id, customer, customer_id",
        "created_date",
        { ascending: false, nullsFirst: false }
      ),
      paginatedFetch(
        "staff",
        "id, bubble_id, name, full_name, email, position, role, status, image, bu_id, cost_centre:cost_centres!fk_staff_bu_id(display, bu_code)"
      ),
      paginatedFetch(
        "suppliers",
        "id, bubble_id, name, display_name"
      ),
      paginatedFetch(
        "customers",
        "id, bubble_id, customer_name, display_name, company_name"
      ),
    ]);

    // Build staff lookups — by UUID (member_id) and by bubble_id (member)
    const staffByUuid = new Map<string, any>();
    const staffByBubbleId = new Map<string, any>();
    staffData.forEach((s: any) => {
      staffByUuid.set(s.id, s);
      if (s.bubble_id) staffByBubbleId.set(s.bubble_id, s);
    });

    // Build supplier lookups
    const supplierByUuid = new Map<string, any>();
    const supplierByBubbleId = new Map<string, any>();
    suppliersData.forEach((s: any) => {
      supplierByUuid.set(s.id, s);
      if (s.bubble_id) supplierByBubbleId.set(s.bubble_id, s);
    });

    // Build customer lookups
    const customerByUuid = new Map<string, any>();
    const customerByBubbleId = new Map<string, any>();
    customersData.forEach((c: any) => {
      customerByUuid.set(c.id, c);
      if (c.bubble_id) customerByBubbleId.set(c.bubble_id, c);
    });

    return usersData.map((u: any) => {
      // Resolve staff — try member_id (UUID FK) first, then member (bubble_id text)
      const staff = (u.member_id ? staffByUuid.get(u.member_id) : null)
        || (u.member ? staffByBubbleId.get(u.member) : null);

      // Resolve supplier — try supplier_id (UUID FK) first, then supplier (bubble_id text)
      const sup = (u.supplier_id ? supplierByUuid.get(u.supplier_id) : null)
        || (u.supplier ? supplierByBubbleId.get(u.supplier) : null);

      // Resolve customer — try customer_id (UUID FK) first, then customer (bubble_id text)
      const cust = (u.customer_id ? customerByUuid.get(u.customer_id) : null)
        || (u.customer ? customerByBubbleId.get(u.customer) : null);

      return {
        id: u.id,
        bubble_id: u.bubble_id,
        email: u.email,
        user_type: u.user_type,
        view_system: u.view_system,
        special: u.special,
        ip: u.ip,
        approval_status: u.approval_status ?? null,
        created_date: u.created_date,
        modified_date: u.modified_date,
        // Raw FK fields
        member: u.member,
        member_id: u.member_id,
        supplier: u.supplier,
        supplier_id: u.supplier_id,
        customer: u.customer,
        customer_id: u.customer_id,
        // Joined staff data. The 帳戶名稱 column uses the SHORT name
        // (staff.name); the detail panel keeps the full name separately.
        staff_name: staff ? (staff.name || staff.full_name) : null,
        staff_full_name: staff ? (staff.full_name || staff.name) : null,
        staff_email: staff?.email ?? null,
        staff_position: staff?.position ?? null,
        staff_role: staff?.role ?? null,
        staff_status: staff?.status ?? null,
        staff_image: staff?.image ?? null,
        // Resolve via bu_id → cost_centres; never surface legacy Bubble TEXT `bu`
        staff_bu: staff?.cost_centre?.display ?? staff?.cost_centre?.bu_code ?? null,
        // Joined supplier data
        supplier_name: sup ? (sup.display_name || sup.name) : null,
        // Joined customer data
        customer_name: cust ? (cust.display_name || cust.customer_name || cust.company_name) : null,
      };
    });
  }, [], "fetchUserAccounts");
}

export async function updateUserAccount(
  id: string,
  updates: {
    user_type?: string;
    view_system?: string;
    special?: string;
    approval_status?: string;
    member_id?: string | null;
    supplier_id?: string | null;
    customer_id?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({
      action: "update",
      table: "users",
      id,
      updates: { ...updates, modified_date: new Date().toISOString() },
    });
  } catch (err: any) {
    logError("updateUserAccount", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// Approve a pending account (sets approval_status = "approved").
export async function approveUserAccount(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return updateUserAccount(id, { approval_status: "approved" });
}

export async function createUserAccount(
  data: { email?: string; user_type?: string; view_system?: string; special?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({
      action: "create",
      table: "users",
      data: {
        email: data.email || null,
        user_type: data.user_type || null,
        view_system: data.view_system || null,
        special: data.special || null,
        // Admin-created accounts are approved immediately (an admin is the one
        // filling the form). Only auto-provisioned logins start "pending".
        approval_status: "approved",
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("createUserAccount", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function deleteUserAccount(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "users", id });
  } catch (err: any) {
    logError("deleteUserAccount", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── STAFF DIRECTORY (for the reusable advanced StaffFilterBar) ──────
// One row per staff with the dimensions the filter bar offers: status,
// BU, team, position, role — with BU/team FK names resolved for display.
export interface StaffDirectoryRow {
  id: string;
  name: string;
  status: string;          // "Active" | "Inactive"
  position: string | null; // "PM" | "Designer" | "3D Designer" | "Company"
  role: string | null;     // "Super Admin" | "Admin" | "Senior User" | "User"
  bu_id: string | null;
  bu_name: string | null;  // cost_centres.display (fallback bu_code)
  team_id: string | null;
  team_name: string | null; // team_types.display
  /** Calendar date YYYY-MM-DD (入職日期); null if unset. */
  entry_date: string | null;
}

/** Normalize staff.entry_date / timestamptz to YYYY-MM-DD (date portion only). */
export function toEntryDateStr(entryDate: string | null | undefined): string | null {
  if (!entryDate) return null;
  const m = entryDate.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export async function fetchStaffDirectory(): Promise<StaffDirectoryRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select(
        `id, name, full_name, status, position, role, bu_id, n_team_type_id, entry_date,
         bu:cost_centres!fk_staff_bu_id(id, display, bu_code),
         team:team_types!fk_staff_n_team_type_id(id, display)`
      )
      .order("name");
    if (error) logError("fetchStaffDirectory", error);
    const rows = (data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name || s.full_name || "未命名",
      status: s.status || "Active",
      position: s.position ?? null,
      role: s.role ?? null,
      bu_id: s.bu_id ?? null,
      bu_name: s.bu?.display || s.bu?.bu_code || null,
      team_id: s.n_team_type_id ?? null,
      team_name: s.team?.display || null,
      entry_date: toEntryDateStr(s.entry_date),
    }));
    // Active first, then Inactive; A→Z by name within each group.
    return rows.sort((a: StaffDirectoryRow, b: StaffDirectoryRow) => {
      const aActive = a.status === "Active" ? 0 : 1;
      const bActive = b.status === "Active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [], "fetchStaffDirectory");
}

// ─── TEAM GROUPING TOOL (/team-grouping) ─────────────────────

export interface TeamGroupingStaff {
  id: string;
  name: string;
  position: string | null;
  team_id: string | null;
}

export interface TeamGroupingTeam {
  id: string;
  display: string;
  is_active: boolean;
  is_bwf: boolean | null;
  staff: TeamGroupingStaff[];
}

export interface TeamGroupingBoard {
  teams: TeamGroupingTeam[];
  unassigned: TeamGroupingStaff[];
}

export async function fetchTeamGroupingBoard(): Promise<TeamGroupingBoard> {
  return safeQuery(async () => {
    const [teamsRes, staffRes] = await Promise.all([
      supabase
        .from("team_types")
        .select("id, display, is_active, is_bwf")
        .order("display"),
      supabase
        .from("staff")
        .select("id, name, full_name, position, n_team_type_id")
        .eq("status", "Active")
        .order("name"),
    ]);

    if (teamsRes.error) logError("fetchTeamGroupingBoard/teams", teamsRes.error);
    if (staffRes.error) logError("fetchTeamGroupingBoard/staff", staffRes.error);

    const staffByTeam = new Map<string, TeamGroupingStaff[]>();
    const unassigned: TeamGroupingStaff[] = [];

    for (const s of staffRes.data ?? []) {
      const row: TeamGroupingStaff = {
        id: s.id,
        name: s.name || s.full_name || "未命名",
        position: s.position ?? null,
        team_id: s.n_team_type_id ?? null,
      };
      if (!row.team_id) {
        unassigned.push(row);
        continue;
      }
      const list = staffByTeam.get(row.team_id) ?? [];
      list.push(row);
      staffByTeam.set(row.team_id, list);
    }

    const teams: TeamGroupingTeam[] = (teamsRes.data ?? []).map((t: any) => ({
      id: t.id,
      display: t.display || "未命名團隊",
      is_active: t.is_active !== false,
      is_bwf: t.is_bwf ?? null,
      staff: (staffByTeam.get(t.id) ?? []).sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      ),
    }));

    // Active teams first, then A→Z by display.
    teams.sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.display.toLowerCase().localeCompare(b.display.toLowerCase());
    });

    unassigned.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    return { teams, unassigned };
  }, { teams: [], unassigned: [] }, "fetchTeamGroupingBoard");
}

/** Move an active staff member to another team (UUID FK only). */
export async function updateStaffTeamAssignment(
  staffId: string,
  teamId: string | null,
  teamDisplay: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (teamId) {
      const { data: team, error } = await supabase
        .from("team_types")
        .select("id, is_active")
        .eq("id", teamId)
        .maybeSingle();
      if (error) {
        logError("updateStaffTeamAssignment/team", error);
        return { success: false, error: error.message };
      }
      if (!team) return { success: false, error: "目標團隊不存在" };
      if (team.is_active === false) {
        return { success: false, error: "停用中的團隊不能加入同事" };
      }
    }

    return await adminFetch({
      action: "update",
      table: "staff",
      id: staffId,
      updates: {
        n_team_type_id: teamId,
        // Legacy display column kept in sync (human label, not Bubble ID).
        n_team_type: teamDisplay,
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("updateStaffTeamAssignment", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/** Toggle team_types.is_active. Blocks deactivate when Active staff remain. */
export async function updateTeamTypeActive(
  teamId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isActive) {
      const { count, error } = await supabase
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("n_team_type_id", teamId)
        .eq("status", "Active");
      if (error) {
        logError("updateTeamTypeActive/staffCount", error);
        return { success: false, error: error.message };
      }
      if ((count ?? 0) > 0) {
        return {
          success: false,
          error: `團隊內仍有 ${count} 位在職同事，無法停用`,
        };
      }
    }

    return await adminFetch({
      action: "update",
      table: "team_types",
      id: teamId,
      updates: {
        is_active: isActive,
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("updateTeamTypeActive", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── STAFF MANAGEMENT CRUD ─────────────────────────────────

export async function updateStaffMember(
  id: string,
  updates: {
    name?: string;
    full_name?: string;
    email?: string;
    position?: string;
    role?: string;
    status?: string;
    dual_system?: boolean;
    private_phone?: string;
    work_phone?: string;
    entry_date?: string;
    bu_id?: string | null;
    n_team_type_id?: string | null;
    quote_initial?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({
      action: "update",
      table: "staff",
      id,
      updates: { ...updates, modified_date: new Date().toISOString() },
    });
  } catch (err: any) {
    logError("updateStaffMember", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function createStaffMember(
  data: {
    name: string;
    full_name?: string;
    email?: string;
    position?: string;
    role?: string;
    status?: string;
    dual_system?: boolean;
    private_phone?: string;
    work_phone?: string;
    entry_date?: string;
    bu_id?: string | null;
    n_team_type_id?: string | null;
    quote_initial?: string | null;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({
      action: "create",
      table: "staff",
      data: {
        name: data.name,
        full_name: data.full_name || data.name,
        email: data.email || null,
        position: data.position || null,
        role: data.role || null,
        status: data.status || "Active",
        dual_system: data.dual_system ?? false,
        private_phone: data.private_phone || null,
        work_phone: data.work_phone || null,
        bu_id: data.bu_id || null,
        n_team_type_id: data.n_team_type_id || null,
        quote_initial: data.quote_initial || null,
        entry_date: data.entry_date || new Date().toISOString().split("T")[0],
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("createStaffMember", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function deleteStaffMember(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "staff", id });
  } catch (err: any) {
    logError("deleteStaffMember", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── STAFF LOOKUP HELPERS ────────────────────────────────────

/** Fetch a staff member's bu_id (cost centre UUID) */
export async function fetchStaffBuId(staffId: string): Promise<string | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("bu_id")
      .eq("id", staffId)
      .maybeSingle();
    if (error) logError("fetchStaffBuId", error);
    return data?.bu_id || null;
  }, null, "fetchStaffBuId");
}

/**
 * Fetch the current staff record for default values (Main PM, Team Type).
 *
 * Strategy:
 *   1. If `memberId` (UUID from users.member_id) is provided, query staff by id.
 *   2. If that fails or memberId is null, try `memberBubbleId` (text from users.member)
 *      and query staff by bubble_id.
 *   3. If both fail, try matching by `email` (staff.email).
 *
 * Returns { staffId (UUID), teamTypeId (UUID) } or null.
 */
export async function fetchStaffDefaults(
  memberId: string | null | undefined,
  memberBubbleId?: string | null,
  email?: string | null
): Promise<{ staffId: string; teamTypeId: string | null } | null> {
  return safeQuery(async () => {
    // Attempt 1: Query by UUID (users.member_id → staff.id)
    if (memberId) {
      console.log("[fetchStaffDefaults] Attempt 1: querying staff by id:", memberId);
      const { data, error } = await supabase
        .from("staff")
        .select("id, n_team_type_id")
        .eq("id", memberId)
        .maybeSingle();
      if (!error && data) {
        console.log("[fetchStaffDefaults] ✓ Found staff by id:", data);
        return { staffId: data.id, teamTypeId: data.n_team_type_id || null };
      }
      if (error) logError("fetchStaffDefaults (by id)", error);
    }

    // Attempt 2: Query by bubble_id (users.member → staff.bubble_id)
    if (memberBubbleId) {
      console.log("[fetchStaffDefaults] Attempt 2: querying staff by bubble_id:", memberBubbleId);
      const { data, error } = await supabase
        .from("staff")
        .select("id, n_team_type_id")
        .eq("bubble_id", memberBubbleId)
        .maybeSingle();
      if (!error && data) {
        console.log("[fetchStaffDefaults] ✓ Found staff by bubble_id:", data);
        return { staffId: data.id, teamTypeId: data.n_team_type_id || null };
      }
      if (error) logError("fetchStaffDefaults (by bubble_id)", error);
    }

    // Attempt 3: Query by email (staff.email)
    if (email) {
      console.log("[fetchStaffDefaults] Attempt 3: querying staff by email:", email);
      const { data, error } = await supabase
        .from("staff")
        .select("id, n_team_type_id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (!error && data) {
        console.log("[fetchStaffDefaults] ✓ Found staff by email:", data);
        return { staffId: data.id, teamTypeId: data.n_team_type_id || null };
      }
      if (error) logError("fetchStaffDefaults (by email)", error);
    }

    console.warn("[fetchStaffDefaults] Could not find staff for memberId:", memberId, "memberBubbleId:", memberBubbleId, "email:", email);
    return null;
  }, null, "fetchStaffDefaults");
}

/** Active Senior User staff on a team_types.is_bwf team (BWF team leaders). */
export async function fetchActiveBwfTeamLeaderStaffIds(): Promise<string[]> {
  return safeQuery(async () => {
    const { data: teams, error: teamErr } = await supabase
      .from("team_types")
      .select("id")
      .eq("is_bwf", true);
    if (teamErr) {
      logError("fetchActiveBwfTeamLeaderStaffIds (teams)", teamErr);
      return [];
    }
    const teamIds = (teams ?? []).map((t) => t.id).filter(Boolean);
    if (teamIds.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("staff")
      .select("id, role")
      .eq("status", "Active")
      .in("n_team_type_id", teamIds);
    if (error) {
      logError("fetchActiveBwfTeamLeaderStaffIds", error);
      return [];
    }
    return (rows ?? [])
      .filter((s) => isTeamOrAssignedScope(s.role))
      .map((s) => s.id);
  }, [], "fetchActiveBwfTeamLeaderStaffIds");
}
