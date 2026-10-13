"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";
import { MemoryPanel } from "@/components/home/MemoryPanel";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/hooks/useAuth";
import type { HomeProfileInfo } from "@/types/home";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** 未登录时在侧栏展示的占位信息（演示） */
  profile: HomeProfileInfo;
}

function roleBadgeText(role: "guide" | "manager") {
  return role === "manager" ? "店长" : "导购";
}

export function SettingsDrawer({ open, onClose, profile }: SettingsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const { roleLabel, hydrated: settingsHydrated, setRole } = useAppSettings();
  const { session, hydrated: authHydrated, login, logout, isLoggedIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoginError(null);
  }, [open]);

  const hydrated = settingsHydrated && authHydrated;

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const result = login(username, password);
    if (result.ok) {
      setRole(result.role);
      setPassword("");
      setUsername("");
      return;
    }
    setLoginError(result.message);
  };

  const handleLogout = () => {
    logout();
    setPassword("");
    setLoginError(null);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <PhoneFrameOverlay onBackdropClick={onClose} ariaLabel="设置">
      <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,92%)] max-w-[320px] flex-col bg-white shadow-[-8px_0_32px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">
          <span className="text-[0.9rem] font-bold text-slate-900">设置</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
            aria-label="关闭"
          >
            <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 tech-scroll">
          {!hydrated ? (
            <p className="text-[0.82rem] font-medium text-slate-500">加载中…</p>
          ) : isLoggedIn && session ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-[0.9rem] font-bold text-brand-950 shadow-inner ring-2 ring-white"
                  aria-hidden
                >
                  {session.displayName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[0.92rem] font-bold text-slate-900">{session.displayName}</p>
                    <span className="shrink-0 rounded-full border border-slate-200/90 bg-white px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                      {roleBadgeText(session.role)}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.72rem] font-medium text-slate-500">工号 {session.employeeId}</p>
                  <p className="mt-0.5 text-[0.65rem] font-medium text-slate-400">账号 {session.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 w-full rounded-xl border border-slate-200/90 bg-white py-2.5 text-[0.82rem] font-semibold text-slate-700 shadow-sm transition-colors duration-75 active:bg-slate-100"
              >
                退出登录
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-[0.72rem] font-medium leading-relaxed text-slate-500">
                登录后可同步演示身份（导购 / 店长）。未登录时首页仍可使用访客体验数据。
              </p>
              <form onSubmit={handleLogin} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <p className="mb-2.5 text-[0.78rem] font-bold text-slate-800">账号登录</p>
                <label className="block">
                  <span className="sr-only">账号</span>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="账号"
                    className="mb-2 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-[0.85rem] font-medium text-slate-900 outline-none ring-brand-500/0 transition-shadow duration-75 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">密码</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码"
                    className="mb-2 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-[0.85rem] font-medium text-slate-900 outline-none ring-brand-500/0 transition-shadow duration-75 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>
                {loginError ? (
                  <p className="mb-2 text-[0.72rem] font-semibold text-red-600" role="alert">
                    {loginError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={!username.trim() || !password}
                  className="w-full rounded-xl bg-brand-600 py-2.5 text-[0.82rem] font-bold text-white shadow-sm transition-colors duration-75 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  登录
                </button>
                <p className="mt-2.5 text-[0.65rem] leading-relaxed text-slate-500">
                  本地演示身份，不连接外部账号，页面不填写模型密钥。
                </p>
                <MemoryPanel />
              </form>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-200/90 bg-white/80 px-3 py-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.9rem] font-bold text-slate-500 shadow-inner ring-2 ring-white"
                  aria-hidden
                >
                  {profile.displayName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold text-slate-500">访客预览</p>
                  <p className="mt-0.5 truncate text-[0.88rem] font-bold text-slate-800">{profile.displayName}</p>
                  <p className="mt-0.5 text-[0.68rem] font-medium text-slate-500">工号 {profile.employeeId}</p>
                  <span className="mt-1 inline-block rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </PhoneFrameOverlay>,
    document.body,
  );
}
