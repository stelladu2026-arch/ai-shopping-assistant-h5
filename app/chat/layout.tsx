import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "对话 | AI导购助手",
  description: "AI导购助手导购会话",
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return children;
}
