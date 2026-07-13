import cloudinary from "@/lib/cloudinary";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { recordAudit } from "@/lib/audit";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadBuffer(buffer: Buffer, folder: string) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage_documents");
    if (error) return error;

    if (!isCloudinaryConfigured()) {
      return errorResponse("خدمة رفع الملفات غير مهيأة", 500);
    }

    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const type = String(form.get("type") || "other").trim() || "other";

    if (!(file instanceof File)) return errorResponse("الملف مطلوب");
    if (!title) return errorResponse("عنوان الوثيقة مطلوب");
    if (file.size > MAX_FILE_SIZE) return errorResponse("حجم الملف يجب ألا يتجاوز 5MB");

    await connectDB();
    const student = await User.findOne({ _id: id, role: "student" });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBuffer(buffer, `haytham-academy/students/${id}`);
    const document = {
      title,
      type,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      size: file.size,
      mimeType: file.type,
      verificationStatus: "pending" as const,
      uploadedAt: new Date(),
    };

    student.documents = [...(student.documents ?? []), document];
    await student.save();

    await recordAudit({
      userId: user!._id,
      action: "student.document.upload",
      recordType: "student",
      recordId: id,
      metadata: { title, type, publicId: uploaded.public_id },
    });

    return successResponse({ document }, 201);
  } catch (error) {
    console.error("Student document upload:", error);
    return errorResponse("حدث خطأ أثناء رفع الوثيقة", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage_documents");
    if (error) return error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get("publicId");
    const url = searchParams.get("url");
    if (!publicId && !url) return errorResponse("معرّف الوثيقة مطلوب");

    await connectDB();
    const student = await User.findOne({ _id: id, role: "student" });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const before = student.documents ?? [];
    student.documents = before.filter((doc) =>
      publicId ? doc.publicId !== publicId : doc.url !== url
    );
    await student.save();

    if (publicId && isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => null);
    }

    await recordAudit({
      userId: user!._id,
      action: "student.document.delete",
      recordType: "student",
      recordId: id,
      metadata: { publicId, url },
    });

    return successResponse({ message: "تم حذف الوثيقة" });
  } catch (error) {
    console.error("Student document delete:", error);
    return errorResponse("حدث خطأ أثناء حذف الوثيقة", 500);
  }
}
