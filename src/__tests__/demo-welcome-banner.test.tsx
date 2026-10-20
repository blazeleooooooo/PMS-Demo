import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DemoWelcomeBanner } from "@/components/dashboard/demo-welcome-banner";

describe("DemoWelcomeBanner", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  function setHostname(hostname: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, hostname },
    });
  }

  it("points a visitor at synthetic projects, pitching, and news", async () => {
    setHostname("pms-demo-wheat.vercel.app");
    render(<DemoWelcomeBanner />);

    expect(await screen.findByRole("region", { name: "示範導覽" })).toBeInTheDocument();
    expect(screen.getByText(/Synthetic data only/i)).toBeInTheDocument();
    expect(screen.getByText(/沒有真實客戶/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Northwind Cafe counter/ })).toHaveAttribute(
      "href",
      "/projects/bwa",
    );
    expect(screen.getByRole("link", { name: /Sample cafe enquiry/ })).toHaveAttribute(
      "href",
      "/proposals",
    );
    expect(screen.getByRole("link", { name: /項目新聞/ })).toHaveAttribute(
      "href",
      "/news",
    );
    expect(screen.getByText(/Northwind Cafe/)).toBeInTheDocument();
  });

  it("can be dismissed for the rest of the browser session", async () => {
    setHostname("localhost");
    const { unmount } = render(<DemoWelcomeBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "關閉示範導覽" }));

    expect(screen.queryByRole("region", { name: "示範導覽" })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("acme-demo-guide-dismissed")).toBe("1");

    unmount();
    render(<DemoWelcomeBanner />);
    expect(screen.queryByRole("region", { name: "示範導覽" })).not.toBeInTheDocument();
  });

  it("stays hidden on a non-demo host", async () => {
    setHostname("app.customer.com");
    render(<DemoWelcomeBanner />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("region", { name: "示範導覽" })).not.toBeInTheDocument();
  });
});
