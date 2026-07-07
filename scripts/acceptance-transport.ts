/**
 * Phase 6 Transport acceptance — free transport service
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "20020319AZEaze";

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(emailOrPhone: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone, password: PASSWORD }),
  });
  const cookie = (res.headers.get("set-cookie") ?? "").match(/haytham_token=([^;]+)/)?.[1] ?? "";
  return { ok: res.ok, cookie };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string>),
      Cookie: `haytham_token=${cookie}`,
    },
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function main() {
  console.log("=== Phase 6 Transport (Free Service) Acceptance ===\n");

  try {
    await fetch(BASE);
  } catch {
    console.error("Dev server not reachable at", BASE);
    process.exit(1);
  }

  const admin = await login("haythamhanancha@gmail.com");
  const deputy = await login("0672991053");
  const secretary = await login("0676955623");

  if (!admin.cookie) {
    fail("Admin login");
    process.exit(1);
  }
  pass("Admin login");

  const depDel = await api("/api/admin/transport/buses/fake", deputy.cookie, { method: "DELETE" });
  if (depDel.status === 403) pass("Deputy blocked from delete");
  else fail("Deputy delete blocked", String(depDel.status));

  const secBusPost = await api("/api/admin/transport/buses", secretary.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ busName: "x" }),
  });
  if (secBusPost.status === 403) pass("Secretary blocked from bus create");
  else fail("Secretary bus create blocked", String(secBusPost.status));

  const suffix = Date.now().toString().slice(-6);

  const driverRes = await api("/api/admin/transport/drivers", admin.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `سائق ${suffix}`, phone: `0555${suffix}` }),
  });
  const driverId = (driverRes.body.driver as { _id?: string })?._id;
  if (driverRes.status === 201 && driverId) pass("Create driver");
  else fail("Create driver", String(driverRes.status));

  const routeRes = await api("/api/admin/transport/routes", admin.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `خط ${suffix}`, description: "وصف الخط" }),
  });
  const routeId = (routeRes.body.route as { _id?: string })?._id;
  if (routeRes.status === 201 && routeId) pass("Create route");
  else fail("Create route", String(routeRes.status));

  const plate = `TR${suffix}`;
  let busId = "";
  if (driverId && routeId) {
    const busRes = await api("/api/admin/transport/buses", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        busName: "حافلة اختبار",
        plateNumber: plate,
        driverId,
        routeId,
        capacity: 30,
        status: "active",
      }),
    });
    busId = (busRes.body.bus as { _id?: string })?._id ?? "";
    if (busRes.status === 201 && busId) pass("Create bus");
    else fail("Create bus", `${busRes.status} ${JSON.stringify(busRes.body)}`);
  }

  let studentId = "";
  const phone = `09${Date.now().toString().slice(-8)}`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "طالب نقل اختبار", phone, password: "test123456" }),
  });
  if (reg.ok) {
    const listed = await api(`/api/admin/students?search=${phone}`, admin.cookie);
    studentId = ((listed.body.students as { _id: string }[]) ?? [])[0]?._id ?? "";
  }
  if (studentId) pass("Create test student", phone);
  else fail("Create test student");

  let subscriptionId = "";
  if (studentId && busId) {
    const subRes = await api("/api/admin/transport/subscriptions", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        busId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
        pickupPoint: "محطة A",
        dropoffPoint: "الأكاديمية",
      }),
    });
    subscriptionId = (subRes.body.subscription as { _id?: string })?._id ?? "";
    const sub = subRes.body.subscription as { status?: string };
    if (subRes.status === 201 && subscriptionId && sub?.status === "active") {
      pass("Register student in transport", `status=${sub.status}`);
    } else fail("Register student in transport", `${subRes.status} ${JSON.stringify(subRes.body)}`);
  }

  if (busId) {
    const passengers = await api(`/api/admin/transport/passengers?busId=${busId}`, admin.cookie);
    const count = (passengers.body.report as { passengerCount?: number })?.passengerCount ?? 0;
    if (passengers.status === 200 && count >= 1) pass("Passenger list", `count=${count}`);
    else fail("Passenger list", String(passengers.status));
  }

  const finance = await api("/api/admin/finance/summary", admin.cookie);
  const summary = finance.body.summary as { transport?: unknown; today?: { transportIncome?: number } };
  if (finance.status === 200 && !summary?.transport && summary?.today?.transportIncome === undefined) {
    pass("No transport income in finance");
  } else fail("No transport income in finance", JSON.stringify(summary));

  const payRoute = await api("/api/admin/transport/payments", admin.cookie);
  if (payRoute.status === 404) pass("Transport payments API removed");
  else fail("Transport payments API removed", String(payRoute.status));

  const secSub = await api("/api/admin/transport/subscriptions", secretary.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, busId, pickupPoint: "x", dropoffPoint: "y" }),
  });
  if (secSub.status === 400 || secSub.status === 409) pass("Secretary subscription validation");
  else if (secSub.status === 403) pass("Secretary subscription blocked");
  else fail("Secretary subscription", String(secSub.status));

  const transportPage = await fetch(`${BASE}/admin/transport`, {
    headers: { Cookie: `haytham_token=${admin.cookie}` },
    redirect: "manual",
  });
  if (transportPage.status === 200) pass("Admin opens /admin/transport");
  else fail("Admin opens /admin/transport", String(transportPage.status));

  const passengersPage = await fetch(`${BASE}/admin/transport/passengers`, {
    headers: { Cookie: `haytham_token=${admin.cookie}` },
    redirect: "manual",
  });
  if (passengersPage.status === 200) pass("Admin opens passenger list page");
  else fail("Admin opens passenger list page", String(passengersPage.status));

  console.log("\n=== Summary ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail ?? ""}`));
    process.exit(1);
  }
  console.log("\nPhase 6 Transport (Free) ACCEPTED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
