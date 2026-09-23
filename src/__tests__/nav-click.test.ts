import { describe, expect, it, vi } from "vitest";
import { handleNavClick, isModifiedClick } from "@/lib/nav-click";

describe("isModifiedClick", () => {
  it("is false without an event", () => {
    expect(isModifiedClick()).toBe(false);
    expect(isModifiedClick(null)).toBe(false);
  });

  it("is true for Ctrl, Cmd, Shift, or middle click", () => {
    expect(isModifiedClick({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(isModifiedClick({ ctrlKey: false, metaKey: true })).toBe(true);
    expect(isModifiedClick({ ctrlKey: false, metaKey: false, shiftKey: true })).toBe(true);
    expect(isModifiedClick({ ctrlKey: false, metaKey: false, button: 1 })).toBe(true);
  });

  it("is false for a plain left click", () => {
    expect(
      isModifiedClick({ ctrlKey: false, metaKey: false, shiftKey: false, button: 0 })
    ).toBe(false);
  });
});

describe("handleNavClick", () => {
  it("opens a new tab on Ctrl+click and does not push", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const push = vi.fn();
    const preventDefault = vi.fn();

    handleNavClick("/clients/1", { ctrlKey: true, metaKey: false, preventDefault }, push);

    expect(preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith("/clients/1", "_blank", "noopener,noreferrer");
    expect(push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("pushes on a plain click", () => {
    const push = vi.fn();
    handleNavClick("/clients/1", { ctrlKey: false, metaKey: false, button: 0 }, push);
    expect(push).toHaveBeenCalledWith("/clients/1");
  });
});
