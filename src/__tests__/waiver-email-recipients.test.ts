import { describe, expect, it } from "vitest";
import { splitWaiverEmailRecipients } from "@/lib/expense-control-waiver-email";

const TEAM = "team-a";

function staff(partial: {
  id: string;
  role: string;
  email: string | null;
  n_team_type_id: string | null;
}) {
  return {
    name: partial.id,
    work_phone: null,
    ...partial,
  };
}

describe("splitWaiverEmailRecipients", () => {
  it("puts same-team Senior Users in To and others in Cc", () => {
    const result = splitWaiverEmailRecipients(
      [
        staff({
          id: "su",
          role: "Senior User",
          email: "sam@example.com",
          n_team_type_id: TEAM,
        }),
        staff({
          id: "admin",
          role: "Admin",
          email: "admin@example.com",
          n_team_type_id: TEAM,
        }),
        staff({
          id: "other-su",
          role: "Senior User",
          email: "other@example.com",
          n_team_type_id: "team-b",
        }),
      ],
      TEAM
    );
    expect(result.to).toEqual(["sam@example.com"]);
    expect(result.cc.sort()).toEqual(
      ["admin@example.com", "other@example.com"].sort()
    );
  });

  it("skips staff without a usable email", () => {
    const result = splitWaiverEmailRecipients(
      [
        staff({
          id: "su",
          role: "Senior User",
          email: "  ",
          n_team_type_id: TEAM,
        }),
        staff({
          id: "admin",
          role: "Admin",
          email: "admin@example.com",
          n_team_type_id: null,
        }),
      ],
      TEAM
    );
    expect(result.to).toEqual(["admin@example.com"]);
    expect(result.cc).toEqual([]);
  });

  it("promotes first Cc to To when no same-team Senior User has email", () => {
    const result = splitWaiverEmailRecipients(
      [
        staff({
          id: "admin",
          role: "Admin",
          email: "admin@example.com",
          n_team_type_id: TEAM,
        }),
      ],
      TEAM
    );
    expect(result.to).toEqual(["admin@example.com"]);
    expect(result.cc).toEqual([]);
  });
});
