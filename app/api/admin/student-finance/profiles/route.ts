import mongoose from "mongoose";
import User from "@/models/User";
import { requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";
import { buildStudentFinancialProfile } from "@/lib/student-finance";
import { connectDB } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const academicLevel = searchParams.get("academicLevel")?.trim();
    const sort = parseSort(searchParams, ["name", "createdAt", "academicLevel"], "createdAt");

    const filter: Record<string, unknown> = { role: "student", deletedAt: null };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        ...(mongoose.Types.ObjectId.isValid(search) ? [{ _id: new mongoose.Types.ObjectId(search) }] : []),
      ];
    }
    if (academicLevel) {
      filter.$or = [
        ...((filter.$or as object[] | undefined) ?? []),
        { academicLevel: { $regex: academicLevel, $options: "i" } },
        { studyLevel: { $regex: academicLevel, $options: "i" } },
      ];
    }

    await connectDB();
    const [students, total] = await Promise.all([
      User.find(filter).select("_id").sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      User.countDocuments(filter),
    ]);

    const profiles = await Promise.all(
      students.map((student) => buildStudentFinancialProfile(student._id.toString()))
    );

    return successResponse({
      profiles,
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Student finance profiles GET:", err);
    return errorResponse("حدث خطأ أثناء جلب الملفات المالية", 500);
  }
}
