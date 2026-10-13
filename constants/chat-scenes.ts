/** 场景一：核心卖点多选（8 项，面板内 4×2 排布） */
export const MOMENTS_SELLING_POINTS = [
  "现货速发",
  "工厂直销",
  "环保材质",
  "限时特价",
  "设计师款",
  "包送装",
  "质保无忧",
  "到店体验",
] as const;

/** 场景一：文案风格（短文案，窄屏一行显示完整） */
export const MOMENTS_COPY_STYLES = [
  { id: "urgent" as const, label: "限时抢购" },
  { id: "warm" as const, label: "温情居家" },
  { id: "pro" as const, label: "专业科普" },
  { id: "redbook" as const, label: "种草笔记" },
];

/** 场景一：目标客群（按置家阶段与预算倾向，非房产交易口径） */
export const MOMENTS_AUDIENCES = [
  { id: "first_home" as const, label: "首置年轻（新婚/新居）" },
  { id: "upgrade" as const, label: "家庭改善（焕新/扩容）" },
  { id: "luxury" as const, label: "高端定制（大宅/整装）" },
];

/** 场景一：与首页「营销生成」子能力一致 */
export const MOMENTS_OUTPUT_MODES = [
  { id: "copy_only" as const, label: "生成文案" },
  { id: "image_only" as const, label: "生成配图" },
  { id: "rich" as const, label: "图文生成" },
];

/** 场景二：政策查询快捷问法 */
export const RAG_PRESET_QUESTIONS = [
  "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
  "预算3000元，想买适合小户型的沙发",
  "只看沙发，预算最多2299元",
  "S01保修多久？",
  "S02能不能拆洗？",
];
