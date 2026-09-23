import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatHongKongDate,
  formatHongKongDateTime,
  formatTimestamp,
} from "@/lib/date-utils";

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

describe("Hong Kong timestamp display", () => {
  it("renders a UTC instant as Asia/Hong_Kong wall clock", () => {
    expect(compact(formatHongKongDateTime("2026-09-09T06:28:44.928Z"))).toBe(
      "09/09/2026 下午02:28"
    );
  });

  it("does not treat HK wall clock stored as UTC as local browser time", () => {
    expect(compact(formatHongKongDateTime("2026-09-09T14:28:44.928Z"))).toBe(
      "09/09/2026 下午10:28"
    );
  });

  it("formatTimestamp also pins Asia/Hong_Kong", () => {
    expect(formatTimestamp("2026-09-09T06:28:44.928Z")).toContain("下午02:28");
  });

  it("formatDate uses the Hong Kong calendar day across UTC midnight", () => {
    // 16:00 UTC = 00:00 next day HKT
    expect(formatDate("2026-09-09T16:00:00.000Z")).toContain("9月10日");
  });

  it("formatDateShort and formatHongKongDate pin Asia/Hong_Kong", () => {
    expect(formatDateShort("2026-09-09T16:00:00.000Z")).toBe("2026/09/10");
    expect(formatHongKongDate("2026-09-09T16:00:00.000Z")).toBe("2026/09/10");
  });

  it("formatHongKongDate keeps YYYY-MM-DD calendar dates unchanged", () => {
    expect(formatHongKongDate("2026-09-09")).toBe("2026/09/09");
  });
});
