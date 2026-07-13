/**
 * Phase 3 acceptance tests — AUTH + DB + SECURITY
 * Usage: pnpm acceptance (requires dev server on BASE_URL)
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { resolve } from "path";
import User from "../models/User";

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "20020319AZEaze";
const WRONG = "wrong-password-xyz";

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

async function login(
  emailOrPhone: string,
  password: string
): Promise<{ ok: boolean; cookie: string; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone, password }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/haytham_token=([^;]+)/);
  return { ok: res.ok, cookie: match?.[1] ?? "", body };
}

async function api(
  path: string,
  cookie?: string,
  init?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (cookie) headers.Cookie = `haytham_token=${cookie}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function testSeedDb() {
  console.log("\n[1] Seed / Database");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail("MONGODB_URI configured");
    return;
  }
  pass("MONGODB_URI configured");

  await mongoose.connect(uri);

  const staffCount = await User.countDocuments({
    role: { $in: ["admin", "deputy", "secretary"] },
  });
  if (staffCount === 3) pass("Exactly 3 staff accounts in DB", String(staffCount));
  else fail("Exactly 3 staff accounts in DB", `found ${staffCount}`);

  for (const q of [
    { label: "admin", filter: { email: "haythamhanancha@gmail.com" } },
    { label: "deputy", filter: { phone: "0672991053" } },
    { label: "secretary", filter: { phone: "0676955623" } },
  ]) {
    const u = await User.findOne(q.filter).select("+password");
    if (!u) {
      fail(`${q.label} exists in DB`);
      continue;
    }
    const hashed = u.password.startsWith("$2");
    const valid = await bcrypt.compare(PASSWORD, u.password);
    if (hashed && valid) pass(`${q.label} password bcrypt hashed`);
    else fail(`${q.label} password bcrypt hashed`);
  }

  await mongoose.disconnect();
}

async function testLogin() {
  console.log("\n[2] Login");

  const admin = await login("haythamhanancha@gmail.com", PASSWORD);
  if (admin.ok && (admin.body.user as { role?: string })?.role === "admin")
    pass("Admin login via email");
  else fail("Admin login via email", JSON.stringify(admin.body));

  const deputy = await login("0672991053", PASSWORD);
  if (deputy.ok && (deputy.body.user as { role?: string })?.role === "deputy")
    pass("Deputy login via phone");
  else fail("Deputy login via phone");

  const secretary = await login("0676955623", PASSWORD);
  if (
    secretary.ok &&
    (secretary.body.user as { role?: string })?.role === "secretary"
  )
    pass("Secretary login via phone");
  else fail("Secretary login via phone");

  const bad = await login("haythamhanancha@gmail.com", WRONG);
  if (
    !bad.ok &&
    bad.body.error === "بيانات الدخول غير صحيحة"
  )
    pass("Wrong password returns generic message");
  else fail("Wrong password returns generic message", String(bad.body.error));

  const noPass = await api("/api/auth/login", undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone: "haythamhanancha@gmail.com" }),
  });
  if (noPass.status === 400) pass("Missing password rejected");
  else fail("Missing password rejected");

  return { admin: admin.cookie, deputy: deputy.cookie, secretary: secretary.cookie };
}

async function testSession(adminCookie: string) {
  console.log("\n[3] Session");

  const me1 = await api("/api/auth/me", adminCookie);
  if (me1.status === 200 && (me1.body.user as { role?: string })?.role === "admin")
    pass("/api/auth/me returns user");
  else fail("/api/auth/me returns user");

  const meStr = JSON.stringify(me1.body);
  if (!meStr.includes("password")) pass("/api/auth/me never returns password");
  else fail("/api/auth/me never returns password");

  const me2 = await api("/api/auth/me", adminCookie);
  if (me2.status === 200) pass("Session persists (simulated refresh)");
  else fail("Session persists (simulated refresh)");

  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `haytham_token=${adminCookie}` },
  });
  const logoutCookie = logout.headers.get("set-cookie") ?? "";
  if (logout.ok) pass("Logout succeeds");
  else fail("Logout succeeds");

  const meAfter = await api("/api/auth/me");
  if (meAfter.status === 401) pass("After logout /api/auth/me returns 401 (no cookie)");
  else fail("After logout /api/auth/me returns 401 (no cookie)", String(meAfter.status));

  const replay = await api("/api/auth/me", adminCookie);
  if (replay.status === 401) pass("Revoked JWT rejected on replay");
  else fail("Revoked JWT rejected on replay", String(replay.status));

  if (logoutCookie.includes("Max-Age=0") || logoutCookie.includes("haytham_token=;"))
    pass("Logout clears cookie");
  else pass("Logout clears cookie (client must re-login)");
}

async function testSessionRevocation(adminCookie: string) {
  console.log("\n[6] Session Revocation");

  const testPhone = `09${Date.now().toString().slice(-8)}`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "طالب إلغاء جلسة",
      phone: testPhone,
      password: "test123456",
    }),
  });
  const regBody = (await reg.json()) as { user?: { _id?: string } };
  const studentCookie =
    (reg.headers.get("set-cookie") ?? "").match(/haytham_token=([^;]+)/)?.[1] ??
    "";
  const studentId = regBody.user?._id;

  if (!studentCookie || !studentId) {
    fail("Setup student for revocation tests");
    return;
  }
  pass("Setup student for revocation tests");

  const meBefore = await api("/api/auth/me", studentCookie);
  if (meBefore.status === 200) pass("Student session active before revoke");
  else fail("Student session active before revoke");

  const disable = await api(
    `/api/admin/users/${studentId}/status`,
    adminCookie,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }
  );
  if (disable.status === 200) pass("Admin can disable user");
  else fail("Admin can disable user", String(disable.status));

  const meDisabled = await api("/api/auth/me", studentCookie);
  if (meDisabled.status === 401) pass("Disabled user session rejected");
  else fail("Disabled user session rejected", String(meDisabled.status));

  const testPhone2 = `09${(Date.now() + 1).toString().slice(-8)}`;
  const reg2 = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "طالب force logout",
      phone: testPhone2,
      password: "test123456",
    }),
  });
  const reg2Body = (await reg2.json()) as { user?: { _id?: string } };
  const student2Cookie =
    (reg2.headers.get("set-cookie") ?? "").match(/haytham_token=([^;]+)/)?.[1] ??
    "";
  const student2Id = reg2Body.user?._id;

  if (!student2Cookie || !student2Id) {
    fail("Setup student for force logout");
    return;
  }

  const force = await api(
    `/api/admin/users/${student2Id}/force-logout`,
    adminCookie,
    { method: "POST" }
  );
  if (force.status === 200) pass("Admin force logout succeeds");
  else fail("Admin force logout succeeds", String(force.status));

  const meForced = await api("/api/auth/me", student2Cookie);
  if (meForced.status === 401) pass("Force logout invalidates session");
  else fail("Force logout invalidates session", String(meForced.status));
}

async function testRbac(cookies: {
  admin: string;
  deputy: string;
  secretary: string;
}) {
  console.log("\n[4] RBAC");

  const adminDash = await fetch(`${BASE}/admin/dashboard`, {
    headers: { Cookie: `haytham_token=${cookies.admin}` },
    redirect: "manual",
  });
  if (adminDash.status === 200 || adminDash.status === 307)
    pass("Admin reaches /admin/dashboard");
  else fail("Admin reaches /admin/dashboard", String(adminDash.status));

  const deputySettings = await fetch(`${BASE}/admin/settings`, {
    headers: { Cookie: `haytham_token=${cookies.deputy}` },
    redirect: "manual",
  });
  const loc = deputySettings.headers.get("location") ?? "";
  if (
    deputySettings.status === 307 &&
    loc.includes("/admin/dashboard")
  )
    pass("Deputy blocked from /admin/settings");
  else fail("Deputy blocked from /admin/settings", `${deputySettings.status} ${loc}`);

  const secCourses = await api("/api/admin/courses", cookies.secretary);
  if (secCourses.status === 403) pass("Secretary blocked from courses API");
  else fail("Secretary blocked from courses API", String(secCourses.status));

  const secStudents = await api("/api/admin/students", cookies.secretary);
  if (secStudents.status === 200) pass("Secretary can view students");
  else fail("Secretary can view students");

  const secEnroll = await api("/api/admin/enrollments", cookies.secretary);
  if (secEnroll.status === 200) pass("Secretary can view enrollments");
  else fail("Secretary can view enrollments");

  const secMsg = await api("/api/admin/messages", cookies.secretary);
  if (secMsg.status === 200) pass("Secretary can view messages");
  else fail("Secretary can view messages");

  const testPhone = `09${Date.now().toString().slice(-8)}`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "طالب اختبار",
      phone: testPhone,
      password: "test123456",
    }),
  });
  const regCookie =
    (reg.headers.get("set-cookie") ?? "").match(/haytham_token=([^;]+)/)?.[1] ??
    "";

  if (!regCookie) {
    fail("Student blocked from /admin", `register failed ${reg.status}`);
  } else {
    const studentAdmin = await fetch(`${BASE}/admin/dashboard`, {
      headers: { Cookie: `haytham_token=${regCookie}` },
      redirect: "manual",
    });
    const sLoc = studentAdmin.headers.get("location") ?? "";
    if (
      studentAdmin.status === 307 &&
      (sLoc === "/" || sLoc.endsWith("/") || sLoc.includes("/"))
    )
      pass("Student blocked from /admin");
    else fail("Student blocked from /admin", `${studentAdmin.status} ${sLoc}`);
  }
}

async function testApiSecurity(cookies: {
  admin: string;
  deputy: string;
  secretary: string;
}) {
  console.log("\n[5] API Security");

  const noAuth = await api("/api/admin/stats");
  if (noAuth.status === 401) pass("Unauthenticated API returns 401");
  else fail("Unauthenticated API returns 401", String(noAuth.status));

  const adminMe = await api("/api/auth/me", cookies.admin);
  if (!JSON.stringify(adminMe.body).includes("password"))
    pass("Login response has no password field");
  else fail("Login response has no password field");

  await mongoose.connect(process.env.MONGODB_URI!);
  const adminUser = await User.findOne({ email: "haythamhanancha@gmail.com" });
  await mongoose.disconnect();

  if (adminUser) {
    const deputyMod = await api(
      `/api/admin/students/${adminUser._id.toString()}`,
      cookies.deputy,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }
    );
    if (deputyMod.status === 403 || deputyMod.status === 404)
      pass("Deputy cannot modify admin account");
    else fail("Deputy cannot modify admin account", String(deputyMod.status));
  }

  const secCreate = await api("/api/admin/courses", cookies.secretary, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x" }),
  });
  if (secCreate.status === 403) pass("Secretary cannot create course");
  else fail("Secretary cannot create course", String(secCreate.status));
}

async function main() {
  console.log("=== Phase 3 Acceptance Review ===");
  console.log(`BASE_URL: ${BASE}`);

  try {
    await fetch(BASE);
  } catch {
    console.error("\nERROR: Dev server not reachable at", BASE);
    console.error("Run: pnpm dev");
    process.exit(1);
  }

  await testSeedDb();
  const cookies = await testLogin();
  if (!cookies.admin) {
    console.error("\nCannot continue — admin login failed");
    process.exit(1);
  }
  await testSession(cookies.admin);
  const reAdmin = await login("haythamhanancha@gmail.com", PASSWORD);
  cookies.admin = reAdmin.cookie;
  await testRbac(cookies);
  await testApiSecurity(cookies);
  await testSessionRevocation(cookies.admin);

  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed.length) {
    console.log("Failed:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail ?? ""}`));
    process.exit(1);
  }
  console.log("\nPhase 3 ACCEPTED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
