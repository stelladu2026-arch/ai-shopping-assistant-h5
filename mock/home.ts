import type { HomePageData } from "@/types/home";

export const homePageMock: HomePageData = {
  title: "AI导购助手",
  profile: {
    displayName: "演示导购",
    employeeId: "GD-1026",
  },
  sectionTitles: {
    quickActions: "功能入口",
    commonQuestions: "常用提问",
    resumeSession: "继续上次会话",
  },
  quickActions: [
    {
      id: "policy-query",
      title: "选品推荐",
      description: "按预算、尺寸、颜色和材质筛选商品",
      icon: "product",
    },
    {
      id: "marketing-generate",
      title: "素材生成",
      description: "",
      icon: "marketing",
      featured: true,
      subActions: [
        {
          id: "generate-copy",
          label: "文案",
        },
        {
          id: "generate-image",
          label: "配图",
        },
        {
          id: "generate-rich-content",
          label: "图文",
        },
      ],
    },
  ],
  commonQuestions: [
    {
      id: "question-1",
      label: "浅色沙发，预算3000元，宽度不超过180厘米，不要皮质",
    },
    {
      id: "question-2",
      label: "预算3000元，想买适合小户型的沙发",
    },
    {
      id: "question-3",
      label: "只看沙发，预算最多2299元",
    },
    {
      id: "question-4",
      label: "便宜点",
    },
  ],
  bottomTabs: [
    {
      id: "tab-home",
      label: "首页",
      icon: "home",
      active: true,
    },
    {
      id: "tab-sessions",
      label: "会话中心",
      icon: "sessions",
    },
  ],
};
