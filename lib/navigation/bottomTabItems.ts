import { homePageMock } from "@/mock/home";
import type { BottomTabItem } from "@/types/home";

/** 与 BottomTabBar 路由一致：首页 / 会话中心（对话页 /chat 不展示底栏） */
export type BottomTabActiveRoute = "home" | "sessions";

export function buildBottomTabItems(active: BottomTabActiveRoute): BottomTabItem[] {
  return homePageMock.bottomTabs.map((t) => ({
    ...t,
    active:
      (active === "home" && t.icon === "home") ||
      (active === "sessions" && t.icon === "sessions"),
  }));
}
