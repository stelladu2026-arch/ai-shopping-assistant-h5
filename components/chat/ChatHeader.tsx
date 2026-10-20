"use client";

import Link from "next/link";
import { ChevronLeft, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onOpenSessionHub: () => void;
}

export function ChatHeader({ onOpenSessionHub }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur-sm">
      <Button asChild variant="ghost" size="icon" className="shrink-0">
        <Link href="/sessions" aria-label="返回会话中心">
          <ChevronLeft />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">AI导购助手</h1>
        <p className="text-xs text-muted-foreground">选品与素材在同一条会话里</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={onOpenSessionHub}
        aria-label="会话侧栏"
        title="会话"
      >
        <LayoutGrid />
      </Button>
    </header>
  );
}
