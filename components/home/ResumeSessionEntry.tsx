"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/icons/ChevronRightIcon";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { getLastActiveSessionId, pullSharedSessions } from "@/lib/sessions";

interface ResumeSessionEntryProps {
  sectionTitle: string;
}

export function ResumeSessionEntry({ sectionTitle }: ResumeSessionEntryProps) {
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  useEffect(() => {
    void pullSharedSessions().finally(() => setLastSessionId(getLastActiveSessionId()));
  }, []);

  return (
    <section>
      <SectionHeader>{sectionTitle}</SectionHeader>
      <Card>
        {lastSessionId ? (
          <Link
            href={`/chat?sessionId=${encodeURIComponent(lastSessionId)}`}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150 active:bg-accent"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-foreground">从上次停下的地方接着问</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">本地最近一条会话</span>
            </span>
            <ChevronRightIcon />
          </Link>
        ) : (
          <CardHeader>
            <CardTitle className="text-[15px]">暂无本地会话记录</CardTitle>
            <CardDescription>开始一次选品或素材对话后，可以从这里接着进行。</CardDescription>
            <Button asChild size="sm" className="mt-2 w-fit">
              <Link href="/sessions">去会话中心</Link>
            </Button>
          </CardHeader>
        )}
      </Card>
    </section>
  );
}
