"use client";

import { Button } from "@/components/ui/button";

interface MomentsComposerBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  /** 发送中：按钮展示 loading 文案 */
  sending?: boolean;
}

export function MomentsComposerBar({
  value,
  onChange,
  onSend,
  disabled,
  sending = false,
}: MomentsComposerBarProps) {
  return (
    <div className="bg-card px-4 pb-3 pt-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="moments-composer-input">
          补充说明
        </label>
        <div className="flex h-11 items-center gap-1 rounded-xl border border-input bg-background pl-3 pr-1 transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring">
          <input
            id="moments-composer-input"
            type="text"
            value={value}
            disabled={disabled || sending}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!disabled && !sending && value.trim()) onSend();
              }
            }}
            placeholder="如：质保多久、便宜点、宽度不超过160厘米"
            className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-[0.88rem] font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled || sending || !value.trim()}
            onClick={onSend}
            className="h-8 min-w-[4.25rem] shrink-0"
          >
            {sending ? (
              <>
                <span
                  className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  aria-hidden
                />
                <span className="max-w-[4.5rem] truncate">发送中</span>
              </>
            ) : (
              "发送"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
