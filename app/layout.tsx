import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DemoDeployBanner } from "@/components/demo/DemoDeployBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI导购助手 · 门店 H5 演示",
  description: "家居门店导购助手：自然语言选品、商品确认、朋友圈文案与配图生成。",
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
    <html lang="zh-CN">
      <body className="antialiased">
        <DemoDeployBanner />
        {children}
      </body>
    </html>
  );
}
