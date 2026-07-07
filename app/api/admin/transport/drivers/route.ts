import { connectDB } from "@/lib/db";
import Driver from "@/models/Driver";
import { requireTransportAccess, requireTransportManage } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatDriver } from "@/lib/transport";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["name", "createdAt"], "name");
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = { deletedAt: null };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status && ["active", "inactive"].includes(status)) filter.status = status;

    await connectDB();
    const [rows, total] = await Promise.all([
      Driver.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      Driver.countDocuments(filter),
    ]);

    return successResponse({
      drivers: rows.map((d) => formatDriver(d)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Transport drivers GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireTransportManage();
    if (error) return error;

    const body = await request.json();
    if (!body.name?.trim()) return errorResponse("اسم السائق مطلوب");
    if (!body.phone?.trim()) return errorResponse("هاتف السائق مطلوب");

    await connectDB();
    const driver = await Driver.create({
      name: body.name.trim(),
      phone: body.phone.trim(),
      status: body.status === "inactive" ? "inactive" : "active",
      notes: body.notes?.trim() || "",
    });

    return successResponse({ driver: formatDriver(driver) }, 201);
  } catch (err) {
    console.error("Transport drivers POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
