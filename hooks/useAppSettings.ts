"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";
import { DEFAULT_STORE_ID, getStoreNameById } from "@/mock/stores";
import type { AppRole, AppUserSettingsPersisted } from "@/types/app-settings";

const DEFAULT_SETTINGS: AppUserSettingsPersisted = {
  role: "guide",
  storeId: DEFAULT_STORE_ID,
};

/**
 * 导购 / 店长角色与当前演示门店（localStorage）。
 */
export function useAppSettings() {
  const [settings, setSettings, hydrated] = useLocalStorage<AppUserSettingsPersisted>(
    APP_LOCAL_STORAGE_KEYS.appUserSettings,
    DEFAULT_SETTINGS,
  );

  const storeName = useMemo(() => getStoreNameById(settings.storeId), [settings.storeId]);

  const setRole = useCallback(
    (role: AppRole) => {
      setSettings((prev) => ({ ...prev, role }));
    },
    [setSettings],
  );

  const setStoreId = useCallback(
    (storeId: string) => {
      setSettings((prev) => ({ ...prev, storeId }));
    },
    [setSettings],
  );

  const roleLabel = settings.role === "manager" ? "店长" : "导购";

  return {
    role: settings.role,
    storeId: settings.storeId,
    storeName,
    setRole,
    setStoreId,
    hydrated,
    roleLabel,
    isManager: settings.role === "manager",
    isGuide: settings.role === "guide",
  };
}
