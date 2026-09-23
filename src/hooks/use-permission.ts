"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

// ─── INTERFACES ──────────────────────────────────────────

export interface PermissionEntry {
  module: string;
  action: string;
  effect: string;
}

interface PermissionContextType {
  permissions: PermissionEntry[];
  loading: boolean;
  /** Check if user can view a module */
  canView: (module: string) => boolean;
  /**
   * View check for tab/sub-modules without parent cascade (e.g. projects.overview
   * under bwf/projects). Matches check_permission RPC — parent projects/proposals
   * deny must not block BWF detail tabs when the page module is allowed.
   */
  canViewSubmodule: (module: string) => boolean;
  /** Check if user can create in a module */
  canCreate: (module: string) => boolean;
  /** Check if user can edit in a module */
  canEdit: (module: string) => boolean;
  /** Check if user can delete in a module */
  canDelete: (module: string) => boolean;
  /** Check a conditional specific rule — returns "allow" | "deny" | null (async, not cached) */
  checkRule: (
    module: string,
    ruleKey: string,
    context: Record<string, any>
  ) => Promise<"allow" | "deny" | null>;
  /** Force re-fetch permissions (e.g., after admin changes) */
  refreshPermissions: () => Promise<void>;
  /**
   * DEV diagnostic: console.table which permission decided each module/action,
   * so a developer can see exactly what is blocking a hidden button. No-op in
   * production builds. `modules` is a list of permission module keys to inspect
   * (each is checked for view/create/edit/delete).
   */
  debugModulePermissions: (label: string, modules: string[]) => void;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  loading: true,
  canView: () => false,
  canViewSubmodule: () => false,
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  checkRule: async () => null,
  refreshPermissions: async () => {},
  debugModulePermissions: () => {},
});

// ─── IN-MEMORY CACHE ─────────────────────────────────────
// Cache permissions by staff ID to avoid re-fetching on re-mount
const permissionCache = new Map<string, PermissionEntry[]>();

/** Invalidate ALL cached permissions (call after admin changes any permission assignment) */
export function permissionCacheInvalidateAll() {
  permissionCache.clear();
}

// ─── PERMISSION RESOLUTION ───────────────────────────────

/**
 * Resolves whether a permission is granted from the effective permissions array.
 *
 * The module hierarchy is "parent" → "parent.child" (e.g. "projects" →
 * "projects.income", "settings" → "settings.districts"). How the parent and
 * child interact depends on the ACTION:
 *
 *  • view / create / edit / delete — MOST-SPECIFIC WINS: an exact child entry
 *    (e.g. "admin.accounts" view=allow) decides on its own. The parent
 *    (e.g. "admin") is only consulted when the child has no entry for that
 *    action — so a parent deny still locks unset children, while a specific
 *    child allow can grant one /admin page without unlocking the rest.
 *
 * A specific deny always overrides a wildcard allow. The global "*" module is
 * the lowest-priority fallback, consulted only when nothing at the module level
 * applies (so a specific-module allow still beats a "*" deny).
 *
 * FAIL OPEN: when NO rule matches at any level (exact, parent, or wildcard) for
 * EITHER view or a capability action, access is GRANTED. "Unset" means "not
 * restricted" — only an explicit `deny` hides/blocks a feature. This keeps the
 * UI from hiding buttons for modules an admin never explicitly configured.
 */
function hasPermission(
  permissions: PermissionEntry[],
  targetModule: string,
  targetAction: string,
  options?: { skipParentCascade?: boolean }
): boolean {
  const collect = (mod: string): PermissionEntry[] =>
    permissions.filter(
      (p) => p.module === mod && (p.action === targetAction || p.action === "*")
    );
  const decide = (entries: PermissionEntry[]): boolean | null => {
    if (entries.length === 0) return null;
    if (entries.some((p) => p.effect === "deny")) return false; // deny wins
    return entries.some((p) => p.effect === "allow");
  };

  const exact = collect(targetModule);
  const parent = targetModule.includes(".")
    ? collect(targetModule.split(".")[0])
    : [];

  if (targetAction === "view" && options?.skipParentCascade) {
    const exactOnly = decide(exact);
    if (exactOnly !== null) return exactOnly;
  } else {
    // Most-specific wins — child decides first; parent only when unset.
    const child = decide(exact);
    if (child !== null) return child;
    const par = decide(parent);
    if (par !== null) return par;
  }

  // Global wildcard module ("*") — lowest-priority fallback.
  const wildcard = decide(collect("*"));
  if (wildcard !== null) return wildcard;

  // ── No rule matched at ANY level ──────────────────────────────
  // FAIL OPEN for every action: when no permission rule is configured for
  // this module/action (view OR create/edit/delete), the feature is NOT
  // hidden/blocked. Only an explicit `deny` (or an explicit `allow` that is
  // absent) governs access; "unset" means "not restricted". This keeps the UI
  // from hiding buttons (e.g. the create-supplier button) for modules that an
  // admin never explicitly configured, and matches the server-side
  // check_permission RPC which also fails open when nothing matches.
  return true;
}

// ─── DEV DIAGNOSTICS ─────────────────────────────────────
// Explains WHY a module/action resolved the way it did — which entry (exact
// module, parent fallback, wildcard, or "default deny") decided the outcome.
// Used by the dev console logging on the project / pitching detail pages so a
// developer can see exactly which permission is blocking a button.
export interface PermissionExplanation {
  module: string;
  action: string;
  allowed: boolean;
  decidedBy: string;   // human label of the deciding rule
  source: "exact" | "parent" | "wildcard" | "default";
}

function explainPermission(
  permissions: PermissionEntry[],
  targetModule: string,
  targetAction: string
): PermissionExplanation {
  const allowed = hasPermission(permissions, targetModule, targetAction);
  const match = (mod: string) =>
    permissions.find((p) => p.module === mod && p.action === targetAction) ||
    permissions.find((p) => p.module === mod && p.action === "*");

  const parentMod = targetModule.includes(".") ? targetModule.split(".")[0] : null;

  // Most-specific wins: exact child first, then parent, then wildcard.
  let source: PermissionExplanation["source"] = "default";
  let decidedBy = "default deny (no matching rule)";

  const ex = match(targetModule);
  const par = parentMod ? match(parentMod) : undefined;
  if (ex) {
    source = "exact";
    decidedBy = `${targetModule}/${ex.action}=${ex.effect}`;
  } else if (par) {
    source = "parent";
    decidedBy = `${parentMod}/${par.action}=${par.effect} (inherited)`;
  }

  if (source === "default") {
    const wc = match("*");
    if (wc) {
      source = "wildcard";
      decidedBy = `*/${wc.action}=${wc.effect}`;
    } else {
      // No rule anywhere → fails OPEN for every action (matches hasPermission).
      decidedBy = "default allow (no matching rule — fails open)";
    }
  }

  return { module: targetModule, action: targetAction, allowed, decidedBy, source };
}

// ─── PROVIDER ────────────────────────────────────────────

interface PermissionProviderProps {
  children: React.ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { staff, isLoading: authLoading, isLoggedIn } = useAuth();
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const supabase = React.useMemo(() => createClient(), []);

  // The staff.id from auth context is used as the user_id for permission lookups
  const staffId = staff?.id ?? null;

  // ─── FETCH PERMISSIONS ──────────────────────────────────
  const fetchPermissions = useCallback(
    async (userId: string) => {
      // Check cache first
      const cached = permissionCache.get(userId);
      if (cached) {
        setPermissions(cached);
        setLoading(false);
        return;
      }

      // Prevent duplicate concurrent fetches
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const { data, error } = await supabase.rpc(
          "get_user_effective_permissions",
          { p_user_id: userId }
        );

        if (error) {
          console.warn(
            "[usePermission] RPC get_user_effective_permissions error:",
            error.message
          );
          // On error, default to empty (deny all) for safety
          setPermissions([]);
          return;
        }

        const entries: PermissionEntry[] = (data || []).map((row: any) => ({
          module: row.module,
          action: row.action,
          effect: row.effect,
        }));

        setPermissions(entries);
        permissionCache.set(userId, entries);
      } catch (err) {
        console.warn(
          "[usePermission] Failed to fetch permissions:",
          err instanceof Error ? err.message : String(err)
        );
        setPermissions([]);
      } finally {
        fetchingRef.current = false;
        setLoading(false);
      }
    },
    [supabase]
  );

  // ─── REFRESH (manual trigger) ──────────────────────────
  const refreshPermissions = useCallback(async () => {
    if (staffId) {
      permissionCache.delete(staffId);
      setLoading(true);
      await fetchPermissions(staffId);
    }
  }, [staffId, fetchPermissions]);

  // ─── EFFECT: Fetch on auth resolution ───────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !staffId) {
      // Not logged in or no staff record — clear permissions
      setPermissions([]);
      setLoading(false);
      return;
    }

    fetchPermissions(staffId);
  }, [authLoading, isLoggedIn, staffId, fetchPermissions]);

  // ─── HELPERS ────────────────────────────────────────────

  const canView = useCallback(
    (module: string) => {
      if (loading) return false;
      return hasPermission(permissions, module, "view");
    },
    [permissions, loading]
  );

  const canViewSubmodule = useCallback(
    (module: string) => {
      if (loading) return false;
      return hasPermission(permissions, module, "view", { skipParentCascade: true });
    },
    [permissions, loading]
  );

  const canCreate = useCallback(
    (module: string) => {
      if (loading) return false;
      return hasPermission(permissions, module, "create");
    },
    [permissions, loading]
  );

  const canEdit = useCallback(
    (module: string) => {
      if (loading) return false;
      return hasPermission(permissions, module, "edit");
    },
    [permissions, loading]
  );

  const canDelete = useCallback(
    (module: string) => {
      if (loading) return false;
      return hasPermission(permissions, module, "delete");
    },
    [permissions, loading]
  );

  const checkRule = useCallback(
    async (
      module: string,
      ruleKey: string,
      context: Record<string, any>
    ): Promise<"allow" | "deny" | null> => {
      if (!staffId) return null;

      try {
        const { data, error } = await supabase.rpc("check_specific_rule", {
          p_user_id: staffId,
          p_module: module,
          p_rule_key: ruleKey,
          p_context: context,
        });

        if (error) {
          console.warn(
            "[usePermission] check_specific_rule error:",
            error.message
          );
          return null;
        }

        // RPC returns text: "allow", "deny", or null
        return data as "allow" | "deny" | null;
      } catch (err) {
        console.warn(
          "[usePermission] checkRule failed:",
          err instanceof Error ? err.message : String(err)
        );
        return null;
      }
    },
    [staffId, supabase]
  );

  // ─── DEV DIAGNOSTIC ─────────────────────────────────────
  const debugModulePermissions = useCallback(
    (label: string, modules: string[]) => {
      if (process.env.NODE_ENV === "production") return;
      if (loading) return;
      const actions = ["view", "create", "edit", "delete"];
      const rows: Record<string, any> = {};
      for (const mod of modules) {
        for (const action of actions) {
          const ex = explainPermission(permissions, mod, action);
          rows[`${mod} · ${action}`] = {
            allowed: ex.allowed ? "✓ allow" : "✗ BLOCKED",
            decidedBy: ex.decidedBy,
            source: ex.source,
          };
        }
      }
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `%c[Permissions] ${label}`,
        "color:#7c3aed;font-weight:bold"
      );
      // eslint-disable-next-line no-console
      console.table(rows);
      // eslint-disable-next-line no-console
      console.log("Raw effective permissions:", permissions);
      // eslint-disable-next-line no-console
      console.groupEnd();
    },
    [permissions, loading]
  );

  // ─── RENDER ─────────────────────────────────────────────

  const contextValue = React.useMemo<PermissionContextType>(
    () => ({
      permissions,
      loading,
      canView,
      canViewSubmodule,
      canCreate,
      canEdit,
      canDelete,
      checkRule,
      refreshPermissions,
      debugModulePermissions,
    }),
    [permissions, loading, canView, canViewSubmodule, canCreate, canEdit, canDelete, checkRule, refreshPermissions, debugModulePermissions]
  );

  return React.createElement(
    PermissionContext.Provider,
    { value: contextValue },
    children
  );
}

// ─── HOOK ─────────────────────────────────────────────────

export function usePermission() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
}
