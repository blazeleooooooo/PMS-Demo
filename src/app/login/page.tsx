"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSafeReturnTo } from "@/lib/auth/safe-return-to";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

type LoginStep = "email" | "otp" | "password_fallback" | "redirecting";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("return_to"));
  const supabase = createClient();

  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [hasAttemptedOtp, setHasAttemptedOtp] = useState(false);
  const otpInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Check for callback error
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "auth_callback_error") {
      setError("登入失敗，請重試。");
    }
    // Show session expired / inactive staff messages
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      setError("您的登入已超過 7 天，為安全起見請重新登入。");
    } else if (reason === "staff_inactive") {
      setError("此職員帳戶已停用，無法登入。請聯繫管理員。");
    }
  }, [searchParams]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(
        () => setResendCountdown(resendCountdown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // ──────────────────────────────────────────────
  // Send OTP verification code to email (Supabase native)
  // ──────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setHasAttemptedOtp(true);

    try {
      // First validate user exists in our system
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate_user",
          email,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "此電郵地址未註冊");
        setIsLoading(false);
        return;
      }

      // Store user_type for later redirect
      setUserType(data.user_type);

      // Use Supabase's native signInWithOtp — this actually sends a 6-digit code email
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: false, // Don't create new users, only existing ones
        },
      });

      if (otpError) {
        // If "Signups not allowed" it means user doesn't exist in auth
        // We need to ensure the auth user exists first
        if (
          otpError.message.includes("Signups not allowed") ||
          otpError.message.includes("not allowed")
        ) {
          // Ask server to ensure auth user exists, then retry
          const ensureRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "ensure_auth_user",
              email,
            }),
          });

          const ensureData = await ensureRes.json();
          if (!ensureData.success) {
            setError(ensureData.error || "發送驗證碼失敗");
            setIsLoading(false);
            return;
          }

          // Retry with shouldCreateUser: true since we just ensured they exist
          const { error: retryError } = await supabase.auth.signInWithOtp({
            email: email.toLowerCase().trim(),
            options: {
              shouldCreateUser: true,
            },
          });

          if (retryError) {
            const msg = retryError.message.includes("rate limit")
              ? "發送次數過多，請稍後再試（建議等待60分鐘）"
              : "發送驗證碼失敗: " + retryError.message;
            setError(msg);
            setIsLoading(false);
            return;
          }
        } else {
          const msg = otpError.message.includes("rate limit")
            ? "發送次數過多，請稍後再試（建議等待60分鐘）"
            : "發送驗證碼失敗: " + otpError.message;
          setError(msg);
          setIsLoading(false);
          return;
        }
      }

      setStep("otp");
      setResendCountdown(60);
      setIsLoading(false);
    } catch {
      setError("發送驗證碼失敗，請重試。");
      setIsLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // Verify OTP code (Supabase native)
  // ──────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join("");
    if (code.length !== 8) {
      setError("請輸入完整的 8 位數驗證碼");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use Supabase's native verifyOtp — this also establishes the session
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: email.toLowerCase().trim(),
          token: code,
          type: "email",
        });

      if (verifyError) {
        setError(
          verifyError.message === "Token has expired or is invalid"
            ? "驗證碼不正確或已過期，請重新發送"
            : "驗證碼錯誤: " + verifyError.message,
        );
        setIsLoading(false);
        return;
      }

      if (!verifyData?.session) {
        setError("無法建立登入會話，請重試");
        setIsLoading(false);
        return;
      }

      // Session is now established! Determine redirect
      setStep("redirecting");

      // Re-validate after OTP (blocks Inactive staff even if status changed mid-flow)
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate_user",
          email,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        await supabase.auth.signOut();
        setError(data.error || "登入失敗");
        setStep("email");
        setIsLoading(false);
        return;
      }
      setUserType(data.user_type);
      redirectByUserType(data.user_type);
    } catch {
      setError("驗證失敗，請重試。");
      setIsLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // Resend OTP (Supabase native)
  // ──────────────────────────────────────────────
  const handleResendOtp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        const msg = otpError.message.includes("rate limit")
          ? "發送次數過多，請稍後再試（建議等待60分鐘）"
          : "重新發送失敗: " + otpError.message;
        setError(msg);
        setIsLoading(false);
        return;
      }

      setResendCountdown(60);
      setOtpCode(["", "", "", "", "", "", "", ""]);
      setIsLoading(false);
    } catch {
      setError("重新發送失敗，請重試。");
      setIsLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // Password fallback login (Supabase native)
  // ──────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Validate password server-side & ensure auth user has it set
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login_password",
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "登入失敗");
        setIsLoading(false);
        return;
      }

      // Step 2: Now sign in with Supabase native — session established
      // For OAuth-only users (e.g., first-time Google login), the email identity
      // may have just been created server-side. Retry once after a short delay if needed.
      let signInData = null;
      let signInError = null;
      
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
        signInData = result.data;
        signInError = result.error;
        
        if (!signInError) break;
        
        // If first attempt fails, wait briefly and retry (identity propagation)
        if (attempt === 0 && signInError.message === "Invalid login credentials") {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "密碼不正確，請重試"
            : "登入失敗: " + signInError.message,
        );
        setIsLoading(false);
        return;
      }

      if (!signInData?.session) {
        setError("無法建立登入會話，請重試");
        setIsLoading(false);
        return;
      }

      // Session established! Determine redirect
      setStep("redirecting");
      setUserType(data.user_type);
      redirectByUserType(data.user_type);
    } catch {
      setError("登入失敗，請重試。");
      setIsLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // OTP Input handlers (6 digits)
  // ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // only last char
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 7) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 8);
    const newOtp = [...otpCode];
    for (let i = 0; i < 8; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtpCode(newOtp);
    // Focus last filled or last input
    const lastIdx = Math.min(pasted.length, 7);
    otpInputRefs.current[lastIdx]?.focus();
  };

  const redirectByUserType = (type: string | null) => {
    // Set 7-day session login timestamp cookie
    document.cookie = `pms_last_login_at=${Date.now()}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;

    void fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_login", email }),
    }).catch(() => {
      // Non-blocking; cron still falls back to auth.users.last_sign_in_at.
    });

    if (returnTo) {
      router.push(returnTo);
      return;
    }

    switch (type) {
      case "Staff":
        router.push("/");
        break;
      case "Supplier":
        router.push("/portal/supplier");
        break;
      case "Customer":
        router.push("/portal/customer");
        break;
      default:
        router.push("/");
        break;
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#1A2035] relative overflow-x-hidden overflow-y-auto py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-bold text-lg">AC</span>
            </div>
            <div className="text-left">
              <h1
                className="text-white text-xl font-bold tracking-tight"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Acme Project OS
              </h1>
              <p className="text-slate-400 text-xs">Demo</p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-5 sm:p-8">
          {/* ─── STEP: Email Input ────────────────── */}
          {step === "email" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-[#1A2035] text-lg font-semibold">
                  歡迎回來
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  輸入電郵地址以接收驗證碼
                </p>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    電郵地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onInput={(e) =>
                        setEmail((e.target as HTMLInputElement).value)
                      }
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Password fallback when error occurs after OTP attempt */}
                {error && hasAttemptedOtp && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700 mb-2">
                      驗證碼發送遇到問題？可改用密碼登入
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("password_fallback");
                        setError(null);
                      }}
                      className="w-full py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      改用密碼登入
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-[#1A2035] text-white font-medium text-sm hover:bg-[#2A3045] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      發送中...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      發送驗證碼
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ─── STEP: OTP Verification ─────────── */}
          {step === "otp" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-3">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-[#1A2035] text-lg font-semibold">
                  輸入驗證碼
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  已發送 8 位數驗證碼至
                </p>
                <p className="text-slate-700 text-sm font-medium mt-0.5">
                  {email}
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {/* 8-digit OTP inputs */}
                <div
                  className="flex justify-center gap-1 sm:gap-1.5"
                  onPaste={handleOtpPaste}
                >
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      autoFocus={index === 0}
                      className="w-7 h-10 sm:w-9 sm:h-12 text-center text-base sm:text-lg font-bold rounded-lg sm:rounded-xl border border-slate-200 text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  ))}
                </div>

                {/* Resend */}
                <div className="text-center">
                  {resendCountdown > 0 ? (
                    <p className="text-slate-400 text-sm">
                      {resendCountdown} 秒後可重新發送
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="text-blue-600 text-sm hover:text-blue-700 font-medium disabled:opacity-50"
                    >
                      重新發送驗證碼
                    </button>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || otpCode.join("").length !== 8}
                  className="w-full py-2.5 rounded-xl bg-[#1A2035] text-white font-medium text-sm hover:bg-[#2A3045] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      驗證中...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      驗證並登入
                    </>
                  )}
                </button>

                {/* Divider before fallback */}
                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center pt-2">
                    <div className="w-full border-t border-slate-100" />
                  </div>
                  <div className="relative flex justify-center text-xs pt-2">
                    <span className="bg-white px-3 text-slate-400">
                      遇到問題？
                    </span>
                  </div>
                </div>

                {/* Password fallback link */}
                <button
                  type="button"
                  onClick={() => {
                    setStep("password_fallback");
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  改用密碼登入
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtpCode(["", "", "", "", "", "", "", ""]);
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← 更改電郵地址
                </button>
              </form>
            </>
          )}

          {/* ─── STEP: Password Fallback ─────────── */}
          {step === "password_fallback" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mb-3">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <h2 className="text-[#1A2035] text-lg font-semibold">
                  密碼登入
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  使用密碼作為替代登入方式
                </p>
              </div>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="email-fallback"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    電郵地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="email-fallback"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    密碼
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="輸入您的密碼"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50 text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-[#1A2035] text-white font-medium text-sm hover:bg-[#2A3045] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      登入中...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      登入
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("otp");
                    setPassword("");
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← 返回驗證碼登入
                </button>
              </form>
            </>
          )}

          {/* ─── STEP: Redirecting ──────────────── */}
          {step === "redirecting" && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <h2 className="text-[#1A2035] text-lg font-semibold">
                正在登入...
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                正在跳轉至您的工作區
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Acme Project OS. Demo only.
        </p>
      </div>
    </div>
  );
}
