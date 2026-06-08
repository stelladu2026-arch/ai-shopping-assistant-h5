import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_SC } from "next/font/google";
import { DemoDeployBanner } from "@/components/demo/DemoDeployBanner";
import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI导购助手 · 门店 H5 演示",
  description: "面向门店导购/店长的 AI 助手演示：朋友圈营销生成、政策 RAG 查询、会话与收藏。",
};

/** 移动端 H5：按设备宽度，刘海屏用 safe-area */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={notoSansSc.variable}>
      <body className={`${notoSansSc.className} antialiased`}>
        <DemoDeployBanner />
        {children}
      </body>
    </html>
  );
}
