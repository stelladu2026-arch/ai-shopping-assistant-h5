"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ChatSessionRecord, SessionSceneCategory } from "@/types/session";
import { deriveSessionCategoryLabel, renameSessionCustomer, sessionMessagesCombined } from "@/lib/sessions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SessionListItemProps {
  session: ChatSessionRecord;
  /** 用户确认删除前由上层弹出二次确认 */
  onDeleteClick: () => void;
  onRenamed: () => void;
}

const categoryBadgeClass: Record<SessionSceneCategory, string> = {
  产品: "bg-emerald-50 text-emerald-800 ring-emerald-100/90",
  活动: "bg-amber-50 text-amber-900 ring-amber-100/90",
  文案: "bg-brand-50 text-brand-800 ring-brand-100/80",
  对比: "bg-violet-50 text-violet-900 ring-violet-100/90",
};

export function SessionListItem({ session, onDeleteClick, onRenamed }: SessionListItemProps) {
  const href = `/chat?sessionId=${encodeURIComponent(session.id)}`;
  const preview = session.lastPreview.trim() || "（暂无摘要）";
  const category = deriveSessionCategoryLabel(sessionMessagesCombined(session), session.sceneMode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.customerName || "");

  return (
    <li>
      <Card className="px-4 py-3.5">
        <div className="flex items-start gap-2">
          <Link href={href} className="min-w-0 flex-1 rounded-lg transition-colors active:opacity-80">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-foreground">
                {session.title}
              </h3>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatRelativeTime(session.updatedAt)}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[13px] leading-relaxed text-muted-foreground">{preview}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={categoryBadgeClass[category]} variant="secondary">
                {category}
              </Badge>
              {session.customerName ? <Badge variant="muted">客户</Badge> : null}
            </div>
          </Link>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onDeleteClick} aria-label="删除会话">
            <Trash2 />
          </Button>
        </div>
        {editing ? (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              renameSessionCustomer(session.id, draft);
              setEditing(false);
              onRenamed();
            }}
          >
            <Input
              aria-label="客户名称"
              maxLength={20}
              value={draft}
              placeholder="客户名称"
              onChange={(event) => setDraft(event.target.value)}
              className="h-9"
            />
            <Button type="submit" size="sm">
              保存
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-8 px-0 text-muted-foreground"
            onClick={() => {
              setDraft(session.customerName || "");
              setEditing(true);
            }}
          >
            {session.customerName ? "修改客户名" : "改成客户名"}
          </Button>
        )}
      </Card>
    </li>
  );
}
