import { describe, expect, it } from "vitest";
import {
  filterExpectedPaymentsForMoney,
  groupInspectProjects,
  type ExpectedPaymentLine,
  type ExpectedPaymentProject,
  type ExpectedPaymentProjectGroup,
} from "@/lib/data/expected-payments";

function project(
  overrides: Partial<ExpectedPaymentProject> & { id: string }
): ExpectedPaymentProject {
  return {
    source: "BWF",
    project_name: overrides.id,
    project_code: overrides.id,
    status: null,
    main_pm_id: null,
    pm_name: null,
    project_size: null,
    ...overrides,
  };
}

function row(
  projectOverrides: Partial<ExpectedPaymentProject> & { id: string },
  income: number,
  expense: number
): ExpectedPaymentProjectGroup {
  return {
    project: project(projectOverrides),
    incomeOutstanding: income,
    expenseOutstanding: expense,
    gpOutstanding: income - expense,
  };
}

describe("groupInspectProjects", () => {
  const rows = [
    row({ id: "a", main_pm_id: "pm1", pm_name: "Ada", status: "進行中", project_size: "Big (>$150K)" }, 100, 20),
    row({ id: "b", main_pm_id: "pm1", pm_name: "Ada", status: "完工", project_size: "Small (<$50K)" }, 40, 10),
    row({ id: "c", main_pm_id: "pm2", pm_name: "Ben", status: "進行中", project_size: "Big (>$150K)" }, 80, 5),
    row({ id: "d", status: null, project_size: null }, 10, 0),
  ];

  it("returns a single bucket when grouping is off", () => {
    const buckets = groupInspectProjects(rows, "none");
    expect(buckets).toHaveLength(1);
    expect(buckets[0].rows).toHaveLength(4);
    expect(buckets[0].incomeOutstanding).toBe(230);
    expect(buckets[0].expenseOutstanding).toBe(35);
    expect(buckets[0].gpOutstanding).toBe(195);
  });

  it("groups by main_pm and sums metrics", () => {
    const buckets = groupInspectProjects(rows, "staff");
    expect(buckets.map((b) => b.label)).toEqual(["Ada", "Ben", "未設定"]);
    const ada = buckets[0];
    expect(ada.rows).toHaveLength(2);
    expect(ada.incomeOutstanding).toBe(140);
    expect(ada.expenseOutstanding).toBe(30);
    expect(ada.gpOutstanding).toBe(110);
  });

  it("groups by BWF os_size / project_size", () => {
    const buckets = groupInspectProjects(rows, "project_size");
    const big = buckets.find((b) => b.label === "Big (>$150K)");
    expect(big?.rows).toHaveLength(2);
    expect(big?.incomeOutstanding).toBe(180);
    expect(buckets.some((b) => b.label === "未設定")).toBe(true);
  });

  it("groups by status", () => {
    const buckets = groupInspectProjects(rows, "status");
    const active = buckets.find((b) => b.label === "進行中");
    expect(active?.rows).toHaveLength(2);
    expect(active?.incomeOutstanding).toBe(180);
    expect(buckets.find((b) => b.label === "完工")?.rows).toHaveLength(1);
  });
});

describe("filterExpectedPaymentsForMoney", () => {
  function line(projectId: string, id: string): ExpectedPaymentLine {
    return {
      id,
      source: "BWA",
      kind: "income",
      projectId,
      amount: 100,
      counterpart: 0,
      outstanding: 100,
      dueDate: "2026-08-31",
      expectedPaymentDate: null,
      effectiveDate: "2026-08-31",
    };
  }

  it("drops Case Closed and Internal Project lines and project rows", () => {
    const projects = {
      keep: project({ id: "keep", source: "BWA", status: "Work In Progress" }),
      closed: project({ id: "closed", source: "BWA", status: "Case Closed" }),
      internal: project({ id: "internal", source: "BWA", status: "Internal Project" }),
      done: project({ id: "done", source: "BWA", status: "Project Done" }),
    };
    const filtered = filterExpectedPaymentsForMoney(
      [line("keep", "1"), line("closed", "2"), line("internal", "3"), line("done", "4")],
      projects
    );
    expect(filtered.lines.map((l) => l.projectId)).toEqual(["keep", "done"]);
    expect(Object.keys(filtered.projects).sort()).toEqual(["done", "keep"]);
  });

  it("keeps lines whose project is missing so unknown rows are not dropped", () => {
    const filtered = filterExpectedPaymentsForMoney([line("orphan", "1")], {});
    expect(filtered.lines).toHaveLength(1);
  });
});
