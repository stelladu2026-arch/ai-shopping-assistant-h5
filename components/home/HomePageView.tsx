"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { ActionCard } from "@/components/home/ActionCard";
import { BottomTabBar } from "@/components/home/BottomTabBar";
import { MobileShell } from "@/components/home/MobileShell";
import { QuestionChip } from "@/components/home/QuestionChip";
import { ResumeSessionEntry } from "@/components/home/ResumeSessionEntry";
import { SettingsDrawer } from "@/components/home/SettingsDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";
import { buildBottomTabItems } from "@/lib/navigation/bottomTabItems";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { HomePageData } from "@/types/home";

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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain tech-scroll">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">
                {data.title}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.profile.displayName} · {data.profile.employeeId}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
              title="设置"
            >
              <Settings />
            </Button>
          </header>

          <div className="space-y-8 px-4 py-5">
            {settingsHydrated && isManager ? (
              <Card className="border-primary/20 bg-accent">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle>店长工作台</CardTitle>
                    <Badge>店长</Badge>
                  </div>
                  <CardDescription>
                    底部进入「会话中心」后默认展示本店导购会话摘要与门店指标；也可切换「我的」查看个人会话。
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/sessions">前往会话中心</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <ResumeSessionEntry sectionTitle={data.sectionTitles.resumeSession} />

            <section>
              <SectionHeader>{data.sectionTitles.quickActions}</SectionHeader>
              <Card>
                {data.quickActions.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <ActionCard item={item} />
                  </div>
                ))}
              </Card>
            </section>

            <section>
              <SectionHeader>{data.sectionTitles.commonQuestions}</SectionHeader>
              <Card>
                {data.commonQuestions.slice(0, 4).map((item, index) => (
                  <div key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <QuestionChip item={item} />
                  </div>
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
