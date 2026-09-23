/**
 * Step 8: Permission System — Unit Tests
 * ========================================
 * Tests the frontend hasPermission resolution logic (pure function).
 *
 * Scenarios tested:
 * 1. Role-based access (user cannot access admin pages)
 * 2. Position override (PM can edit projects despite user role)
 * 3. User-specific override
 * 4. Deny-wins-on-tie logic
 * 5. Wildcard handling (module/action wildcards)
 * 6. Default ALLOW (fail open) when no permission matches
 */

import { describe, it, expect } from "vitest";

// ─── Extracted hasPermission logic (mirror of use-permission.ts) ──────────

interface PermissionEntry {
  module: string;
  action: string;
  effect: string;
}

/**
 * Resolves whether a permission is granted from the effective permissions array.
 * Checks from most specific to least specific (wildcard handling).
 * This is a direct copy of the logic in use-permission.ts for testing.
 */
function hasPermission(
  permissions: PermissionEntry[],
  targetModule: string,
  targetAction: string
): boolean {
  const collect = (mod: string): PermissionEntry[] =>
    permissions.filter(
      (p) => p.module === mod && (p.action === targetAction || p.action === "*")
    );
  const decide = (entries: PermissionEntry[]): boolean | null => {
    if (entries.length === 0) return null;
    if (entries.some((p) => p.effect === "deny")) return false;
    return entries.some((p) => p.effect === "allow");
  };

  const exact = collect(targetModule);
  const parent = targetModule.includes(".")
    ? collect(targetModule.split(".")[0])
    : [];

  if (targetAction === "view") {
    // view = page/section access: parent deny cascades over a child allow.
    const chain = decide([...exact, ...parent]);
    if (chain !== null) return chain;
  } else {
    // create/edit/delete = capability: most-specific wins (child decides,
    // parent only as fallback when the child has no entry).
    const child = decide(exact);
    if (child !== null) return child;
    const par = decide(parent);
    if (par !== null) return par;
  }

  // Global wildcard module ("*"), lowest-priority fallback.
  const wildcard = decide(collect("*"));
  if (wildcard !== null) return wildcard;

  // No rule matched anywhere: FAIL OPEN for every action. "Unset" means
  // "not restricted" — only an explicit `deny` blocks. Matches the
  // server-side check_permission RPC, which also fails open.
  return true;
}

// ─── TEST SUITES ──────────────────────────────────────────────────────────

describe("hasPermission — Frontend Resolution Logic", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 1: Role-based access — "user" role cannot access admin pages
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 1: Role-based access (user cannot access admin pages)", () => {
    // Simulates a "user" role who has view on limited modules, with the
    // sensitive modules EXPLICITLY denied (view now fails open, so a module
    // must be explicitly denied to block it — mirrors the real configured
    // "user" role, which carries explicit deny rows for finance/admin pages).
    const userPermissions: PermissionEntry[] = [
      { module: "dashboard", action: "view", effect: "allow" },
      { module: "projects", action: "view", effect: "allow" },
      { module: "proposals", action: "view", effect: "allow" },
      { module: "clients", action: "view", effect: "allow" },
      { module: "suppliers", action: "view", effect: "allow" },
      { module: "dates", action: "view", effect: "allow" },
      { module: "3d-design", action: "view", effect: "allow" },
      { module: "admin", action: "view", effect: "deny" },
      { module: "payable", action: "view", effect: "deny" },
      { module: "receivable", action: "view", effect: "deny" },
    ];

    it("should ALLOW viewing dashboard", () => {
      expect(hasPermission(userPermissions, "dashboard", "view")).toBe(true);
    });

    it("should ALLOW viewing projects", () => {
      expect(hasPermission(userPermissions, "projects", "view")).toBe(true);
    });

    it("should DENY viewing admin module", () => {
      expect(hasPermission(userPermissions, "admin", "view")).toBe(false);
    });

    it("should ALLOW editing projects (no edit rule → fails open)", () => {
      expect(hasPermission(userPermissions, "projects", "edit")).toBe(true);
    });

    it("should ALLOW creating clients (no create rule → fails open)", () => {
      expect(hasPermission(userPermissions, "clients", "create")).toBe(true);
    });

    it("should ALLOW deleting suppliers (no delete rule → fails open)", () => {
      expect(hasPermission(userPermissions, "suppliers", "delete")).toBe(true);
    });

    it("should DENY accessing payable module", () => {
      expect(hasPermission(userPermissions, "payable", "view")).toBe(false);
    });

    it("should DENY accessing receivable module", () => {
      expect(hasPermission(userPermissions, "receivable", "view")).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 2: Position override — PM can edit projects despite having "user" role base
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 2: Position override (PM can edit projects despite user role)", () => {
    // The RPC merges role + position permissions. PM override (priority 40) 
    // trumps user role (priority 10), so effective permissions include edit/create/delete on projects.
    const pmUserPermissions: PermissionEntry[] = [
      // From "user" role (priority 10)
      { module: "dashboard", action: "view", effect: "allow" },
      { module: "projects", action: "view", effect: "allow" },
      { module: "proposals", action: "view", effect: "allow" },
      { module: "clients", action: "view", effect: "allow" },
      { module: "suppliers", action: "view", effect: "allow" },
      { module: "dates", action: "view", effect: "allow" },
      { module: "3d-design", action: "view", effect: "allow" },
      // From "PM" position (priority 40) — overrides user role for these modules
      { module: "projects", action: "create", effect: "allow" },
      { module: "projects", action: "edit", effect: "allow" },
      { module: "projects", action: "delete", effect: "allow" },
      { module: "proposals", action: "create", effect: "allow" },
      { module: "proposals", action: "edit", effect: "allow" },
      { module: "proposals", action: "delete", effect: "allow" },
      { module: "clients", action: "create", effect: "allow" },
      { module: "clients", action: "edit", effect: "allow" },
      { module: "clients", action: "delete", effect: "allow" },
      // Sensitive pages explicitly denied (view fails open otherwise).
      { module: "admin", action: "view", effect: "deny" },
      { module: "payable", action: "view", effect: "deny" },
    ];

    it("should ALLOW PM to edit projects", () => {
      expect(hasPermission(pmUserPermissions, "projects", "edit")).toBe(true);
    });

    it("should ALLOW PM to create projects", () => {
      expect(hasPermission(pmUserPermissions, "projects", "create")).toBe(true);
    });

    it("should ALLOW PM to delete projects", () => {
      expect(hasPermission(pmUserPermissions, "projects", "delete")).toBe(true);
    });

    it("should ALLOW PM to edit clients", () => {
      expect(hasPermission(pmUserPermissions, "clients", "edit")).toBe(true);
    });

    it("should ALLOW PM to delete proposals", () => {
      expect(hasPermission(pmUserPermissions, "proposals", "delete")).toBe(true);
    });

    it("should still DENY admin access (PM doesn't get admin)", () => {
      expect(hasPermission(pmUserPermissions, "admin", "view")).toBe(false);
    });

    it("should still DENY payable access (PM position only covers projects/proposals/clients)", () => {
      expect(hasPermission(pmUserPermissions, "payable", "view")).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 3: User-specific override
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 3: User-specific override", () => {
    // Simulates: user role = basic "user", but has a user-level override granting admin view
    const userWithAdminOverride: PermissionEntry[] = [
      // From "user" role
      { module: "dashboard", action: "view", effect: "allow" },
      { module: "projects", action: "view", effect: "allow" },
      { module: "clients", action: "view", effect: "allow" },
      // From user-specific override (priority 100)
      { module: "admin", action: "view", effect: "allow" },
      { module: "payable", action: "view", effect: "allow" },
      { module: "payable", action: "edit", effect: "allow" },
      // receivable explicitly denied (view fails open otherwise).
      { module: "receivable", action: "view", effect: "deny" },
    ];

    it("should ALLOW admin view (from user-specific override)", () => {
      expect(hasPermission(userWithAdminOverride, "admin", "view")).toBe(true);
    });

    it("should ALLOW payable view (from user-specific override)", () => {
      expect(hasPermission(userWithAdminOverride, "payable", "view")).toBe(true);
    });

    it("should ALLOW payable edit (from user-specific override)", () => {
      expect(hasPermission(userWithAdminOverride, "payable", "edit")).toBe(true);
    });

    it("should ALLOW admin edit (no edit rule → fails open)", () => {
      expect(hasPermission(userWithAdminOverride, "admin", "edit")).toBe(true);
    });

    it("should still DENY receivable (no override exists)", () => {
      expect(hasPermission(userWithAdminOverride, "receivable", "view")).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 4: Deny-wins-on-tie logic
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 4: Deny-wins-on-tie logic", () => {
    // When the RPC resolves tied priority, deny wins (alphabetical sort ASC).
    // After RPC resolution, only "allow" entries are returned.
    // So if deny won at DB level, the entry won't appear → default deny on frontend.

    it("should ALLOW an unconfigured module's view AND capabilities (all fail open)", () => {
      // 'suppliers' has no rule in the resolved array. Under the fail-open
      // policy, every action (view/create/edit/delete) is allowed unless an
      // explicit deny exists.
      const resolvedPerms: PermissionEntry[] = [
        { module: "dashboard", action: "view", effect: "allow" },
        { module: "projects", action: "view", effect: "allow" },
      ];

      expect(hasPermission(resolvedPerms, "suppliers", "view")).toBe(true);
      expect(hasPermission(resolvedPerms, "suppliers", "edit")).toBe(true);
      expect(hasPermission(resolvedPerms, "suppliers", "create")).toBe(true);
    });

    it("should DENY if explicit deny entry exists in array (edge case for client-side evaluation)", () => {
      // In edge case where deny entry is somehow in the resolved array
      const permsWithDeny: PermissionEntry[] = [
        { module: "dashboard", action: "view", effect: "allow" },
        { module: "projects", action: "view", effect: "allow" },
        { module: "suppliers", action: "view", effect: "deny" },
      ];

      expect(hasPermission(permsWithDeny, "suppliers", "view")).toBe(false);
    });

    it("should ALLOW if explicit allow entry exists", () => {
      const permsWithAllow: PermissionEntry[] = [
        { module: "suppliers", action: "view", effect: "allow" },
      ];

      expect(hasPermission(permsWithAllow, "suppliers", "view")).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 5: Wildcard handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 5: Wildcard handling", () => {
    // ─── 5a: Full wildcard (module=*, action=*) grants everything ───
    describe("Full wildcard (admin/super_admin)", () => {
      const adminPermissions: PermissionEntry[] = [
        { module: "*", action: "*", effect: "allow" },
      ];

      it("should ALLOW any module + any action", () => {
        expect(hasPermission(adminPermissions, "admin", "view")).toBe(true);
        expect(hasPermission(adminPermissions, "admin", "edit")).toBe(true);
        expect(hasPermission(adminPermissions, "admin", "delete")).toBe(true);
        expect(hasPermission(adminPermissions, "projects", "create")).toBe(true);
        expect(hasPermission(adminPermissions, "payable", "delete")).toBe(true);
        expect(hasPermission(adminPermissions, "unknown-module", "edit")).toBe(true);
      });
    });

    // ─── 5b: Module-specific wildcard (module=projects, action=*) ───
    describe("Module-specific wildcard (module=X, action=*)", () => {
      const perms: PermissionEntry[] = [
        { module: "projects", action: "*", effect: "allow" },
        { module: "dashboard", action: "view", effect: "allow" },
      ];

      it("should ALLOW all actions on projects", () => {
        expect(hasPermission(perms, "projects", "view")).toBe(true);
        expect(hasPermission(perms, "projects", "create")).toBe(true);
        expect(hasPermission(perms, "projects", "edit")).toBe(true);
        expect(hasPermission(perms, "projects", "delete")).toBe(true);
      });

      it("should ALLOW other modules' actions too (no rule → fails open)", () => {
        expect(hasPermission(perms, "dashboard", "view")).toBe(true);
        expect(hasPermission(perms, "dashboard", "edit")).toBe(true);
      });
    });

    // ─── 5c: Action-specific wildcard (module=*, action=view) ───
    describe("Action-specific wildcard (module=*, action=X)", () => {
      const perms: PermissionEntry[] = [
        { module: "*", action: "view", effect: "allow" },
      ];

      it("should ALLOW view on ALL modules", () => {
        expect(hasPermission(perms, "admin", "view")).toBe(true);
        expect(hasPermission(perms, "payable", "view")).toBe(true);
        expect(hasPermission(perms, "suppliers", "view")).toBe(true);
      });

      it("should ALLOW non-view actions (no rule for them → fails open)", () => {
        expect(hasPermission(perms, "admin", "edit")).toBe(true);
        expect(hasPermission(perms, "projects", "create")).toBe(true);
        expect(hasPermission(perms, "suppliers", "delete")).toBe(true);
      });
    });

    // ─── 5d: Exact match overrides wildcard ───
    describe("Exact match takes priority over wildcard", () => {
      const perms: PermissionEntry[] = [
        { module: "*", action: "*", effect: "allow" },
        { module: "admin", action: "view", effect: "deny" },
      ];

      it("should DENY admin view (exact match deny overrides wildcard allow)", () => {
        expect(hasPermission(perms, "admin", "view")).toBe(false);
      });

      it("should still ALLOW other actions through wildcard", () => {
        expect(hasPermission(perms, "admin", "edit")).toBe(true);
        expect(hasPermission(perms, "projects", "view")).toBe(true);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 6: Default behaviour when no permission matches
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 6: Default (no matching rule) — everything fails open", () => {
    const emptyPermissions: PermissionEntry[] = [];

    it("should ALLOW view AND capabilities when no rule matches", () => {
      // Everything fails open — matches the server check_permission RPC.
      expect(hasPermission(emptyPermissions, "dashboard", "view")).toBe(true);
      expect(hasPermission(emptyPermissions, "admin", "view")).toBe(true);
      expect(hasPermission(emptyPermissions, "projects", "edit")).toBe(true);
      expect(hasPermission(emptyPermissions, "suppliers", "create")).toBe(true);
    });

    // NOTE: the real PermissionProvider treats a TRULY empty permission array
    // (RPC returned nothing) as a distinct "no-permissions-loaded" safety case
    // and still blocks the page — that guard lives in the provider/AccessDenied,
    // not in this pure resolver.
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 7: Module-specific specificity precedence
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 7: Specificity precedence order", () => {
    it("exact module+action wins over module+wildcard_action", () => {
      const perms: PermissionEntry[] = [
        { module: "projects", action: "*", effect: "allow" },
        { module: "projects", action: "delete", effect: "deny" },
      ];

      // Exact "projects+delete=deny" should win over "projects+*=allow"
      expect(hasPermission(perms, "projects", "delete")).toBe(false);
      // Other actions still allowed via wildcard
      expect(hasPermission(perms, "projects", "view")).toBe(true);
      expect(hasPermission(perms, "projects", "edit")).toBe(true);
    });

    it("module+wildcard_action wins over wildcard_module+exact_action", () => {
      const perms: PermissionEntry[] = [
        { module: "*", action: "view", effect: "deny" },
        { module: "projects", action: "*", effect: "allow" },
      ];

      // "projects+*=allow" (specificity 2) wins over "*+view=deny" (specificity 3 — actually lower)
      expect(hasPermission(perms, "projects", "view")).toBe(true);
    });

    it("wildcard_module+exact_action wins over full wildcard", () => {
      const perms: PermissionEntry[] = [
        { module: "*", action: "*", effect: "allow" },
        { module: "*", action: "delete", effect: "deny" },
      ];

      // "*+delete=deny" wins over "*+*=allow" for delete action
      expect(hasPermission(perms, "projects", "delete")).toBe(false);
      expect(hasPermission(perms, "admin", "delete")).toBe(false);
      // Other actions still allowed
      expect(hasPermission(perms, "projects", "view")).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 8: Parent-module deny blocks child pages (grouped "settings")
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 8: Parent-module deny precedence (settings.* hierarchy)", () => {
    it("denying the parent 'settings' module blocks every settings.* page, even with a child allow", () => {
      const perms: PermissionEntry[] = [
        { module: "settings", action: "view", effect: "deny" },
        { module: "settings.districts", action: "view", effect: "allow" },
      ];
      // Parent deny wins over the more specific child allow.
      expect(hasPermission(perms, "settings.districts", "view")).toBe(false);
      expect(hasPermission(perms, "settings.cost_centres", "view")).toBe(false);
      // The parent page itself is also denied.
      expect(hasPermission(perms, "settings", "view")).toBe(false);
    });

    it("a parent allow lets child pages through unless the child is specifically denied", () => {
      const perms: PermissionEntry[] = [
        { module: "settings", action: "view", effect: "allow" },
        { module: "settings.nos_bv_values", action: "view", effect: "deny" },
      ];
      // Inherit allow from parent.
      expect(hasPermission(perms, "settings.districts", "view")).toBe(true);
      // Child-specific deny wins for just that page.
      expect(hasPermission(perms, "settings.nos_bv_values", "view")).toBe(false);
    });

    it("a child allow grants that page when the parent has no entry", () => {
      const perms: PermissionEntry[] = [
        { module: "settings.districts", action: "view", effect: "allow" },
      ];
      expect(hasPermission(perms, "settings.districts", "view")).toBe(true);
      // A sibling with no entry (and no parent entry) passes every action under
      // the fail-open policy.
      expect(hasPermission(perms, "settings.cost_centres", "view")).toBe(true);
      expect(hasPermission(perms, "settings.cost_centres", "edit")).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEST 9: Action-aware hierarchy — create/edit/delete are most-specific-wins
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Test 9: parent deny does NOT clobber child create/edit/delete", () => {
    // Real-world case (Alice Suen): cannot create a whole new project, but CAN
    // add income/expense line items inside an existing project's sub-tabs.
    const perms: PermissionEntry[] = [
      { module: "projects", action: "view", effect: "allow" },
      { module: "projects", action: "create", effect: "deny" },
      { module: "projects", action: "edit", effect: "allow" },
      { module: "projects", action: "delete", effect: "allow" },
      { module: "projects.income", action: "create", effect: "allow" },
      { module: "projects.income", action: "view", effect: "allow" },
      { module: "projects.expense", action: "create", effect: "allow" },
    ];

    it("child create-allow wins over parent create-deny (sub-tab + button shows)", () => {
      expect(hasPermission(perms, "projects.income", "create")).toBe(true);
      expect(hasPermission(perms, "projects.expense", "create")).toBe(true);
    });

    it("parent create-deny still blocks creating a whole new project", () => {
      expect(hasPermission(perms, "projects", "create")).toBe(false);
    });

    it("child with no create entry falls back to the parent capability", () => {
      // projects.docs has no own create entry → inherits parent (no parent
      // create-allow, parent has create=deny) → blocked.
      expect(hasPermission(perms, "projects.docs", "create")).toBe(false);
    });

    it("view still cascades: a parent view-deny would hide all sub-tabs", () => {
      const denied: PermissionEntry[] = [
        { module: "projects", action: "view", effect: "deny" },
        { module: "projects.income", action: "view", effect: "allow" },
      ];
      expect(hasPermission(denied, "projects.income", "view")).toBe(false);
    });
  });
});
