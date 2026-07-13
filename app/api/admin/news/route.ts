import { connectDB } from "@/lib/db";
import News from "@/models/News";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { formatNews } from "@/lib/news";

export async function GET() {
  try {
    const { error } = await requirePermission("news.manage");
    if (error) return error;

    await connectDB();
    const news = await News.find().sort({ publishedAt: -1 }).lean();
    return successResponse({ news: news.map((item) => formatNews(item)) });
  } catch (error) {
    console.error("Admin news GET:", error);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("news.manage");
    if (error) return error;

    const body = await request.json();
    if (!body.title?.trim()) return errorResponse("عنوان الخبر مطلوب");
    if (!body.excerpt?.trim()) return errorResponse("مقتطف الخبر مطلوب");
    if (!body.content?.trim()) return errorResponse("محتوى الخبر مطلوب");

    await connectDB();
    const news = await News.create({
      title: body.title.trim(),
      excerpt: body.excerpt.trim(),
      content: body.content.trim(),
      category: body.category?.trim() || "إعلانات",
      image: body.image?.trim() || "",
      author: body.author?.trim() || user?.name || "إدارة الأكاديمية",
      isPublished: body.isPublished !== false,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
    });

    return successResponse({ news: formatNews(news) }, 201);
  } catch (error) {
    console.error("Admin news POST:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
