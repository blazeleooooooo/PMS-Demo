import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
} from "@/lib/auth/demo-login-hint";

export function DemoLoginHint({
  mode,
  onFill,
}: {
  mode: "email" | "password";
  onFill: () => void;
}) {
  return (
    <section
      aria-label="示範帳戶"
      className="mb-5 rounded-xl border border-blue-100 bg-blue-50/80 p-3.5 text-left"
    >
      <p className="text-xs font-semibold tracking-wide text-blue-800">
        示範帳戶
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        {mode === "email"
          ? "這是公開示範環境，請使用以下帳戶登入。若不便收取驗證碼，請改用密碼登入。"
          : "這是公開示範環境。請使用以下示範帳戶的電郵與密碼登入。"}
      </p>
      <dl className="mt-2.5 grid grid-cols-[2.5rem_1fr] gap-x-2 gap-y-1 text-sm">
        <dt className="text-xs leading-6 text-slate-500">電郵</dt>
        <dd className="select-all font-mono text-[13px] font-medium leading-6 text-[#1A2035]">
          {DEMO_LOGIN_EMAIL}
        </dd>
        <dt className="text-xs leading-6 text-slate-500">密碼</dt>
        <dd className="select-all font-mono text-[13px] font-medium leading-6 text-[#1A2035]">
          {DEMO_LOGIN_PASSWORD}
        </dd>
      </dl>
      <button
        type="button"
        onClick={onFill}
        className="mt-3 w-full rounded-lg bg-white py-2 text-sm font-medium text-[#1A2035] ring-1 ring-inset ring-blue-200 transition-colors hover:bg-blue-100/70"
      >
        {mode === "email" ? "填入並以密碼登入" : "填入示範帳戶"}
      </button>
    </section>
  );
}
