"use client";

import Link from "next/link";
import { Calendar, User, ArrowLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { NewsCardData } from "@/types/ui";

interface NewsCardProps {
  news: NewsCardData;
  featured?: boolean;
}

export default function NewsCard({ news, featured = false }: NewsCardProps) {
  return (
    <Link href={`/news/${news._id}`}>
      <Card
        hover
        padding="none"
        className={`group overflow-hidden ${featured ? "md:col-span-2 md:row-span-2" : ""}`}
      >
        <div className={`relative bg-gradient-to-br from-blue-100 to-gray-100 ${featured ? "h-64 md:h-full min-h-[200px]" : "h-48"}`}>
          {news.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={news.image} alt={news.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Calendar className="h-12 w-12 text-accent/40" />
            </div>
          )}
          <div className="absolute start-3 top-3">
            <Badge variant="warning">{news.category}</Badge>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">{formatDate(news.publishedAt)}</p>
          <h3 className={`mt-2 font-bold transition group-hover:text-primary ${featured ? "text-xl" : "text-base"}`}>
            {news.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted">{news.excerpt}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-muted">
              <User className="h-3.5 w-3.5" />
              {news.author}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-secondary">
              اقرأ المزيد
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
