"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";
import { DEMO_LOGIN_USERS } from "@/mock/authUsers";
import type { AppRole } from "@/types/app-settings";
import type { AuthSessionPersisted } from "@/types/auth";

export function useAuth() {
  const [session, setSession, hydrated] = useLocalStorage<AuthSessionPersisted | null>(
    APP_LOCAL_STORAGE_KEYS.authSession,
    null,
  );

  const login = useCallback(
    (
      username: string,
      password: string,
    ): { ok: true; role: AppRole } | { ok: false; message: string } => {
      const id = username.trim();
      const candidate = DEMO_LOGIN_USERS.find((u) => u.username === id && u.password === password);
      if (!candidate) {
        return { ok: false, message: "账号或密码错误" };
      }
      const payload: AuthSessionPersisted = {
        username: candidate.username,
        displayName: candidate.displayName,
        employeeId: candidate.employeeId,
        role: candidate.role,
      };
      setSession(payload);
      return { ok: true, role: candidate.role };
    },
    [setSession],
  );

  const logout = useCallback(() => {
    setSession(null);
  }, [setSession]);

  return {
    session,
    hydrated,
    isLoggedIn: Boolean(session),
    login,
    logout,
  };
}
