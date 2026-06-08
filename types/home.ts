export type QuickActionIcon =
  | "product"
  | "campaign"
  | "copy"
  | "image"
  | "marketing";

export type TabIcon = "home" | "sessions";

export interface QuickActionData {
  id: string;
  title: string;
  description: string;
  icon: QuickActionIcon;
  featured?: boolean;
  subActions?: {
    id: string;
    label: string;
  }[];
}

export interface QuestionChipData {
  id: string;
  label: string;
}

export interface BottomTabItem {
  id: string;
  label: string;
  icon: TabIcon;
  active?: boolean;
}

/** 个人信息（姓名、工号；角色标签在设置侧栏由当前账号角色展示） */
export interface HomeProfileInfo {
  displayName: string;
  employeeId: string;
}

export interface HomePageData {
  title: string;
  /** 个人信息（在设置侧栏展示） */
  profile: HomeProfileInfo;
  sectionTitles: {
    quickActions: string;
    commonQuestions: string;
    /** 单一入口：继续上次会话 */
    resumeSession: string;
  };
  quickActions: QuickActionData[];
  commonQuestions: QuestionChipData[];
  bottomTabs: BottomTabItem[];
}
