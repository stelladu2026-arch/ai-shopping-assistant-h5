import { HomePageView } from "@/components/home/HomePageView";
import { homePageMock } from "@/mock/home";

export default function HomePage() {
  return <HomePageView data={homePageMock} />;
}
