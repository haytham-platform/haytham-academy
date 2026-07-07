import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Bus from "@/models/Bus";
import Driver from "@/models/Driver";
import Route from "@/models/Route";
import { requireTransportWrite } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requireTransportWrite();
    if (error) return error;

    await connectDB();

    const [students, buses, drivers, routes] = await Promise.all([
      User.find({ role: "student", deletedAt: null, isActive: true })
        .select("name phone")
        .sort({ name: 1 })
        .lean(),
      Bus.find({ deletedAt: null, status: "active" })
        .populate("driverId", "name phone")
        .populate("routeId", "name")
        .sort({ busName: 1 })
        .lean(),
      Driver.find({ deletedAt: null, status: "active" }).select("name phone").sort({ name: 1 }).lean(),
      Route.find({ deletedAt: null, status: "active" }).select("name description").sort({ name: 1 }).lean(),
    ]);

    return successResponse({
      students: students.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        phone: s.phone,
      })),
      buses: buses.map((b) => ({
        _id: b._id.toString(),
        busName: b.busName,
        plateNumber: b.plateNumber,
        capacity: b.capacity,
        driverName: (b.driverId as { name?: string })?.name,
        routeName: (b.routeId as { name?: string })?.name,
      })),
      drivers: drivers.map((d) => ({
        _id: d._id.toString(),
        name: d.name,
        phone: d.phone,
      })),
      routes: routes.map((r) => ({
        _id: r._id.toString(),
        name: r.name,
        description: r.description,
      })),
    });
  } catch (err) {
    console.error("Transport meta GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
