import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./interview.module.css";

export const metadata: Metadata = {
  title: "家居导购 Agent · 杜思慧的 AI 产品作品",
  description: "从需求理解、商品决策到营销素材生成：家居导购 Agent 的项目介绍、能力边界与交互演示。",
};

const example = "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质";
const clarifyExample = "预算3千多，想买张桌子";
const chatHref = (draft: string) => `/chat?${new URLSearchParams({ scene: "store_rag_query", draft })}`;

const capabilities = [
  { number: "01", title: "把口语变成选品条件", text: "提取预算、尺寸、颜色与材质；遇到“3千多”“桌子”这类模糊表达，先澄清，再筛选。", tag: "需求理解 · 多轮澄清" },
  { number: "02", title: "让商品决策有据可查", text: "按商品目录筛选候选，展示匹配与限制；导购确认具体商品后，把事实传给后续生成环节。", tag: "约束筛选 · 商品确认" },
  { number: "03", title: "围绕同一件商品生成素材", text: "生成朋友圈文案、配图或图文；支持单张试生成与四图方案，保留复制、反馈和重新生成入口。", tag: "文案 · 配图 · 图文" },
];

const steps = [
  { title: "说出顾客需求", detail: "打开预填示例，点发送。观察预算、尺寸和排除材质如何被识别。", expect: "看点：自然语言 → 结构化条件" },
  { title: "追问并确认商品", detail: "继续说“预算改为2500元”，查看候选变化，再点“确认这件商品”。", expect: "看点：多轮修改 → 确认事实" },
  { title: "生成朋友圈素材", detail: "点“去生成素材”，先体验文案；需要看生图时，选择“试生成1张”后主动生成。", expect: "看点：商品事实 → 营销表达" },
  { title: "回看会话与结果", detail: "复制素材、提交反馈，或去会话中心查看当前浏览器保存的会话。", expect: "看点：一次输出 → 可继续的工作流" },
];

export default function InterviewPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#overview">跳到项目介绍</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="家居导购 Agent 项目首页">
          <span className={styles.brandMark} aria-hidden="true">g.</span>
          <span>家居导购 Agent<span className={styles.brandSub}>杜思慧 · AI 产品作品</span></span>
        </Link>
        <nav className={styles.nav} aria-label="项目导航"><a href="#capabilities">核心能力</a><a href="#walkthrough">演示指南</a><a href="#boundaries">实现边界</a></nav>
        <Link href="/guide" prefetch={false} className={styles.headerCta}>进入体验 <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="overview">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> 面向门店导购的移动助手</p>
            <h1 id="hero-title">从一句顾客需求，<br />到一套<span>导购行动。</span></h1>
            <p className={styles.intro}>理解顾客想要什么，找到合适的商品，再生成可分享的营销素材。把选品与内容生成，接在同一条会话里。</p>
            <div className={styles.heroActions}>
              <Link href={chatHref(example)} prefetch={false} className={styles.primary}>开始选品演示 <span aria-hidden="true">↗</span></Link>
              <a href="#walkthrough" className={styles.secondary}>先看演示指南 <span aria-hidden="true">↓</span></a>
            </div>
            <p className={styles.actionNote}>示例只预填输入框，由你点击发送。无需先登录。</p>
            <div className={styles.heroFacts}>
              <div><strong>对谁有用</strong><span>线下接待与线上跟进的门店导购</span></div>
              <div><strong>解决什么</strong><span>反复查商品、确认信息、写营销素材</span></div>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualHeading}><span>一条会话，衔接选品与营销</span><span className={styles.visualIndex}>流程示意</span></div>
            <div className={styles.productImage}>
              <Image src="/products/S01.png" alt="商品目录中的浅色双人沙发示意图" width={1024} height={1024} priority unoptimized />
              <span className={styles.imageLabel}>商品目录示意</span>
            </div>
            <div className={styles.conversation}>
              <div className={styles.conversationLabel}><span className={styles.miniMark}>g.</span><span>需求理解示例</span><span className={styles.staticLabel}>非实时生成</span></div>
              <p>“预算三千以内，想要浅色沙发，别太大，也不要皮的。”</p>
              <div className={styles.tags}><span>沙发</span><span>≤ 3000元</span><span>浅色</span><span>排除皮质</span></div>
              <div className={styles.nextStep}><span aria-hidden="true">↳</span> 尺寸还不明确，先确认可接受的最大宽度。</div>
            </div>
          </div>
        </section>
        <section className={styles.capabilities} id="capabilities" aria-labelledby="capability-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>围绕一项真实工作</p><h2 id="capability-title">从「怎么选」，到「怎么推荐」。</h2></div>
            <p>导购保留商品确认与发送决定，<br />助手承担信息整理和素材起草。</p>
          </div>
          <div className={styles.capabilityGrid}>{capabilities.map((item) => (
            <article key={item.number} className={styles.capability}><span className={styles.number}>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p><span className={styles.capabilityTag}>{item.tag}</span></article>
          ))}</div>
        </section>
        <section className={styles.walkthrough} id="walkthrough" aria-labelledby="walkthrough-title">
          <div className={styles.walkthroughIntro}>
            <p className={styles.eyebrow}>建议体验顺序</p><h2 id="walkthrough-title">用一位顾客的需求，<br />走完核心流程。</h2>
            <p>先体验完整选品路径，再按兴趣补充测试。文案与生图也可以从商品目录直接开始。</p>
            <Link href={chatHref(example)} prefetch={false} className={styles.primary}>带着示例开始 <span aria-hidden="true">↗</span></Link>
            <div className={styles.sample}><span>已为你准备</span><p>{example}</p></div>
          </div>
          <ol className={styles.steps}>{steps.map((step, index) => (
            <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p><span className={styles.expect}>{step.expect}</span></div></li>
          ))}</ol>
        </section>
        <section className={styles.trySection} aria-labelledby="try-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>换一种角度看能力</p><h2 id="try-title">也可以从这里开始。</h2></div></div>
          <div className={styles.tryGrid}>
            <Link href={chatHref(clarifyExample)} prefetch={false} className={styles.tryLink}><span className={styles.tryTop}>测试澄清能力 <span aria-hidden="true">↗</span></span><strong>“三千多，买张桌子”</strong><p>观察如何追问具体品类和预算上限。</p></Link>
            <Link href="/chat?scene=moments_marketing&outputKind=copy_only" prefetch={false} className={styles.tryLink}><span className={styles.tryTop}>直接生成文案 <span aria-hidden="true">↗</span></span><strong>已有商品，只差一段推荐</strong><p>先选择商品，再设置风格并生成。</p></Link>
            <Link href="/chat?scene=moments_marketing&outputKind=image_only&imageCount=1" prefetch={false} className={styles.tryLink}><span className={styles.tryTop}>体验真实生图 <span aria-hidden="true">↗</span></span><strong>先用一张图看看效果</strong><p>已预选单张；确认商品后主动发起生成。</p></Link>
          </div>
        </section>
        <section className={styles.boundaries} id="boundaries" aria-labelledby="boundary-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>当前版本说明</p><h2 id="boundary-title">能体验什么，边界在哪里。</h2></div></div>
          <div className={styles.statusGrid}>
            <div className={styles.statusBlock}><span className={styles.statusReady}>可体验</span><h3>商品决策与素材工作流</h3><p>商品目录筛选、多轮条件修改、商品确认、文案与配图生成、会话回看。真实生图已接入 wan2.6-image。</p><p>生图只在主动点击后发起；默认素材方案为四张，也可试生成一张。等待时不会自动重复提交。</p></div>
            <div className={styles.statusBlock}><span className={styles.statusPending}>待完成验收</span><h3>飞书门店知识库</h3><p>活动、售后与禁止承诺等文档尚待补齐和验收。当前可体验的是商品目录决策，不代表飞书知识库已完整可用。</p><p>目录图片与生成配图用于演示。未接入商品实拍参考图，生成结果不能作为商品外观、材质或功能的承诺。</p></div>
          </div>
          <details className={styles.technical}>
            <summary>进一步了解：实现方式与产品取舍 <span aria-hidden="true">＋</span></summary>
            <div className={styles.technicalGrid}>
              <div><h3>编排与职责</h3><p>使用图编排（LangGraph）组织路由、商品决策与内容节点。各节点围绕一条导购流程分工，商品确认是进入生成的前置条件。</p></div>
              <div><h3>模型与规则</h3><p>需求理解与文案支持模型调用，未启用时使用演示规则或模板。预算、尺寸筛选与商品确认由业务逻辑约束，实际调用状态以体验页反馈为准。</p></div>
              <div><h3>事实与会话</h3><p>确认的商品事实传给生成节点。会话历史保存在当前浏览器；这是可交互演示版本，尚不等同于门店生产系统。</p></div>
            </div>
          </details>
        </section>
        <section className={styles.finalCta}><div><p className={styles.eyebrow}>现在，试着当一次导购</p><h2>把下一位顾客的需求，交给助手。</h2></div><Link href="/guide" prefetch={false} className={styles.primary}>进入导购工作台 <span aria-hidden="true">↗</span></Link></section>
      </main>
      <footer className={styles.footer}><span>杜思慧 · AI 产品作品</span><span>家居导购 Agent / 交互演示</span><a href="#overview">回到顶部 ↑</a></footer>
    </div>
  );
}
