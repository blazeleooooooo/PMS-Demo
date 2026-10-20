"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { shouldShowDemoLoginHint } from "@/lib/auth/demo-login-hint";

const DISMISS_KEY = "acme-demo-guide-dismissed";

const STOPS = [
  {
    href: "/projects/bwa",
    label: "Project",
    note: "Northwind Cafe counter",
  },
  {
    href: "/proposals",
    label: "Pitching",
    note: "Sample cafe enquiry",
  },
  {
    href: "/news",
    label: "項目新聞",
    note: "Project news",
  },
] as const;

export function DemoWelcomeBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    setOpen(
      shouldShowDemoLoginHint({
        hostname: window.location.hostname,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      }),
    );
  }, []);

  if (!open) return null;

  return (
    <section
      aria-label="示範導覽"
      className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-700">
            示範導覽 · Demo guide
          </p>
          <h2 className="mt-1 text-base font-semibold text-gray-900">
            先看這三處
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            這是公開示範環境，客戶、員工與金額全部為虛構，沒有真實客戶。
            <span className="mt-0.5 block text-gray-500">
              Synthetic data only. No real clients.
            </span>
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉示範導覽"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // The banner still closes for this view.
            }
            setOpen(false);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
        >
          <X className="h-3.5 w-3.5" />
          知道了
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {STOPS.map((stop) => (
          <Link
            key={stop.href}
            href={stop.href}
            className="rounded-xl border border-blue-100 bg-white px-3 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/60"
          >
            <span className="block text-sm font-semibold text-[#1A2035]">
              {stop.label}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{stop.note}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
