import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import NewsCard from "@/components/news/NewsCard";
import { mockNews } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "الأخبار",
};

export default function NewsPage() {
  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb items={[{ label: "الأخبار" }]} />
        <Title
          badge="المدونة"
          title="آخر الأخبار والفعاليات"
          subtitle="تابع مستجدات الأكاديمية وإنجازات طلابنا"
          className="mb-10"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockNews.map((item, i) => (
            <NewsCard key={item._id} news={item} featured={i === 0} />
          ))}
        </div>
      </Container>
    </div>
  );
}
