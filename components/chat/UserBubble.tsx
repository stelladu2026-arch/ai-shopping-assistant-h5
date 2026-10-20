"use client";

interface UserBubbleProps {
  text: string;
}

export function UserBubble({ text }: UserBubbleProps) {
  return (
    <div className="flex justify-end px-3 pt-3">
      <div className="max-w-[min(100%,18rem)] animate-in fade-in slide-in-from-bottom-1 rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm duration-200">
        <p className="text-left text-[15px] font-medium leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}
