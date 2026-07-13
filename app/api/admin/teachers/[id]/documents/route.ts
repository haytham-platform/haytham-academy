import cloudinary from "@/lib/cloudinary";
import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { recordAudit } from "@/lib/audit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    const { user, error } = await requirePermission("teachers.manage");
    if (error) return error;

    if (!isCloudinaryConfigured()) {
      return errorResponse("خدمة رفع الملفات غير مهيأة", 500);
    }

    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const type = String(form.get("type") || "other").trim() || "other";
    const collection = String(form.get("collection") || "documents").trim();

    if (!(file instanceof File)) return errorResponse("الملف مطلوب");
    if (!title) return errorResponse("عنوان الملف مطلوب");
    if (file.size > MAX_FILE_SIZE) return errorResponse("حجم الملف يجب ألا يتجاوز 10MB");
    if (!["documents", "contracts"].includes(collection)) {
      return errorResponse("نوع المرفق غير صالح");
    }

    await connectDB();
    const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBuffer(buffer, `haytham-academy/teachers/${id}`);

    if (collection === "contracts") {
      const contract = {
        title,
        type,
        status: "active" as const,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        uploadedAt: new Date(),
      };
      teacher.contracts = [...(teacher.contracts ?? []), contract];
      await teacher.save();

      await recordAudit({
        userId: user!._id,
        action: "teacher.contract.upload",
        recordType: "teacher",
        recordId: id,
        metadata: { title, type, publicId: uploaded.public_id },
      });

      return successResponse({ contract }, 201);
    }

    const document = {
      title,
      type,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      uploadedAt: new Date(),
    };
    teacher.documents = [...(teacher.documents ?? []), document];
    await teacher.save();

    await recordAudit({
      userId: user!._id,
      action: "teacher.document.upload",
      recordType: "teacher",
      recordId: id,
      metadata: { title, type, publicId: uploaded.public_id },
    });

    return successResponse({ document }, 201);
  } catch (error) {
    console.error("Teacher document upload:", error);
    return errorResponse("حدث خطأ أثناء رفع الملف", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get("publicId");
    const url = searchParams.get("url");
    const collection = searchParams.get("collection") || "documents";
    if (!publicId && !url) return errorResponse("معرف الملف مطلوب");
    if (!["documents", "contracts"].includes(collection)) {
      return errorResponse("نوع المرفق غير صالح");
    }

    await connectDB();
    const teacher = await Teacher.findOne({ _id: id, deletedAt: null });
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    if (collection === "contracts") {
      teacher.contracts = (teacher.contracts ?? []).filter((contract) =>
        publicId ? contract.publicId !== publicId : contract.url !== url
      );
    } else {
      teacher.documents = (teacher.documents ?? []).filter((document) =>
        publicId ? document.publicId !== publicId : document.url !== url
      );
    }
    await teacher.save();

    if (publicId && isCloudinaryConfigured()) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => null);
    }

    await recordAudit({
      userId: user!._id,
      action: collection === "contracts" ? "teacher.contract.delete" : "teacher.document.delete",
      recordType: "teacher",
      recordId: id,
      metadata: { publicId, url, collection },
    });

    return successResponse({ message: "تم حذف الملف" });
  } catch (error) {
    console.error("Teacher document delete:", error);
    return errorResponse("حدث خطأ أثناء حذف الملف", 500);
  }
}
