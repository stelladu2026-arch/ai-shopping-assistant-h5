"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface RagComposerBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  fileName?: string | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  /** 发送中：按钮展示 loading 文案 */
  sending?: boolean;
}

export function RagComposerBar({
  value,
  onChange,
  onSend,
  fileName,
  onFileChange,
  disabled,
  sending = false,
}: RagComposerBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-card px-4 pb-3 pt-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="rag-composer-input">
          顾客需求
        </label>
        <div className="flex h-11 items-center gap-1 rounded-xl border border-input bg-background pl-3 pr-1 transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring">
          <input
            id="rag-composer-input"
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
            placeholder="说说预算、宽度、颜色或材质"
            className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0 text-[0.88rem] font-medium text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onFileChange(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[1.05rem] leading-none text-slate-600 transition-colors duration-75 active:bg-slate-200/80 disabled:opacity-50",
              fileName ? "text-brand-700" : "",
            ].join(" ")}
            aria-label="附加图片"
            title="附加图片"
          >
            📷
          </button>
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
        {fileName ? (
          <p className="mt-1 text-[0.65rem] font-medium text-brand-800">已选凭证：{fileName}</p>
        ) : null}
      </div>
    </div>
  );
}
