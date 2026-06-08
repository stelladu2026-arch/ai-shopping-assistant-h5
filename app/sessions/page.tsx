"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { MobileShell } from "@/components/home/MobileShell";
import { SessionsCenterView } from "@/components/sessions/SessionsCenterView";
import { buildBottomTabItems } from "@/lib/navigation/bottomTabItems";

export default function SessionsPage() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const onToast = useCallback((msg: string) => setToastMsg(msg), []);

  const bottomTabs = useMemo(() => buildBottomTabItems("sessions"), []);

  return (
    <MobileShell
      footer={
        <div className="border-t border-slate-200/50 bg-white/95 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]">
          <BottomTabBar items={bottomTabs} />
        </div>
      }
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain tech-scroll">
        {toastMsg ? (
          <div
            className="pointer-events-none fixed left-1/2 top-[max(5.5rem,env(safe-area-inset-top,0px)+4rem)] z-[300] -translate-x-1/2 rounded-full bg-slate-900/88 px-4 py-2 text-[0.78rem] font-medium text-white shadow-lg"
            role="status"
          >
            {toastMsg}
          </div>
        ) : null}
        <SessionsCenterView onToast={onToast} />
      </div>
    </MobileShell>
  );
}
