import type { HomePageData } from "@/types/home";

export const homePageMock: HomePageData = {
  title: "AI导购助手",
  profile: {
    displayName: "王小雅",
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
      title: "政策查询",
      description: "查询活动政策、商品价格及参数",
      icon: "product",
    },
    {
      id: "marketing-generate",
      title: "朋友圈生成",
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
          label: "图片",
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
      label: "这款床垫适合哪些人群？",
    },
    {
      id: "question-2",
      label: "本周门店满减活动怎么叠加？",
    },
    {
      id: "question-3",
      label: "帮我写一条朋友圈促销文案",
    },
    {
      id: "question-4",
      label: "给导购话术补一段卖点总结",
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
