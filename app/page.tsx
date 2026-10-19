import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "演示入口 · AI导购助手",
  description: "门店 AI 导购助手当前演示：选品推荐、确认商品、生成图文。本页说明浏览路线，点进入 Demo 打开产品。",
};

const card =
  "overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surface ring-1 ring-slate-900/[0.04]";

const steps = [
  {
    title: "1. 选品推荐",
    body: "从首页点「选品推荐」，直接说出预算、品类和不要的材质。选品从这句话开始。会话标题用第一句用户的话；需要时再把这份会话改成客户名。",
  },
  {
    title: "2. 核对条件",
    body: "已识别条件显示为一行短句，例如「预算 3000 · 品类 沙发 · 不要 皮质」，旁边有「编辑」。全部条件在对话框里一起改；「保存」一起生效，「取消」放弃。",
  },
  {
    title: "3. 确认商品",
    body: "在结果里点选一件商品确认。接着问保修或售后时，已确认商品和这些条件保持原样。",
  },
  {
    title: "4. 生成图文",
    body: "为这件已确认商品生成发给顾客的文案和配图。「生成新图文」是新的一套。IMAGE_API_BASE、IMAGE_MODEL、IMAGE_API_KEY 都已设置，且 GUIDE_IMAGE_ENABLED 不是 false、0 或 off 时，才会调用生图接口；否则页面写明「没有调用生图接口」。",
  },
  {
    title: "5. 店长看本店",
    body: "用演示店长登录后，会话中心默认打开「本店」，也可以切回「我的」。",
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex min-w-0 items-center gap-2.5">
        <span className="h-4 w-0.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
        <h2 className="text-[0.9rem] font-semibold leading-snug tracking-wide text-slate-500">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function DemoEntryPage() {
  return (
    <div className="relative min-h-dvh bg-[#e8edf4]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.12),_transparent_62%)]"
        aria-hidden
      />
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[44rem] items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-[0.82rem] font-semibold text-slate-700">AI 导购助手 · 演示入口</p>
          <Link
            href="/home"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-[0.8rem] font-bold text-white shadow-sm transition-colors duration-75 hover:bg-brand-700 active:bg-brand-700"
          >
            进入 Demo
          </Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-[44rem] px-4 pb-16 pt-8">
        <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-brand-700">INTERVIEW ENTRY</p>
        <h1 className="mt-2 text-[1.55rem] font-extrabold leading-snug text-slate-900 sm:text-[1.75rem]">
          门店 AI 导购助手
          <span className="mt-1 block text-[1.05rem] font-semibold text-slate-500 sm:text-[1.15rem]">
            产品说明与演示入口
          </span>
        </h1>
        <p className="mt-3 max-w-[36rem] text-[0.88rem] leading-relaxed text-slate-600">
          面向导购 / 店长的 H5。先做选品推荐，确认一件商品，再生成素材 / 图文。说明只在本页；点下方按钮进入产品界面。
        </p>
        <Link
          href="/home"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-brand-200/80 bg-white px-4 py-4 shadow-surfaceLg ring-1 ring-brand-900/[0.06] transition-colors duration-75 hover:border-brand-300 active:bg-brand-50/70"
        >
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold tracking-wide text-brand-700">主交付 · DEMO</p>
            <p className="mt-1 text-[1rem] font-bold text-slate-900">进入导购助手</p>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-500">选品推荐、确认商品、生成图文</p>
          </div>
          <span className="shrink-0 text-[0.88rem] font-bold text-brand-700">进入 Demo →</span>
        </Link>

        <Section title="产品说明">
          <div className={`${card} px-3.5 py-3`}>
            <p className="text-[0.84rem] font-medium leading-relaxed text-slate-800">
              Next 首页的功能入口是「选品推荐」和「素材生成」（文案、配图、图文）。推荐路线是先选品，点选确认商品，再生成可发给顾客的素材。独立 H5 首页是「选品推荐」和「推荐话术」。
            </p>
          </div>
        </Section>

        <Section title="怎么查看">
          <div className={`${card} px-3.5 py-3`}>
            <ol className="list-decimal space-y-1.5 pl-4 text-[0.82rem] leading-relaxed text-slate-700">
              <li>先浏览本页说明，再点「进入 Demo」打开产品。</li>
              <li>建议用手机打开，或把浏览器切到手机宽度。大屏会显示居中手机框，宽 430px。</li>
              <li>产品内用底部 Tab 在「首页」与「会话中心」之间切换。对话页没有底部 Tab，请用顶栏返回。</li>
              <li>
                本机 Next：
                <a className="font-medium text-brand-700" href="http://127.0.0.1:3000">
                  http://127.0.0.1:3000
                </a>
                。独立 H5：
                <a className="font-medium text-brand-700" href="http://127.0.0.1:4173">
                  http://127.0.0.1:4173
                </a>
                。
              </li>
            </ol>
          </div>
        </Section>

        <Section title="演示账号">
          <div className={card}>
            <div className="border-b border-slate-100 px-3.5 py-2.5">
              <p className="text-[0.78rem] leading-relaxed text-slate-600">
                进入 Demo 后，首页右上角「设置」→ 账号登录。口令均为{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem] text-slate-800">demo123</code>
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[0.84rem] font-bold text-slate-900">演示导购</p>
                  <p className="mt-0.5 font-mono text-[0.75rem] text-slate-600">guide01</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                  导购
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[0.84rem] font-bold text-slate-900">演示店长</p>
                  <p className="mt-0.5 font-mono text-[0.75rem] text-slate-600">manager01</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                  店长
                </span>
              </li>
            </ul>
          </div>
        </Section>

        <Section title="推荐浏览路线">
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.title}>
                <div className={`${card} px-3.5 py-3`}>
                  <p className="text-[0.72rem] font-bold text-brand-700">{step.title}</p>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-slate-700">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="店长 vs 导购">
          <div className={`${card} px-3.5 py-3`}>
            <ul className="space-y-2 text-[0.82rem] leading-relaxed text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">导购</span>（guide01）：会话中心是自己的「最近会话」和「收藏」。
              </li>
              <li>
                <span className="font-semibold text-slate-900">店长</span>
                （manager01）：首页出现「店长工作台」；会话中心默认「本店」，可切换「我的 / 本店」。
              </li>
            </ul>
          </div>
        </Section>

        <Section title="配图与本机地址">
          <div className={`${card} px-3.5 py-3`}>
            <p className="text-[0.8rem] leading-relaxed text-slate-700">
              生图接口只在 <code className="font-mono text-[0.72rem]">IMAGE_API_BASE</code>、
              <code className="font-mono text-[0.72rem]">IMAGE_MODEL</code>、
              <code className="font-mono text-[0.72rem]">IMAGE_API_KEY</code> 都有值，且{" "}
              <code className="font-mono text-[0.72rem]">GUIDE_IMAGE_ENABLED</code> 不是 false、0 或 off 时调用。否则页面显示「没有调用生图接口」。
            </p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-slate-500">
              公开站点 https://ai-assistant-h5-interview.vercel.app 仍是 2026 年 6 月的主构建。看当前这一版，请打开本机 Next http://127.0.0.1:3000 或独立 H5 http://127.0.0.1:4173。
            </p>
          </div>
        </Section>

        <Link
          href="/home"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-[0.88rem] font-bold text-white shadow-sm transition-colors duration-75 hover:bg-brand-700 active:bg-brand-700"
        >
          进入 Demo
        </Link>
      </main>
    </div>
  );
}
