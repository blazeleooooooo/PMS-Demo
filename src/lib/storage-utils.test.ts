import { describe, expect, it } from "vitest";
import {
  buildStorageObjectKey,
  buildStorageObjectKeyWithSanitizedName,
  getStorageFileExtension,
  sanitizeStorageFileName,
} from "./storage-utils";

describe("storage-utils", () => {
  it("extracts safe extensions", () => {
    expect(getStorageFileExtension("report.PDF")).toBe("pdf");
    expect(getStorageFileExtension("裝修佬 BR 2025-2026.pdf")).toBe("pdf");
    expect(getStorageFileExtension("noext")).toBe("bin");
  });

  it("sanitizes non-ASCII filenames", () => {
    expect(sanitizeStorageFileName("裝修佬 BR 2025-2026.pdf")).toBe("BR_2025-2026.pdf");
    expect(sanitizeStorageFileName("___")).toBe("file");
  });

  it("builds ASCII-only storage keys", () => {
    const key = buildStorageObjectKey("108503a6-b267-478a-8429-9e38cc43c03a", "裝修佬 BR 2025-2026.pdf");
    expect(key).toMatch(
      /^108503a6-b267-478a-8429-9e38cc43c03a\/\d+_[a-z0-9]+\.pdf$/,
    );
    expect(key).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("builds sanitized-name keys without non-ASCII chars", () => {
    const key = buildStorageObjectKeyWithSanitizedName(
      "incomes/project-id",
      "裝修佬 BR 2025-2026.pdf",
    );
    expect(key).toMatch(/^incomes\/project-id\/\d+_[a-z0-9]+_.+\.pdf$/);
    expect(key).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
