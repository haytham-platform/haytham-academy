const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "20020319AZEaze";

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ` - ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone: "haythamhanancha@gmail.com", password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  const cookie = (res.headers.get("set-cookie") ?? "").match(/haytham_token=([^;]+)/)?.[1] ?? "";
  return { ok: res.ok, cookie, body };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string>),
      Cookie: `haytham_token=${cookie}`,
    },
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: {}, bytes, text: "" };
  }
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* html or empty */
  }
  return { status: res.status, body, bytes: Buffer.alloc(0), text };
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function createStudent(cookie: string, suffix: string) {
  const res = await api("/api/admin/students", cookie, json({
    name: `طالب قبول ${suffix}`,
    phone: `09${Date.now().toString().slice(-8)}`,
    password: "test123456",
    wilaya: "الوادي",
    studyLevel: "ثانوي",
    academicLevel: "ثانوي",
    gender: "male",
  }));
  const id = (res.body.student as { _id?: string } | undefined)?._id;
  if (res.status === 201 && id) pass(`إنشاء طالب ${suffix}`);
  else fail(`إنشاء طالب ${suffix}`, `${res.status} ${JSON.stringify(res.body)}`);
  return id ?? "";
}

async function createTeacher(cookie: string, suffix: string) {
  const res = await api("/api/admin/teachers", cookie, json({
    name: `أستاذ قبول ${suffix}`,
    subject: "رياضيات",
    subjects: ["رياضيات"],
    phone: `0555${Date.now().toString().slice(-6)}`,
    teachingLevel: "ثانوي",
    academicLevels: ["ثانوي"],
    adminShare: 30,
    status: "active",
    isActive: true,
  }));
  const id = (res.body.teacher as { _id?: string } | undefined)?._id;
  if (res.status === 201 && id) pass(`إنشاء أستاذ ${suffix}`);
  else fail(`إنشاء أستاذ ${suffix}`, `${res.status} ${JSON.stringify(res.body)}`);
  return id ?? "";
}

async function verifyPdf(path: string, cookie: string, name: string) {
  const pdf = await api(path, cookie);
  if (pdf.status === 200 && pdf.bytes.slice(0, 5).toString() === "%PDF-") {
    pass(name, `${pdf.bytes.length} bytes`);
  } else {
    fail(name, `${pdf.status} ${pdf.bytes.slice(0, 20).toString()}`);
  }
}

async function verifyPrint(path: string, cookie: string, name: string) {
  const html = await api(path, cookie);
  if (html.status === 200 && html.text.includes("data:image/png;base64") && html.text.includes("nav, aside, button")) {
    pass(name);
  } else {
    fail(name, `${html.status}`);
  }
}

async function main() {
  console.log("=== Private Lessons + Kindergarten Acceptance ===\n");
  await fetch(BASE).catch(() => {
    throw new Error(`Dev server not reachable at ${BASE}`);
  });

  const admin = await login();
  if (!admin.cookie) {
    fail("تسجيل دخول المدير", JSON.stringify(admin.body));
    process.exit(1);
  }
  pass("تسجيل دخول المدير");

  const financePage = await fetch(`${BASE}/admin/finance`, { headers: { Cookie: `haytham_token=${admin.cookie}` }, redirect: "manual" });
  if (financePage.status === 200) pass("فتح صفحة المالية بجلسة موثقة");
  else fail("فتح صفحة المالية بجلسة موثقة", String(financePage.status));

  const stamp = Date.now().toString().slice(-6);
  const studentId = await createStudent(admin.cookie, stamp);
  const teacherId = await createTeacher(admin.cookie, stamp);
  if (!studentId || !teacherId) throw new Error("Required test student or teacher missing");

  const lessonCreate = await api("/api/admin/private-lessons", admin.cookie, json({
    studentIds: [studentId],
    teacherId,
    lessonDate: "2031-05-10",
    startTime: "10:00",
    endTime: "11:00",
    subject: "رياضيات",
    academicLevel: "ثانوي",
    academicSeason: "2030-2031",
    format: "individual",
    manualPrice: 2000,
    manualPriceOverrideReason: "اختبار قبول نهائي",
    amountPaid: 500,
    idempotencyKey: `accept-pl-${stamp}`,
  }));
  const lesson = lessonCreate.body.lesson as { _id?: string; remainingAmount?: number } | undefined;
  const lessonId = lesson?._id ?? "";
  if (lessonCreate.status === 201 && lessonId) pass("Private Lessons: create lesson");
  else fail("Private Lessons: create lesson", `${lessonCreate.status} ${JSON.stringify(lessonCreate.body)}`);

  if (lessonId) {
    const edit = await api(`/api/admin/private-lessons/${lessonId}`, admin.cookie, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: [studentId],
        teacherId,
        lessonDate: "2031-05-10",
        startTime: "10:15",
        endTime: "11:15",
        subject: "رياضيات",
        academicLevel: "ثانوي",
        academicSeason: "2030-2031",
        format: "individual",
        manualPrice: 2000,
        manualPriceOverrideReason: "اختبار تعديل",
      }),
    });
    if (edit.status === 200) pass("Private Lessons: edit lesson");
    else fail("Private Lessons: edit lesson", `${edit.status} ${JSON.stringify(edit.body)}`);

    const partial = await api(`/api/admin/private-lessons/${lessonId}/payments`, admin.cookie, json({
      amount: 500,
      paymentMethod: "cash",
      idempotencyKey: `accept-pl-pay-part-${stamp}`,
    }));
    if (partial.status === 201) pass("Private Lessons: partial payment");
    else fail("Private Lessons: partial payment", `${partial.status} ${JSON.stringify(partial.body)}`);

    const full = await api(`/api/admin/private-lessons/${lessonId}/payments`, admin.cookie, json({
      amount: 1000,
      paymentMethod: "cash",
      idempotencyKey: `accept-pl-pay-full-${stamp}`,
    }));
    if (full.status === 201) pass("Private Lessons: full payment");
    else fail("Private Lessons: full payment", `${full.status} ${JSON.stringify(full.body)}`);

    await verifyPrint(`/api/admin/private-lessons/${lessonId}/receipt?format=html`, admin.cookie, "Private Lessons: print receipt HTML");
    await verifyPdf(`/api/admin/private-lessons/${lessonId}/receipt?format=pdf`, admin.cookie, "Private Lessons: PDF receipt");

    const complete = await api(`/api/admin/private-lessons/${lessonId}/complete`, admin.cookie, json({}));
    if (complete.status === 200) pass("Private Lessons: complete lesson");
    else fail("Private Lessons: complete lesson", `${complete.status} ${JSON.stringify(complete.body)}`);

    const charges = await api(`/api/admin/student-finance/charges?studentId=${studentId}`, admin.cookie);
    const chargeRows = (charges.body.charges as unknown[] | undefined) ?? [];
    if (charges.status === 200 && chargeRows.length > 0) pass("Private Lessons: financial charge records", `charges=${chargeRows.length}`);
    else fail("Private Lessons: financial charge records", `${charges.status}`);

    const comps = await api("/api/admin/private-lessons/compensations", admin.cookie);
    const compRows = (comps.body.compensations as Array<{ lessonId?: string }> | undefined) ?? [];
    if (comps.status === 200 && compRows.some((row) => row.lessonId === lessonId)) pass("Private Lessons: teacher payout compensation record");
    else fail("Private Lessons: teacher payout compensation record", `${comps.status}`);
  }

  const deleteLesson = await api("/api/admin/private-lessons", admin.cookie, json({
    studentIds: [studentId],
    teacherId,
    lessonDate: "2031-05-10",
    startTime: "12:00",
    endTime: "13:00",
    subject: "رياضيات",
    academicLevel: "ثانوي",
    academicSeason: "2030-2031",
    format: "individual",
    manualPrice: 500,
    manualPriceOverrideReason: "اختبار حذف",
    idempotencyKey: `accept-pl-delete-${stamp}`,
  }));
  const deleteLessonId = (deleteLesson.body.lesson as { _id?: string } | undefined)?._id;
  if (deleteLessonId) {
    const del = await api(`/api/admin/private-lessons/${deleteLessonId}`, admin.cookie, { method: "DELETE" });
    if (del.status === 200) pass("Private Lessons: delete/archive with permission");
    else fail("Private Lessons: delete/archive with permission", `${del.status} ${JSON.stringify(del.body)}`);
  }

  const kgMonthly = await api("/api/admin/kindergarten", admin.cookie, json({
    childName: `طفل شهري ${stamp}`,
    teacherId,
    guardianPhone: `06${Date.now().toString().slice(-8)}`,
    registrationDate: "2031-05-01",
    startDate: "2031-05-02",
    groupName: `فوج شهري ${stamp}`,
    registrationFee: 1000,
    fileFeePaid: 400,
    monthlyPrice: 3000,
    subscriptionType: "monthly",
    monthPeriod: "2031-05",
    amountPaid: 1000,
    startTime: "08:00",
    endTime: "09:30",
    attendanceSchedule: "يومي",
    notes: "اختبار قبول شهري",
  }));
  const kgMonthlyId = (kgMonthly.body.registration as { _id?: string } | undefined)?._id;
  if (kgMonthly.status === 201 && kgMonthlyId) pass("Kindergarten: create monthly registration");
  else fail("Kindergarten: create monthly registration", `${kgMonthly.status} ${JSON.stringify(kgMonthly.body)}`);

  if (kgMonthlyId) {
    const edit = await api(`/api/admin/kindergarten/${kgMonthlyId}`, admin.cookie, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childName: `طفل شهري معدل ${stamp}`,
        teacherId,
        guardianPhone: `06${Date.now().toString().slice(-8)}`,
        groupName: `فوج شهري ${stamp}`,
        attendanceSchedule: "يومي",
        startTime: "08:00",
        endTime: "09:30",
        status: "active",
        notes: "تعديل قبول",
      }),
    });
    if (edit.status === 200) pass("Kindergarten: edit registration");
    else fail("Kindergarten: edit registration", `${edit.status} ${JSON.stringify(edit.body)}`);

    const filePay = await api(`/api/admin/kindergarten/${kgMonthlyId}/payments`, admin.cookie, json({
      paymentType: "registration_fee",
      amount: 600,
      paymentMethod: "cash",
      idempotencyKey: `accept-kg-file-${stamp}`,
    }));
    if (filePay.status === 201) pass("Kindergarten: registration fee payment");
    else fail("Kindergarten: registration fee payment", `${filePay.status} ${JSON.stringify(filePay.body)}`);

    const subPay = await api(`/api/admin/kindergarten/${kgMonthlyId}/payments`, admin.cookie, json({
      paymentType: "monthly_fee",
      amount: 500,
      paymentMethod: "cash",
      idempotencyKey: `accept-kg-sub-part-${stamp}`,
    }));
    if (subPay.status === 201) pass("Kindergarten: partial subscription payment");
    else fail("Kindergarten: partial subscription payment", `${subPay.status} ${JSON.stringify(subPay.body)}`);

    const history = await api(`/api/admin/kindergarten/${kgMonthlyId}/payments`, admin.cookie);
    const payments = (history.body.payments as unknown[] | undefined) ?? [];
    if (history.status === 200 && payments.length >= 2) pass("Kindergarten: payment history", `payments=${payments.length}`);
    else fail("Kindergarten: payment history", `${history.status}`);

    const detail = await api(`/api/admin/kindergarten/${kgMonthlyId}`, admin.cookie);
    const totalOutstanding = ((detail.body.registration as { totalOutstanding?: number } | undefined)?.totalOutstanding ?? -1);
    if (detail.status === 200 && totalOutstanding >= 0) pass("Kindergarten: remaining balance", `remaining=${totalOutstanding}`);
    else fail("Kindergarten: remaining balance", `${detail.status}`);

    await verifyPrint(`/api/admin/kindergarten/${kgMonthlyId}/receipt?format=html`, admin.cookie, "Kindergarten: print receipt HTML");
    await verifyPdf(`/api/admin/kindergarten/${kgMonthlyId}/receipt?format=pdf`, admin.cookie, "Kindergarten: PDF receipt");
  }

  const kgWeekly = await api("/api/admin/kindergarten", admin.cookie, json({
    childName: `طفل أسبوعي ${stamp}`,
    teacherId,
    guardianPhone: `06${(Date.now() + 1).toString().slice(-8)}`,
    registrationDate: "2031-05-01",
    startDate: "2031-05-02",
    groupName: `فوج أسبوعي ${stamp}`,
    registrationFee: 500,
    fileFeePaid: 500,
    weeklyPrice: 900,
    subscriptionType: "weekly",
    weekPeriod: "2031-W19",
    amountPaid: 300,
    startTime: "09:45",
    endTime: "10:45",
    attendanceSchedule: "يومي",
  }));
  const kgWeeklyId = (kgWeekly.body.registration as { _id?: string } | undefined)?._id;
  if (kgWeekly.status === 201 && kgWeeklyId) pass("Kindergarten: create weekly registration");
  else fail("Kindergarten: create weekly registration", `${kgWeekly.status} ${JSON.stringify(kgWeekly.body)}`);

  if (kgWeeklyId) {
    const change = await api(`/api/admin/kindergarten/${kgWeeklyId}/subscription`, admin.cookie, json({
      subscriptionType: "monthly",
      monthlyPrice: 2500,
      currentPeriod: "2031-06",
      reason: "اختبار تغيير الاشتراك",
    }));
    if (change.status === 200) pass("Kindergarten: weekly to monthly subscription change");
    else fail("Kindergarten: weekly to monthly subscription change", `${change.status} ${JSON.stringify(change.body)}`);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\nResult: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
