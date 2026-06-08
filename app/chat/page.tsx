import { Suspense } from "react";
import { ChatPageClient } from "./ChatPageClient";

function ChatFallback() {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-[#e2e5ea] sm:items-center sm:px-4 sm:py-6">
      <div className="flex h-dvh w-full max-w-full items-center justify-center bg-slate-50 sm:h-[min(800px,calc(100dvh-3rem))] sm:max-w-[360px] sm:rounded-[26px] sm:border sm:border-white/60 sm:shadow-device">
        <p className="text-[0.85rem] font-medium text-slate-500">加载中…</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatPageClient />
    </Suspense>
  );
}
