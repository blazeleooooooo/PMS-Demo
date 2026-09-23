import { afterEach, describe, expect, it } from "vitest";
import {
  ASANA_IMPORT_PROJECTS,
  getAsanaImportProject,
  isAsanaImportProjectKey,
  listAsanaImportProjects,
} from "@/lib/asana-import-projects";
import { getAsanaPat } from "@/lib/asana-pat";

describe("asana import project catalog", () => {
  it("lists the three BWA Active projects", () => {
    expect(listAsanaImportProjects().map((p) => p.key)).toEqual([
      "active-1",
      "active-2",
      "active-2a",
    ]);
    expect(ASANA_IMPORT_PROJECTS).toHaveLength(3);
  });

  it("resolves known keys and rejects unknown ones", () => {
    expect(isAsanaImportProjectKey("active-1")).toBe(true);
    expect(isAsanaImportProjectKey("active-9")).toBe(false);
    expect(getAsanaImportProject("active-2a").shortName).toBe("Active 2A");
  });
});

describe("getAsanaPat", () => {
  const previous = process.env.ASANA_PAT;

  afterEach(() => {
    if (previous == null) delete process.env.ASANA_PAT;
    else process.env.ASANA_PAT = previous;
  });

  it("prefers the process env token over other sources", () => {
    process.env.ASANA_PAT = "test-token";
    expect(getAsanaPat()).toBe("test-token");
  });
});
