import type { Metadata } from "next";
import { HomePageView } from "@/components/home/HomePageView";
import { homePageMock } from "@/mock/home";

export const metadata: Metadata = {
  title: "导购工作台 · AI导购助手",
  description: "进入选品推荐与营销素材生成，或继续上次导购会话。",
};

export default function GuideHomePage() {
  return <HomePageView data={homePageMock} />;
}
