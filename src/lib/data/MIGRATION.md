# Data-service strangler migration

**Status: COMPLETE** (Phases 0–6). Domain modules live under `src/lib/data/`; [`data-service.ts`](../data-service.ts) is a re-export barrel only (~24 lines).

Stable “where does code go?” map: [README.md](./README.md). Binding AI rules: [`.cursor/rules/data-layer.mdc`](../../../.cursor/rules/data-layer.mdc).

Callers may keep `from "@/lib/data-service"`; new UI should prefer `@/lib/data/<domain>`.

**Import DAG (never reverse):** `reports` → domain modules → `junctions` → `_core`  
`staff-data-scope` stays independent (domains may import it; it must not import domains).

---

## Phase checklist

| Phase | Status | Owner | Notes |
|-------|--------|-------|-------|
| **0 — Foundation** | **complete** | Integrator-A | `_core.ts`, durable AI rules, this file |
| **1 — Junctions** | **complete** | Integrator-A | `junctions.ts`; barrel wired; `fetchBWFProjectIdsByFactory` stays in monolith for bwf-projects |
| **2 — Leaf domains** | **complete** | L1–L8 → Integrator-B | barrel wired; conflicts resolved; `tsc` pass |
| **3 — Mid-tier** | **complete** | M1–M6 → Integrator-C | barrel wired; conflicts resolved; `tsc` pass |
| **4 — Projects + finance** | **complete** | finance → P1–P3 → Integrator-D | 4a finance + 4b projects/schedule barreled; `tsc` pass |
| **5 — Reports** | **complete** | R1 → Integrator-E | `reports.ts` + barrel; `searchBuildingOptions` → buildings-factories; `tsc` pass |
| **6 — Empty shell** | **complete** | Integrator-Final | barrel re-exports only; `README.md`; `data-layer.mdc` post-migration; `tsc` pass |

**Verify every Integrator step:** `npx tsc --noEmit` (must pass before next wave).

---

## File ownership matrix

One writer per file per wave. Parallel agents create **only** their owned `src/lib/data/<file>.ts`. Only the Integrator edits `data-service.ts` in a given wave.

### Phase 0 (done)

| File | Owner |
|------|-------|
| `src/lib/data/_core.ts` | Integrator-A |
| `src/lib/data/MIGRATION.md` | Integrator-A |
| `.cursor/rules/data-layer.mdc` | Integrator-A |
| `.agents/AGENTS.md` (pointer) | Integrator-A |
| `src/lib/data-service.ts` (import `_core` only) | Integrator-A |

### Phase 1

| File | Owner |
|------|-------|
| `src/lib/data/junctions.ts` | Integrator-A |
| `src/lib/data-service.ts` (barrel + delete) | Integrator-A |

### Phase 2 (done — L → Integrator-B)

| Agent | Exclusive write | Source regions (approx) |
|-------|-----------------|-------------------------|
| L1 | `data/dashboard.ts` | ~190–497, ~5189–5228 |
| L2 | `data/staff.ts` | ~498–1283, ~1380–1539, staff lookups ~9383–9562 |
| L3 | `data/customers.ts` | ~1540–2664 + customer search helpers |
| L4 | `data/suppliers.ts` | options + list/page/CRUD/detail/merge/tags |
| L5 | `data/buildings-factories.ts` | buildings + factories |
| L6 | `data/lookups.ts` | `LinkOption` + high fan-out option fetchers |
| L7 | `data/news.ts` | ~17047–17391 |
| L8 | `data/brands.ts` | ~17392–17616 |
| Integrator-B | `data-service.ts`, `MIGRATION.md` | wire barrel after L complete |

**Lookups vs staff:** `LinkOption` option APIs → `lookups.ts`; staff CRUD/directory → `staff.ts`.

### Phase 3 (done — M → Integrator-C)

| Agent | Exclusive write | Depends on |
|-------|-----------------|------------|
| M1 | `data/bwa-pitching.ts` | `_core`, `junctions`, `staff-data-scope` |
| M2 | `data/bwf-pitching.ts` | `_core`, `junctions`, `bwa-pitching` (shared types) |
| M3 | `data/bwf-orders.ts` | `_core`, `bwf-pitching` (link helpers) |
| M4 | `data/project-docs.ts` | `_core` |
| M5 | `data/weekly-reports.ts` | `_core` |
| M6 | `data/man-hours.ts` | `_core` (Base44 edge helpers; not `man-hour-service.ts`) |
| Integrator-C | `data-service.ts`, `MIGRATION.md` | wire barrel after M complete |

### Phase 4

| Step | Exclusive write | Notes |
|------|-----------------|-------|
| 4a | `data/finance.ts` | **done** — serial; barrel wired |
| P1 | `data/bwa-projects.ts` | **done** — skip nested `createBWFProject` |
| P2 | `data/bwf-projects.ts` | **done** — include `createBWFProject` |
| P3 | `data/schedule.ts` | **done** — calendar incomes stay in finance |
| Integrator-D | `data-service.ts`, `MIGRATION.md` | **done** — 4b barreled |

### Phase 5 (done — R1 → Integrator-E)

| File | Owner |
|------|-------|
| `data/reports.ts` | R1 / Integrator-E |
| `data/buildings-factories.ts` (`searchBuildingOptions` only) | Integrator-E |
| `data-service.ts`, `MIGRATION.md` | Integrator-E |

### Phase 6 (done — Integrator-Final)

| Exclusive write | Notes |
|-----------------|-------|
| `data-service.ts` confirm | re-exports only (~24 lines); no function bodies |
| `data/README.md` | created — domain placement map + DAG + size gates |
| `data-layer.mdc` | finalized for post-migration (barrel empty of bodies) |
| `.agents/AGENTS.md` | pointer to `data-layer.mdc` confirmed |

---

## Phase 0 deliverables

- [x] `src/lib/data/_core.ts` — `getSupabase` / `supabase`, `adminFetch`, `logError`, `isBubbleId`, `safeQuery`, `mapBatchesParallel`, `fetchAllByFk`, `fetchAllByProject`
- [x] Monolith imports helpers from `@/lib/data/_core` (domain exports unchanged)
- [x] `.cursor/rules/data-layer.mdc` (`alwaysApply: true`)
- [x] `.agents/AGENTS.md` pointer
- [x] This checklist

**Not in Phase 0:** junctions, pitching, customers, reports, or emptying the barrel.

---

## Phase 1 deliverables

- [x] `src/lib/data/junctions.ts` — BWA/BWF junction resolvers + `fetchPitchingProjectTypeIds` / `fetchProjectProjectTypeIds` / `fetchBwfPitchingIdsForServiceType`
- [x] Monolith imports resolvers from `@/lib/data/junctions` for remaining call sites; `export * from "./data/junctions"`
- [x] Moved bodies deleted from monolith (no duplicates)
- [x] `fetchBWFProjectIdsByFactory` left in monolith for later `bwf-projects.ts` extract

**Not in Phase 1:** leaf domains (dashboard/staff/customers/…), pitching, reports.

---

## Phase 2 deliverables

- [x] Domain files: `dashboard.ts`, `staff.ts`, `customers.ts`, `suppliers.ts`, `buildings-factories.ts`, `lookups.ts`, `news.ts`, `brands.ts`
- [x] Barrel re-exports in `data-service.ts` (junctions + all eight leaf domains)
- [x] Moved bodies deleted from monolith (no duplicate exports)
- [x] `npx tsc --noEmit` pass

### Ownership decisions (Integrator-B)

| Symbol | Canonical owner | Notes |
|--------|-----------------|-------|
| `LinkOption` | `lookups.ts` | customers / buildings-factories / suppliers import type from lookups (no re-export) |
| `fetchDistrictOptions` | `lookups.ts` | removed from buildings-factories |
| `fetchTeamTypeOptions` | `lookups.ts` | removed from staff.ts |
| `WELL_KNOWN_BRANDS_TAG_ID` / `COLLECTION_ID` | `customers.ts` | brands.ts imports tag id from customers |
| `PaginatedResult` | `customers.ts` | monolith pitching code imports type from customers; single barrel export |
| `fetchFactoryOptions` / `fetchBuildingOptions` | `buildings-factories.ts` | stay with buildings domain (not lookups) |
| `fetchBWFProjectIdsByFactory` | `bwf-projects.ts` (Phase 4b) | moved from monolith |

**Not in Phase 2:** pitching, orders, projects, finance, schedule, reports.

---

## Phase 3 deliverables

- [x] Domain files: `bwa-pitching.ts`, `bwf-pitching.ts`, `bwf-orders.ts`, `project-docs.ts`, `weekly-reports.ts`, `man-hours.ts`
- [x] Barrel re-exports in `data-service.ts` (after Phase 0–2 exports)
- [x] Moved bodies deleted from monolith (no duplicate exports)
- [x] `npx tsc --noEmit` pass

### Ownership decisions (Integrator-C)

| Symbol | Canonical owner | Notes |
|--------|-----------------|-------|
| `BWAPitchingRow`, `PitchingFilters`, `PitchingStaffContext`, `PitchingKPIStats`, `BWAPitchingDetailData` | `bwa-pitching.ts` | `bwf-pitching` imports types only (no re-export) |
| `CascadeRelatedRecord` | `bwa-pitching.ts` | monolith project cascade imports type; single barrel export |
| `searchBWFPitchingOptions`, `fetchBWFPitchingLabel`, `fetchBWFProjectIdByPitching`, `fetchBWFPitchingIdByProject` | `bwf-pitching.ts` | removed from `bwf-orders`; orders imports for `verifyBWFOrderLinkAlignment` |
| `searchFactoryOptions` / `fetchFactoryLabel` | `bwf-orders.ts` | order-dialog search variants; `buildings-factories` keeps `fetchFactoryOptions` only |
| `searchBWFProjectOptions` / `fetchBWFProjectLabel` | `bwf-projects.ts` (Phase 4b) | removed from `bwf-orders` |
| `searchBuildingOptions` | `buildings-factories.ts` (Phase 5) | was left in monolith through Phase 4 |
| `generateBWFProjectCode` / `generateBWFP2Code` | `bwf-projects.ts` (Phase 4b) | uses `BWFPitchingCodeParams` from `bwf-pitching` |
| `BWFOrderRow` | `bwf-orders.ts` | monolith `fetchBWFProjectOrders` imports type |
| Base44 `ManHourTask` helpers | `man-hours.ts` | distinct from `@/lib/man-hour-service` Supabase CRUD |

**Not in Phase 3:** BWA/BWF projects, finance, schedule, reports.

---

## Phase 4a deliverables

- [x] `src/lib/data/finance.ts` — project financials, income/expense/invoice/receipt CRUD, contract/payment/supplier-type lookups, cost centres, calendar incomes
- [x] Barrel: `export * from "./data/finance"`; monolith imports `fetchProjectFinancials` for Case PDF
- [x] Moved bodies deleted from monolith (no duplicate exports)
- [x] `npx tsc --noEmit` pass

### Ownership decisions (Integrator-D / 4a)

| Symbol | Canonical owner | Notes |
|--------|-----------------|-------|
| `ProjectFinancials`, `fetchProjectFinancials`, `fetchBWFProjectFinancials` | `finance.ts` | leaf for projects list/detail |
| Income / expense / invoice / receipt CRUD + form types | `finance.ts` | |
| `fetchContractTypes`, `fetchPaymentMethods`, `fetchSupplierTypes`, `fetchCostCentres` | `finance.ts` | finance-adjacent lookups |
| `CalendarIncomeItem`, `fetchCalendarIncomes` | `finance.ts` | schedule tasks stay for 4b |
| `BWAProjectIncome` / `BWAProjectExpense` / detail shapes | monolith (→ 4b projects) | project detail types |
| Cost-analysis helpers (`fetchExpensesByProjects`, `fetchCostCentresForCostAnalysis`, …) | monolith (→ Phase 5 reports) | not moved in 4a |
| Schedule task helpers | monolith (→ 4b `schedule.ts`) | unchanged |

**Not in Phase 4a:** `bwa-projects`, `bwf-projects`, `schedule`, reports.

---

## Phase 4b deliverables

- [x] Domain files: `bwa-projects.ts`, `bwf-projects.ts`, `schedule.ts`
- [x] Barrel: `export *` for all three after finance
- [x] Moved bodies deleted from monolith (no duplicate exports)
- [x] `npx tsc --noEmit` pass

### Ownership decisions (Integrator-D / 4b)

| Symbol | Canonical owner | Notes |
|--------|-----------------|-------|
| `BWAProjectRow`, `QuotationExpenseRow`, `BWAProjectIncome` / `BWAProjectExpense`, `CascadeAnalysisResult` | `bwa-projects.ts` | `bwf-projects` imports types only (no re-export) |
| `searchBWFProjectOptions`, `fetchBWFProjectLabel`, `fetchBWFProjectIdsByFactory`, `createBWFProject` | `bwf-projects.ts` | removed duplicates from `bwf-orders` / monolith |
| `syncProjectDatesToSchedules` | `schedule.ts` (public) | private copies removed from bwa/bwf-projects; both import from schedule |
| `ProjectStaffContext` | `bwa-projects.ts` | alias of `StaffDataScope` |
| `searchBuildingOptions` | `buildings-factories.ts` (Phase 5) | moved from monolith straggler |
| Cost-analysis + business report fetchers | `reports.ts` (Phase 5) | moved |

**Not in Phase 4b:** `reports.ts`, emptying the barrel (Phase 6).

---

## Phase 5 deliverables

- [x] `src/lib/data/reports.ts` — cost analysis, BV performance/sales trend/personal performance, sales by PM, PMS login, PM/designer hit rate, discounted, sales by category, PM source, overdue/AO/outstanding/bad debt, `recalculateProjectBV`, expense-control candidates, supplier-load, designer-load, frequent-suppliers
- [x] Barrel: `export * from "./data/reports"`; monolith bodies deleted
- [x] `searchBuildingOptions` moved to `buildings-factories.ts`
- [x] Dead duplicate `normalizeImageUrl` / `fetchNewsTypeMap` in monolith deleted (canonical copies remain in `news.ts`)
- [x] Domains do not import `reports.ts`
- [x] `npx tsc --noEmit` pass

### Ownership decisions (Integrator-E / Phase 5)

| Symbol | Canonical owner | Notes |
|--------|-----------------|-------|
| Cost analysis + all business/ops report fetchers listed above | `reports.ts` | may import `_core` / `junctions` only (no domain CRUD imports) |
| `recalculateProjectBV` | `reports.ts` | report-supporting RPC; unused by finance callers today |
| `fetchExpenseControlCandidates` / `ExpenseLockedProject` | `reports.ts` | depends on `SalesByPMProject` |
| `searchBuildingOptions` | `buildings-factories.ts` | dialog typeahead; next to `fetchBuildingOptions` |
| Orphan news helpers in monolith | deleted | already in `news.ts` |

**Size note:** `reports.ts` is ~3.1k lines (over soft 1.5k / hard 2.5k gates). Known follow-up split candidate (e.g. `reports-pm.ts` / `reports-ops.ts`) — not required for migration complete.

**Not in Phase 5:** `data/README.md`, final `data-layer.mdc` harden wording (Phase 6). Barrel is already re-exports-only after this wave.

---

## Phase 6 deliverables

- [x] `data-service.ts` confirmed: only `export *` re-exports (~24 lines); no function bodies / types / helpers
- [x] Grep: no leftover bodies in barrel; no `data-service2` / `api-helpers` / `lib/queries` god modules; domains do not import barrel or `reports`
- [x] `src/lib/data/README.md` — placement map, import DAG, size gates, pointer to `data-layer.mdc`
- [x] `.cursor/rules/data-layer.mdc` finalized for post-migration (`alwaysApply: true`)
- [x] `.agents/AGENTS.md` still references `data-layer.mdc`
- [x] `npx tsc --noEmit` pass

### Known follow-ups (out of program)

| Item | Notes |
|------|-------|
| Split `reports.ts` (~3.1k lines) | Over soft + hard size gates; split before large new report work |
| `suppliers.ts` (~1.7k) | Slightly over soft gate; watch on next substantial edit |
| Hot-caller import migration | Optional: move UI from `@/lib/data-service` → `@/lib/data/<domain>` for tree-shaking |
