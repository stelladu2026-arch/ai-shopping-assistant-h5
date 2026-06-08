import type { StoreDashboardMetrics, StoreSessionSummaryItem } from "@/types/store-insights";

export const storeDashboardMock: StoreDashboardMetrics = {
  activeGuides: 6,
  weeklySessionCount: 128,
  intentShare: { product: 0.34, campaign: 0.41, copy: 0.25 },
  copyRate: 0.62,
  regenerateRate: 0.11,
};

export const storeSessionSummariesMock: StoreSessionSummaryItem[] = [
  {
    id: "sum_01",
    guideName: "王敏",
    subject: "床垫 A 系列材质与试躺建议",
    riskDomain: "参数",
    reviewSuggestion: "建议二次核对（参数）",
    bullets: [
      "用户关注乳胶含量与软硬度匹配",
      "已给出试躺动线与话术要点",
      "价格口径需与本周价签同步",
    ],
    conclusion: "可成交意向偏高，建议跟进时携带材质小样说明卡。",
    followUpStatus: "待辅导",
    relativeTime: "32 分钟前",
  },
  {
    id: "sum_02",
    guideName: "李婷",
    subject: "618 满减与样品清仓叠加规则",
    riskDomain: "活动",
    reviewSuggestion: "建议二次核对（活动）",
    bullets: [
      "询问样品是否享受会员额外折扣",
      "涉及跨品类凑单的边界案例",
      "已给出官方话术草案",
    ],
    conclusion: "规则解释一致性要求高，建议二次核对（活动）后再统一口径广播。",
    followUpStatus: "待补充知识点",
    relativeTime: "今天 10:12",
  },
  {
    id: "sum_03",
    guideName: "赵磊",
    subject: "客厅沙发物流周期与安装收费",
    riskDomain: "参数",
    reviewSuggestion: "无",
    bullets: ["用户在意到货时间与上楼费", "已确认本市配送时效区间"],
    conclusion: "可按标准 SLA 回复，无明显风险。",
    followUpStatus: "已处理",
    relativeTime: "今天 09:40",
  },
  {
    id: "sum_04",
    guideName: "周洁",
    subject: "两宽软床与护脊款对比",
    riskDomain: "参数",
    reviewSuggestion: "建议二次核对（参数）",
    bullets: [
      "用户需要护脊数据与试睡体验对比",
      "已输出对比表但部分参数待库内确认",
    ],
    conclusion: "建议二次核对（参数）后，再推最终推荐款。",
    followUpStatus: "已处理",
    relativeTime: "昨天 18:05",
  },
  {
    id: "sum_05",
    guideName: "陈浩",
    subject: "以旧换新资格与旧品评估",
    riskDomain: "活动",
    reviewSuggestion: "建议二次核对（活动）",
    bullets: [
      "旧品评估价与活动叠加强依赖门店执行",
      "已记录用户地址与梯户情况",
    ],
    conclusion: "建议二次核对（活动）侧需与门店活动负责人确认后回电。",
    followUpStatus: "已沉淀模板",
    relativeTime: "昨天 16:20",
  },
];
