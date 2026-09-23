"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Truck, Construction, LogOut } from "lucide-react";

export default function SupplierPortalPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-6">
          <Truck className="w-8 h-8 text-amber-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1A2035] mb-2">
          供應商入口
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Supplier Portal
        </p>

        {/* Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Construction className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h2 className="text-amber-800 font-semibold text-sm">
              頁面建設中
            </h2>
          </div>
          <p className="text-amber-700 text-sm leading-relaxed">
            供應商入口正在開發中，目前暫時無法使用。
            <br />
            如有任何疑問，請聯絡您的項目經理。
          </p>
        </div>

        {/* User info */}
        {profile && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1">登入帳號</p>
            <p className="text-sm font-medium text-slate-700">
              {profile.email}
            </p>
            <p className="text-xs text-slate-400 mt-2 mb-1">帳號類型</p>
            <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              {profile.user_type || "Supplier"}
            </span>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          登出
        </button>
      </div>
    </div>
  );
}
