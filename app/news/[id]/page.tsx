import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, User } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getPublishedNewsById } from "@/lib/news";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "تفاصيل الخبر",
};

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const news = await getPublishedNewsById(id);
  if (!news) notFound();

  return (
    <div className="bg-background py-10 md:py-14">
      <Container className="max-w-4xl">
        <Breadcrumb
          items={[
            { label: "الأخبار", href: "/news" },
            { label: news.title },
          ]}
        />

        <article>
          <Badge variant="warning" className="mb-4">{news.category}</Badge>
          <h1 className="text-2xl font-bold md:text-3xl">{news.title}</h1>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(news.publishedAt)}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {news.author}
            </span>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-gray-100">
            {news.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={news.image} alt={news.title} className="h-64 w-full object-cover md:h-80" />
            ) : (
              <div className="flex h-64 items-center justify-center md:h-80">
                <Calendar className="h-16 w-16 text-blue-200" />
              </div>
            )}
          </div>

          <Card className="mt-8">
            <p className="text-lg leading-9 text-muted">{news.content}</p>
          </Card>
        </article>
      </Container>
    </div>
  );
}
