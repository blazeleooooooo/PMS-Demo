# Data layer (`src/lib/data`)

Domain modules for Supabase query/CRUD logic. The compatibility barrel [`src/lib/data-service.ts`](../data-service.ts) re-exports these modules so existing `from "@/lib/data-service"` imports keep working.

**Binding rules:** [`.cursor/rules/data-layer.mdc`](../../../.cursor/rules/data-layer.mdc) (`alwaysApply`).  
**Migration history:** [MIGRATION.md](./MIGRATION.md) (Phases 0–6 complete).

## Where new code goes

| Kind of change | File |
|----------------|------|
| Shared supabase client, `safeQuery`, `adminFetch`, FK paginators | `_core.ts` |
| BWA/BWF junction resolvers | `junctions.ts` |
| Home page sentences | `dashboard.ts` |
| Staff accounts, directory, team grouping | `staff.ts` |
| Customers / client master data | `customers.ts` |
| Customer documents (BR / Form S1 / Testimonial) | `customer-documents.ts` |
| Suppliers | `suppliers.ts` |
| Buildings + factories | `buildings-factories.ts` |
| Shared `<Select>` option fetchers (`LinkOption`) | `lookups.ts` |
| News | `news.ts` |
| Brands | `brands.ts` |
| BWA pitching | `bwa-pitching.ts` |
| BWF pitching | `bwf-pitching.ts` |
| BWF orders (warehouse / install / defect / production) | `bwf-orders.ts` |
| Project documents | `project-docs.ts` |
| Weekly reports | `weekly-reports.ts` |
| Base44 man-hour edge helpers | `man-hours.ts` |
| Income / expense / invoice / receipt / project financials | `finance.ts` |
| AR collection-date list (`/ar-receive-dates`) | `ar-receive-dates.ts` |
| Collection chase emails (`/collection-emails`) | `collection-emails.ts` |
| AP payment-date list (`/ap-payment-dates`) | `ap-payment-dates.ts` |
| BMO deposit / refund list (`/deposits`) | `deposits.ts` |
| Incomes with expiry reason (`/admin/income-expiry`) | `income-expiry.ts` |
| Expected receipts & payments (`/expected-payments`) | `expected-payments.ts` |
| BWA projects | `bwa-projects.ts` |
| BWF projects | `bwf-projects.ts` |
| Schedule / calendar tasks | `schedule.ts` |
| Business / ops report fetchers | `reports.ts` (or report-local `*-service.ts`) |
| Project-filter extras (income/payment sums + site dates) | `project-filter-extras.ts` |
| Sales by PM `project_bv` shares | `sales-by-pm.ts` |
| Annual bonus settlement (`/admin/annual-bonus-settlement`) | `annual-bonus-settlement.ts` |
| Outstanding / accounting remarks (`outstanding_remarks`) | `outstanding-remarks.ts` |
| Truly new product area | **new** `<domain>.ts` + one-line `export *` in the barrel |

Row-visibility / role scope stays in [`src/lib/staff-data-scope.ts`](../staff-data-scope.ts) — do not invent parallel helpers.

## Import DAG (never reverse)

```text
UI / hooks
  → data-service.ts (barrel, optional)
  → domain modules (prefer @/lib/data/<domain> for new UI)
      → junctions.ts → _core.ts
      → _core.ts
reports.ts → _core / junctions (domains must NOT import reports)
staff-data-scope ← domains may import; it must not import domains
```

Hard bans:

- No function bodies in `data-service.ts` (barrel only).
- No `@/lib/data-service` imports inside `src/lib/data/*` (cycles).
- No new catch-all modules (`data-service2.ts`, `api-helpers.ts`, `lib/queries.ts`).
- No Bubble ID logic in new app features (see `no-bubble-strings.mdc`).

## Size gates

| Limit | Threshold |
|-------|-----------|
| Soft | ~1,500 lines per `src/lib/data/*.ts` |
| Hard review | ~2,500 lines — split in the same PR |

Known follow-up: `reports.ts` is ~3.1k lines (over hard gate). Split before large new report work (e.g. `reports-pm.ts` / `reports-ops.ts`). `suppliers.ts` is slightly over soft (~1.7k).

## Feature workflow

1. Pick the domain file from the table (or add a new one).
2. Implement using `_core` / `junctions` / `staff-data-scope`.
3. If callers still use `@/lib/data-service`, add `export * from "./data/<file>"` to the barrel when the domain file is new.
4. Prefer new UI importing `@/lib/data/<domain>`; barrel remains for legacy.
5. Verify with `npx tsc --noEmit` (do not start/restart the dev server unless asked).
