import {
  LOOKUP_TABLES,
  lookupRoute,
  type LookupTableConfig,
} from "@/lib/lookup-tables-config";

// Maps URL path prefixes to permission module keys (longest prefix wins).
export const ROUTE_MODULE_MAP: Record<string, string> = {
  "/news": "news",
  "/asana-import": "asana-import",
  "/projects": "projects",
  "/proposals": "proposals",
  "/key-pitching": "key-pitching",
  "/bwf/proposals": "bwf/proposals",
  "/bwf/projects": "bwf/projects",
  "/bwf/payment-progress": "bwf/payment-progress",
  "/bwf/orders": "bwf/orders",
  "/paid-pending-orders": "paid-pending-orders",
  "/production": "production",
  "/consolidation-warehouse": "consolidation-warehouse",
  "/installation-team": "installation-team",
  "/completion-defect": "completion-defect",
  "/major-inquiry": "major-inquiry",
  "/clients": "clients",
  "/brands": "brands",
  "/suppliers": "suppliers",
  "/factories": "factories",
  "/supplier-load": "supplier-load",
  "/frequent-suppliers": "frequent-suppliers",
  "/bni-projects": "bni-projects",
  "/case-pdf": "case-pdf",
  "/defect-crisis": "defect-crisis",
  "/payable": "payable",
  "/receivable": "receivable",
  "/ap-rp": "ap-rp",
  "/expected-payments": "expected-payments",
  "/bad-debt": "bad-debt",
  "/cheques": "cheques",
  "/deposits": "deposits",
  "/wip-debt": "wip-debt",
  "/cost-analysis": "cost-analysis",
  "/ar-receive-dates": "ar-receive-dates",
  "/collection-emails": "collection-emails",
  "/ap-payment-dates": "ap-payment-dates",
  "/business-reports": "business-reports",
  "/team-reports": "team-reports",
  "/individual-reports": "individual-reports",
  /** Alias → /individual-reports/personal-performance */
  "/personal-performance": "individual-reports.personal-performance",
  "/team-grouping": "team-grouping",
  "/team-assign-bv": "team-assign-bv",
  "/expense-control-waivers": "expense-control-waivers",
  "/site-photos": "site-photos",
  "/completion-photos": "completion-photos",
  "/assign-bv": "assign-bv",
  "/audit": "audit",
  "/dates": "dates",
  "/3d-design": "3d-design",
  /** Alias of /design-reports/3d-output (主選單 doorway) */
  "/3d-output": "design-reports.3d-output",
  "/designer-load": "designer-load",
  "/design-reports": "design-reports",
  "/buildings": "buildings",
  "/admin": "admin",
  "/work-report-check": "work-report-check",
  "/work-report-leaderboard": "work-report-leaderboard",
  "/reports": "reports",
  "/testing": "testing",
  "/settings": "settings",
  "/relations": "relations",
  "/contracts": "contracts",
  "/prequalify": "prequalify",
  "/br-labour-update": "br-labour-update",
};

const SETTINGS_PAGE_MODULES: Record<string, string> = {
  "task-reporting": "settings.task-reporting",
  "site-status-questionnaire": "settings.site-status-questionnaire",
  // Custom settings page (not in LOOKUP_TABLES registry)
  cost_centres: "settings.cost_centres",
};

/** Finer-grained admin sub-pages (parent /admin → "admin" is the group key). */
const ADMIN_PAGE_MODULES: Record<string, string> = {
  accounts: "admin.accounts",
  roles: "admin.roles",
  permissions: "admin.permissions",
  "expense-locked": "admin.expense-locked",
  "expense-installment-waivers": "admin.expense-installment-waivers",
  "income-expiry": "admin.income-expiry",
  "pms-login": "admin.pms-login",
  "annual-bonus-settlement": "admin.annual-bonus-settlement",
  migration: "admin.migration",
  "fk-audit": "admin.fk-audit",
  // Redirect-only legacy paths — keep non-admin targets where the page lands.
  "work-report-check": "work-report-check",
  settings: "settings",
  "daily-reports": "admin",
};

function findLookupByRouteSegment(segment: string): LookupTableConfig | undefined {
  return LOOKUP_TABLES.find((cfg) => lookupRoute(cfg) === segment);
}

/** Routes that do not require staff login (must stay in sync with middleware). */
export function isPublicRoute(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/access-denied") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/portal")) return true;
  return false;
}

/** Resolve coarse permission module from pathname prefix map. */
export function resolveModuleFromMap(pathname: string): string | null {
  const entries = Object.entries(ROUTE_MODULE_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [prefix, module] of entries) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return module;
    }
  }
  return null;
}

/** Strip `?query` / `#hash` so nav hrefs with tabs resolve the same as pathnames. */
function cleanPathname(pathOrHref: string): string {
  const noHash = pathOrHref.split("#")[0] ?? pathOrHref;
  const q = noHash.indexOf("?");
  return q >= 0 ? noHash.slice(0, q) : noHash;
}

/**
 * Resolve the permission module for a pathname.
 * Uses finer-grained keys for settings lookup pages and business reports.
 */
export function resolvePermissionModule(pathname: string): string | null {
  const path = cleanPathname(pathname);

  if (path.startsWith("/settings/")) {
    const segment = path.split("/")[2];
    if (segment) {
      const fixed = SETTINGS_PAGE_MODULES[segment];
      if (fixed) return fixed;

      const lookup = findLookupByRouteSegment(segment);
      if (lookup) return lookup.permissionKey ?? `settings.${lookup.key}`;

      return "settings";
    }
  }

  if (path.startsWith("/business-reports/")) {
    const slug = path.split("/")[2];
    if (slug) return `business-reports.${slug}`;
  }

  if (path.startsWith("/design-reports/")) {
    const slug = path.split("/")[2];
    // Legacy redirect → 測試中頁面
    if (slug === "designer-daily-feed") return "testing.designer-daily-feed";
    if (slug) return `design-reports.${slug}`;
  }

  if (path.startsWith("/team-reports/")) {
    const slug = path.split("/")[2];
    if (slug) return `team-reports.${slug}`;
  }

  if (path.startsWith("/individual-reports/")) {
    const slug = path.split("/")[2];
    if (slug) return `individual-reports.${slug}`;
  }

  // /reports = work reports; dedicated deadline list is its own module.
  // /reports/[id] (man-hour detail) stays under parent "reports".
  if (path === "/reports/aug14-deadline" || path === "/reports/july31-deadline") {
    return "reports.aug14-deadline";
  }

  if (path.startsWith("/testing/")) {
    const slug = path.split("/")[2];
    if (slug) return `testing.${slug}`;
  }

  if (path.startsWith("/admin/")) {
    const segment = path.split("/")[2];
    if (segment && ADMIN_PAGE_MODULES[segment]) {
      return ADMIN_PAGE_MODULES[segment];
    }
    return "admin";
  }

  return resolveModuleFromMap(path);
}

/**
 * Resolve the permission module for a sidebar / matrix nav href.
 * Keeps /admin/permissions matrix rows aligned with RouteGuard + middleware.
 */
export function navHrefToPermissionModule(href: string): string | null {
  if (!href || href.startsWith("http")) return null;
  const path = cleanPathname(href);
  if (path === "/") return "dashboard";
  return resolvePermissionModule(path);
}

/**
 * Whether a sidebar nav href is blocked by view permission.
 * Uses the same module resolution and canView check as RouteGuard.
 */
export function isNavItemPermissionBlocked(
  href: string,
  canView: (module: string) => boolean,
  permLoading: boolean,
  external?: boolean
): boolean {
  if (permLoading || external || href.startsWith("http")) return false;
  const module = resolvePermissionModule(href);
  if (!module) return false;
  return !canView(module);
}
