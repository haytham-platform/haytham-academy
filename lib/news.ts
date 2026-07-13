import { connectDB } from "@/lib/db";
import News, { type INews } from "@/models/News";

type NewsLike = Pick<
  INews,
  | "_id"
  | "title"
  | "excerpt"
  | "content"
  | "image"
  | "category"
  | "author"
  | "isPublished"
  | "publishedAt"
  | "createdAt"
>;

export function formatNews(news: NewsLike) {
  return {
    _id: news._id.toString(),
    title: news.title,
    excerpt: news.excerpt,
    content: news.content,
    image: news.image ?? "",
    category: news.category,
    author: news.author,
    isPublished: news.isPublished,
    publishedAt:
      news.publishedAt instanceof Date
        ? news.publishedAt.toISOString()
        : new Date(news.publishedAt).toISOString(),
    createdAt:
      news.createdAt instanceof Date
        ? news.createdAt.toISOString()
        : news.createdAt
          ? new Date(news.createdAt).toISOString()
          : "",
  };
}

export async function getPublishedNews(limit?: number) {
  await connectDB();
  let query = News.find({ isPublished: true }).sort({ publishedAt: -1 });
  if (limit) query = query.limit(limit);
  const news = await query.lean();
  return news.map((item) => formatNews(item));
}

export async function getPublishedNewsById(id: string) {
  await connectDB();
  const news = await News.findOne({ _id: id, isPublished: true }).lean();
  return news ? formatNews(news) : null;
}
