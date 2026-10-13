"use client";

import { useRef } from "react";

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
    <div className="bg-white pt-2">
      <div className="px-3">
        <label className="sr-only" htmlFor="rag-composer-input">
          顾客需求
        </label>
        <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 pl-3 pr-1.5 transition-shadow duration-75 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
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
          <button
            type="button"
            disabled={disabled || sending || !value.trim()}
            onClick={onSend}
            className="flex h-8 min-w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-600 px-2 text-[0.78rem] font-bold text-white shadow-sm transition-colors duration-75 active:bg-brand-700 disabled:opacity-40"
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
          </button>
        </div>
        {fileName ? (
          <p className="mt-1 text-[0.65rem] font-medium text-brand-800">已选凭证：{fileName}</p>
        ) : null}
      </div>
    </div>
  );
}
