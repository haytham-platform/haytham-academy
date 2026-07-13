import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import NewsCard from "@/components/news/NewsCard";
import { getPublishedNews } from "@/lib/news";

export const metadata: Metadata = {
  title: "الأخبار",
};

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const news = await getPublishedNews();

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
        {news.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map((item, i) => (
              <NewsCard key={item._id} news={item} featured={i === 0} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">لا توجد أخبار منشورة حالياً</p>
        )}
      </Container>
    </div>
  );
}
