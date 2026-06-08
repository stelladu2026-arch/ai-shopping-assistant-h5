"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionCard } from "@/components/home/ActionCard";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { Card } from "@/components/home/Card";
import { MobileShell } from "@/components/home/MobileShell";
import { QuestionChip } from "@/components/home/QuestionChip";
import { ResumeSessionEntry } from "@/components/home/ResumeSessionEntry";
import { SettingsDrawer } from "@/components/home/SettingsDrawer";
import { TopNav } from "@/components/home/TopNav";
import { buildBottomTabItems } from "@/lib/navigation/bottomTabItems";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { HomePageData } from "@/types/home";

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-4 w-0.5 flex-shrink-0 rounded-full bg-brand-600" aria-hidden />
        <h2 className="text-[0.9rem] font-semibold leading-snug tracking-wide text-slate-500 sm:text-[0.95rem]">
          {children}
        </h2>
      </div>
    </div>
  );
}

interface HomePageViewProps {
  data: HomePageData;
}

export function HomePageView({ data }: HomePageViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isManager, hydrated: settingsHydrated } = useAppSettings();

  const bottomTabs = useMemo(() => buildBottomTabItems("home"), []);

  return (
    <>
      <MobileShell footer={<BottomTabBar items={bottomTabs} />}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges] tech-scroll">
        <div className="px-3 pb-6 pt-0">
          <TopNav
            title={data.title}
            endSlot={
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-2 ring-white shadow-sm transition-colors duration-75 active:bg-slate-200"
                aria-label="设置"
                title="设置"
              >
                <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            }
          />

          {settingsHydrated && isManager ? (
            <div className="mt-3 rounded-xl border border-brand-200/70 bg-brand-50/90 px-3 py-2.5 shadow-sm ring-1 ring-brand-900/[0.04]">
              <p className="text-[0.78rem] font-bold text-brand-950">店长工作台</p>
              <p className="mt-0.5 text-[0.72rem] leading-relaxed text-slate-600">
                底部进入「会话中心」后默认展示本店导购会话摘要与门店指标；也可切换「我的」查看个人会话。
              </p>
              <Link
                href="/sessions"
                className="mt-2 inline-flex items-center text-[0.78rem] font-bold text-brand-700 active:underline"
              >
                前往会话中心 ›
              </Link>
            </div>
          ) : null}

          <ResumeSessionEntry sectionTitle={data.sectionTitles.resumeSession} />

          <section className="mt-7 sm:mt-8">
            <SectionTitle>{data.sectionTitles.quickActions}</SectionTitle>
            <div className="overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surfaceLg ring-1 ring-slate-900/[0.04]">
              {data.quickActions.map((item) => (
                <ActionCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="mt-7 sm:mt-8">
            <SectionTitle>{data.sectionTitles.commonQuestions}</SectionTitle>
            <Card className="p-0">
              {data.commonQuestions.slice(0, 4).map((item) => (
                <QuestionChip key={item.id} item={item} />
              ))}
            </Card>
          </section>
        </div>
        </div>
      </MobileShell>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={data.profile} />
    </>
  );
}
