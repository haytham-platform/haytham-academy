import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, message } = body;

    if (!name?.trim()) {
      return errorResponse("الاسم مطلوب");
    }

    if (!phone?.trim()) {
      return errorResponse("رقم الهاتف مطلوب");
    }

    if (!message?.trim()) {
      return errorResponse("الرسالة مطلوبة");
    }

    await connectDB();

    const contactMessage = await ContactMessage.create({
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim(),
    });

    return successResponse(
      {
        message: "تم إرسال رسالتك بنجاح. سنتواصل معك قريباً",
        id: contactMessage._id.toString(),
      },
      201
    );
  } catch (error) {
    console.error("Contact POST error:", error);
    return errorResponse("حدث خطأ أثناء إرسال الرسالة", 500);
  }
}
