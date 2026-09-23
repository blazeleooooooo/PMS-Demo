import { describe, expect, it } from "vitest";
import {
  isBoxWorkingFolder,
  parseBoxWorkingFolderPath,
  splitBoxRelativePath,
} from "@/lib/box-path";

describe("parseBoxWorkingFolderPath", () => {
  it("parses a standard D:\\Box\\ path", () => {
    const result = parseBoxWorkingFolderPath(
      "D:\\Box\\BW Office\\+ BW Case - Office 300-1500ft Fast Build\\20260325 - Civilconnect"
    );
    expect(result).toEqual({
      relativePath:
        "BW Office/+ BW Case - Office 300-1500ft Fast Build/20260325 - Civilconnect",
      localPath:
        "D:\\Box\\BW Office\\+ BW Case - Office 300-1500ft Fast Build\\20260325 - Civilconnect",
    });
  });

  it("extracts the Box path from tab-separated legacy values", () => {
    const result = parseBoxWorkingFolderPath(
      "https://app.asana.com/0/123/456/f\tD:\\Box\\BW Design\\Project A"
    );
    expect(result?.relativePath).toBe("BW Design/Project A");
  });

  it("returns null for Dropbox paths", () => {
    expect(
      parseBoxWorkingFolderPath("D:\\Dropbox\\+ BW Case - Office\\202103 - Test")
    ).toBeNull();
  });

  it("returns null for empty or N/A values", () => {
    expect(parseBoxWorkingFolderPath("N/A")).toBeNull();
    expect(parseBoxWorkingFolderPath("")).toBeNull();
    expect(parseBoxWorkingFolderPath(null)).toBeNull();
  });
});

describe("splitBoxRelativePath", () => {
  it("splits on forward and back slashes", () => {
    expect(splitBoxRelativePath("A/B\\C")).toEqual(["A", "B", "C"]);
  });
});

describe("isBoxWorkingFolder", () => {
  it("detects Box paths", () => {
    expect(isBoxWorkingFolder("D:\\Box\\Project")).toBe(true);
    expect(isBoxWorkingFolder("D:\\Dropbox\\Project")).toBe(false);
  });
});
