import { connectDB } from "@/lib/db";
import News from "@/models/News";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { formatNews } from "@/lib/news";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requirePermission("news.manage");
    if (error) return error;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt.trim();
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.category !== undefined) updates.category = body.category.trim() || "إعلانات";
    if (body.image !== undefined) updates.image = body.image.trim();
    if (body.author !== undefined) updates.author = body.author.trim() || "إدارة الأكاديمية";
    if (body.isPublished !== undefined) updates.isPublished = Boolean(body.isPublished);
    if (body.publishedAt !== undefined) updates.publishedAt = new Date(body.publishedAt);

    await connectDB();
    const news = await News.findByIdAndUpdate(id, updates, { returnDocument: "after" });
    if (!news) return errorResponse("الخبر غير موجود", 404);

    return successResponse({ news: formatNews(news) });
  } catch (error) {
    console.error("Admin news PUT:", error);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await requirePermission("news.manage");
    if (error) return error;

    await connectDB();
    const news = await News.findByIdAndDelete(id);
    if (!news) return errorResponse("الخبر غير موجود", 404);

    return successResponse({ message: "تم حذف الخبر بنجاح" });
  } catch (error) {
    console.error("Admin news DELETE:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
