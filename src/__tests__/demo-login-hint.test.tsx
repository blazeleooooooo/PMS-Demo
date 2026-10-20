import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { shouldShowDemoLoginHint } from "@/lib/auth/demo-login-hint";
import { DemoLoginHint } from "@/components/auth/demo-login-hint";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "5550100199";

describe("shouldShowDemoLoginHint", () => {
  it("shows on the public demo host", () => {
    expect(
      shouldShowDemoLoginHint({
        hostname: "pms-demo-wheat.vercel.app",
        siteUrl: "https://example.com",
      }),
    ).toBe(true);
  });

  it("shows when NEXT_PUBLIC_SITE_URL points at the demo host", () => {
    expect(
      shouldShowDemoLoginHint({
        hostname: "preview.example.com",
        siteUrl: "https://pms-demo-wheat.vercel.app",
      }),
    ).toBe(true);
  });

  it("shows on local demo hosts", () => {
    expect(shouldShowDemoLoginHint({ hostname: "localhost" })).toBe(true);
    expect(shouldShowDemoLoginHint({ hostname: "127.0.0.1" })).toBe(true);
    expect(
      shouldShowDemoLoginHint({ siteUrl: "http://localhost:3000" }),
    ).toBe(true);
  });

  it("hides on non-demo hosts even if a query string mentions the demo", () => {
    expect(
      shouldShowDemoLoginHint({
        hostname: "app.customer.com",
        siteUrl: "https://app.customer.com/?next=pms-demo",
      }),
    ).toBe(false);
    expect(shouldShowDemoLoginHint({})).toBe(false);
    expect(shouldShowDemoLoginHint({ hostname: "", siteUrl: "" })).toBe(false);
  });
});

describe("DemoLoginHint", () => {
  it("shows the demo email and password in Chinese", () => {
    render(<DemoLoginHint mode="email" onFill={() => {}} />);

    expect(screen.getByText("示範帳戶")).toBeInTheDocument();
    expect(screen.getByText(DEMO_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(DEMO_PASSWORD)).toBeInTheDocument();
    expect(screen.getByText(/改用密碼登入/)).toBeInTheDocument();
  });

  it("fills the demo account from the email step", () => {
    const onFill = vi.fn();
    render(<DemoLoginHint mode="email" onFill={onFill} />);

    fireEvent.click(screen.getByRole("button", { name: "填入並以密碼登入" }));

    expect(onFill).toHaveBeenCalledTimes(1);
  });

  it("fills the demo account on the password step", () => {
    const onFill = vi.fn();
    render(<DemoLoginHint mode="password" onFill={onFill} />);

    fireEvent.click(screen.getByRole("button", { name: "填入示範帳戶" }));

    expect(onFill).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "示範帳戶" })).toBeInTheDocument();
  });
});

describe("LoginPage demo hint", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  async function renderLogin(hostname: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, hostname, href: `https://${hostname}/login` },
    });

    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
      useSearchParams: () => new URLSearchParams(),
    }));
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () => ({
        auth: {
          signInWithOtp: vi.fn(),
          verifyOtp: vi.fn(),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
        },
      }),
    }));

    const { default: LoginPage } = await import("@/app/login/page");
    render(<LoginPage />);
  }

  it("shows how to sign in on the demo host", async () => {
    await renderLogin("pms-demo-wheat.vercel.app");

    expect(await screen.findByText(DEMO_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(DEMO_PASSWORD)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "填入並以密碼登入" }),
    ).toBeInTheDocument();
  });

  it("fills email and password, then opens password login", async () => {
    await renderLogin("localhost");

    fireEvent.click(
      await screen.findByRole("button", { name: "填入並以密碼登入" }),
    );

    expect(screen.getByLabelText("電郵地址")).toHaveValue(DEMO_EMAIL);
    expect(screen.getByLabelText("密碼")).toHaveValue(DEMO_PASSWORD);
    expect(screen.getByRole("heading", { name: "密碼登入" })).toBeInTheDocument();
  });

  it("does not reveal demo credentials on a non-demo host", async () => {
    await renderLogin("app.customer.com");

    expect(screen.getByRole("heading", { name: "歡迎回來" })).toBeInTheDocument();
    expect(screen.queryByText(DEMO_EMAIL)).not.toBeInTheDocument();
    expect(screen.queryByText(DEMO_PASSWORD)).not.toBeInTheDocument();
  });
});
