"use client";

import { usePathname } from "next/navigation";

/** 账号提示只在操作页展示，项目介绍页使用自己的访客引导。 */
export function DemoDeployBanner() {
  const pathname = usePathname();
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1" || pathname === "/") return null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50/95 px-3 py-2 text-center text-[0.72rem] leading-relaxed text-amber-950">
      <span className="font-semibold">演示环境</span>
      <span className="mx-1.5 text-amber-800/60">·</span>
      数据保存在浏览器本地
      <span className="mx-1.5 text-amber-800/60">·</span>
      演示账号：导购 <code className="rounded bg-amber-100/80 px-1">guide01</code> / 店长{" "}
      <code className="rounded bg-amber-100/80 px-1">manager01</code>，口令{" "}
      <code className="rounded bg-amber-100/80 px-1">demo123</code>
    </div>
  );
}
