"use client";

import React from "react";
import { Clock, LogOut, RefreshCw, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function PendingApprovalPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-5">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">帳戶等待審批中</h1>
        <p className="text-sm text-gray-500 mt-1">Account Pending Approval</p>

        <p className="text-sm text-gray-600 mt-5 leading-relaxed">
          你的帳戶已成功建立，但尚未獲得管理員批准。在管理員完成審批前，你暫時無法使用本系統。
        </p>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          Your account has been created but is awaiting administrator approval.
          You&apos;ll be able to access the system once an admin approves it.
        </p>

        {/* Logged-in email */}
        {user?.email && (
          <div className="flex items-center justify-center gap-2 mt-5 px-4 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            {user.email}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bw-blue text-white text-sm font-medium hover:bg-bw-blue/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新檢查審批狀態
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          如有疑問，請聯絡系統管理員。
        </p>
      </div>
    </div>
  );
}
