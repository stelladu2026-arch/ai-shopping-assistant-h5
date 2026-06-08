"use client";

interface UserBubbleProps {
  text: string;
}

export function UserBubble({ text }: UserBubbleProps) {
  return (
    <div className="flex justify-end px-3 pt-3">
      <div className="max-w-[min(100%,18rem)] rounded-2xl rounded-br-md border border-slate-200/70 bg-white px-3.5 py-2.5 shadow-sm">
        <p className="text-left text-[0.9rem] font-medium leading-relaxed text-slate-800">
          {text}
        </p>
      </div>
    </div>
  );
}
