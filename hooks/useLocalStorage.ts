"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 客户端 localStorage 双向绑定（SSR 首帧使用 initial，挂载后再 hydrate）。
 * 值需可 JSON 序列化。
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null && raw !== "") {
        setState(JSON.parse(raw) as T);
      }
    } catch {
      /* ignore parse errors */
    }
    setHydrated(true);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota / private mode */
        }
        return next;
      });
    },
    [key],
  );

  return [state, setValue, hydrated] as const;
}
