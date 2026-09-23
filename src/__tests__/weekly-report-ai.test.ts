import { describe, expect, it } from "vitest";
import {
  applyWeeklyReportAiFields,
  extractJsonObject,
  parseMeetingDate,
  parseWeeklyReportAiJson,
} from "@/lib/weekly-report-ai";

describe("parseWeeklyReportAiJson", () => {
  it("reads fields from a JSON object", () => {
    const parsed = parseWeeklyReportAiJson(
      JSON.stringify({
        reply: "已填入會議參與團隊與本期已完成工作。",
        fields: {
          za_meeting_team: "陳大文, 李小明",
          zc_completed_work: "<ul><li>完成天花封板</li></ul>",
          meeting_date: "2026-07-27",
          zb_key_focus: "",
        },
      })
    );

    expect(parsed.reply).toContain("會議參與團隊");
    expect(parsed.fields.za_meeting_team).toBe("陳大文, 李小明");
    expect(parsed.fields.zc_completed_work).toContain("天花封板");
    expect(parsed.fields.meeting_date).toBe("2026-07-27");
    expect(parsed.fields.zb_key_focus).toBeUndefined();
  });

  it("extracts JSON from a markdown fence", () => {
    const parsed = extractJsonObject("```json\n{\"reply\":\"ok\",\"fields\":{}}\n```");
    expect(parsed).toEqual({ reply: "ok", fields: {} });
  });
});

describe("parseMeetingDate", () => {
  it("accepts YYYY-MM-DD and rejects junk", () => {
    expect(parseMeetingDate("2026-07-27")).toBe("2026-07-27");
    expect(parseMeetingDate("27/7/2026")).toBeNull();
    expect(parseMeetingDate("")).toBeNull();
  });
});

describe("applyWeeklyReportAiFields", () => {
  it("fills provided fields and leaves others alone", () => {
    const { next, filledKeys } = applyWeeklyReportAiFields(
      {
        za_meeting_team: "",
        zb_key_focus: "<p>舊重點</p>",
        zc_completed_work: "",
      },
      {
        za_meeting_team: "John Wong",
        zc_completed_work: "<p>完成地台</p>",
      }
    );

    expect(next.za_meeting_team).toBe("John Wong");
    expect(next.zb_key_focus).toBe("<p>舊重點</p>");
    expect(next.zc_completed_work).toBe("<p>完成地台</p>");
    expect(filledKeys).toEqual(["za_meeting_team", "zc_completed_work"]);
  });
});
