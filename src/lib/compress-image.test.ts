import { describe, expect, it } from "vitest";
import { computeScaledDimensions, COMPRESS_THRESHOLD_BYTES } from "./compress-image";

describe("computeScaledDimensions", () => {
  it("keeps size when under max dimension", () => {
    expect(computeScaledDimensions(1920, 1080, 4096)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales down when longest edge exceeds max", () => {
    const result = computeScaledDimensions(8000, 4000, 4096);
    expect(result.width).toBe(4096);
    expect(result.height).toBe(2048);
  });

  it("applies scale factor before max-dimension clamp", () => {
    const result = computeScaledDimensions(4000, 2000, 4096, 0.5);
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1000);
  });
});

describe("COMPRESS_THRESHOLD_BYTES", () => {
  it("is 5 MB", () => {
    expect(COMPRESS_THRESHOLD_BYTES).toBe(5 * 1024 * 1024);
  });
});
