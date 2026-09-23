import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone, parseDotEnv } from "@/lib/whatsapp";

describe("normalizeWhatsAppPhone", () => {
  it("prefixes 852 on 8-digit Hong Kong numbers", () => {
    expect(normalizeWhatsAppPhone("62634277")).toBe("85262634277");
    expect(normalizeWhatsAppPhone("6263 4277")).toBe("85262634277");
    expect(normalizeWhatsAppPhone("+852 6263 4277")).toBe("85262634277");
  });

  it("leaves numbers that already include 852 unchanged", () => {
    expect(normalizeWhatsAppPhone("85262634277")).toBe("85262634277");
    expect(normalizeWhatsAppPhone("+85262634277")).toBe("85262634277");
  });

  it("returns empty for blank input", () => {
    expect(normalizeWhatsAppPhone("")).toBe("");
    expect(normalizeWhatsAppPhone("   ")).toBe("");
  });

  it("does not invent a country code for non-HK lengths", () => {
    expect(normalizeWhatsAppPhone("13612345678")).toBe("13612345678");
  });
});

describe("parseDotEnv", () => {
  it("reads KEY=value and strips quotes", () => {
    const parsed = parseDotEnv(
      [
        "# comment",
        "WHATSAPP_PHONE_NUMBER_ID=123",
        "WHATSAPP_API_VERSION=\"v25.0\"",
        "",
        "OTHER=keep",
      ].join("\n")
    );
    expect(parsed.WHATSAPP_PHONE_NUMBER_ID).toBe("123");
    expect(parsed.WHATSAPP_API_VERSION).toBe("v25.0");
    expect(parsed.OTHER).toBe("keep");
  });
});
