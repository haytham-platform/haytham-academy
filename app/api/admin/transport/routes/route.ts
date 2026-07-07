import { connectDB } from "@/lib/db";
import Route from "@/models/Route";
import { requireTransportAccess, requireTransportManage } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatRoute } from "@/lib/transport";
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
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (status && ["active", "inactive"].includes(status)) filter.status = status;

    await connectDB();
    const [rows, total] = await Promise.all([
      Route.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      Route.countDocuments(filter),
    ]);

    return successResponse({
      routes: rows.map((r) => formatRoute(r)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Transport routes GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireTransportManage();
    if (error) return error;

    const body = await request.json();
    if (!body.name?.trim()) return errorResponse("اسم الخط مطلوب");

    await connectDB();
    const route = await Route.create({
      name: body.name.trim(),
      description: body.description?.trim() || "",
      status: body.status === "inactive" ? "inactive" : "active",
      notes: body.notes?.trim() || "",
    });

    return successResponse({ route: formatRoute(route) }, 201);
  } catch (err) {
    console.error("Transport routes POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
