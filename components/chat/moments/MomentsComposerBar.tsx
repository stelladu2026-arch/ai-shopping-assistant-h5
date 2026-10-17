"use client";

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
    <div className="bg-white pt-2">
      <div className="px-3">
        <label className="sr-only" htmlFor="moments-composer-input">
          补充说明或修改要求
        </label>
        <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 pl-3 pr-1.5 transition-shadow duration-75 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
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
      </div>
    </div>
  );
}
