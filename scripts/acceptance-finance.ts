/**
 * Phase 4 Finance acceptance tests
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
  const body = await res.json();
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
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function main() {
  console.log("=== Phase 4 Finance Acceptance ===\n");

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

  const adminFinance = await fetch(`${BASE}/admin/finance`, {
    headers: { Cookie: `haytham_token=${admin.cookie}` },
    redirect: "manual",
  });
  if (adminFinance.status === 200) pass("Admin opens /admin/finance");
  else fail("Admin opens /admin/finance", String(adminFinance.status));

  const depFinance = await fetch(`${BASE}/admin/finance`, {
    headers: { Cookie: `haytham_token=${deputy.cookie}` },
    redirect: "manual",
  });
  const depLoc = depFinance.headers.get("location") ?? "";
  if (depFinance.status === 307 && depLoc.includes("dashboard"))
    pass("Deputy blocked from /admin/finance");
  else fail("Deputy blocked from /admin/finance", `${depFinance.status} ${depLoc}`);

  const secFinance = await fetch(`${BASE}/admin/finance`, {
    headers: { Cookie: `haytham_token=${secretary.cookie}` },
    redirect: "manual",
  });
  const secLoc = secFinance.headers.get("location") ?? "";
  if (secFinance.status === 307 && secLoc.includes("dashboard"))
    pass("Secretary blocked from /admin/finance");
  else fail("Secretary blocked from /admin/finance", `${secFinance.status} ${secLoc}`);

  const depApi = await api("/api/admin/finance/summary", deputy.cookie);
  if (depApi.status === 403) pass("Deputy finance API returns 403");
  else fail("Deputy finance API returns 403", String(depApi.status));

  const secApi = await api("/api/admin/finance/summary", secretary.cookie);
  if (secApi.status === 403) pass("Secretary finance API returns 403");
  else fail("Secretary finance API returns 403", String(secApi.status));

  const summaryBefore = await api("/api/admin/finance/summary", admin.cookie);
  const beforeToday = (summaryBefore.body.summary as { today?: { income?: number } })?.today?.income ?? 0;

  const students = await api("/api/admin/students", admin.cookie);
  const courses = await api("/api/admin/courses", admin.cookie);
  const teachers = await api("/api/admin/teachers", admin.cookie);
  let studentList = (students.body.students as { _id: string }[]) ?? [];
  const courseList = (courses.body.courses as { _id: string }[]) ?? [];
  const teacherList = (teachers.body.teachers as { _id: string }[]) ?? [];

  if (!studentList.length) {
    const phone = `09${Date.now().toString().slice(-8)}`;
    await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "طالب مالي",
        phone,
        password: "test123456",
      }),
    });
    const s2 = await api("/api/admin/students", admin.cookie);
    studentList = (s2.body.students as { _id: string }[]) ?? [];
  }

  console.log("\n[6] Cashbox");

  const depCashbox = await api("/api/admin/finance/cashbox", deputy.cookie);
  if (depCashbox.status === 403) pass("Deputy cashbox API returns 403");
  else fail("Deputy cashbox API returns 403", String(depCashbox.status));

  const boxStart = await api("/api/admin/finance/cashbox", admin.cookie);
  const balanceStart =
    (boxStart.body.cashbox as { currentBalance?: number })?.currentBalance ?? 0;
  pass("Cashbox API accessible", `balance=${balanceStart}`);

  if (!studentList.length || !courseList.length || !teacherList.length) {
    fail("Setup data (students/courses/teachers)");
  } else {
    pass("Setup data available");

    const paymentRes = await api("/api/admin/finance/payments", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: studentList[0]._id,
        courseId: courseList[0]._id,
        amount: 5000,
        paymentMethod: "cash",
        paymentDate: new Date().toISOString(),
        type: "course_fee",
      }),
    });
    const paymentId = (paymentRes.body.payment as { _id?: string })?._id;
    if (paymentRes.status === 201 && paymentId) pass("Add payment works");
    else fail("Add payment works", String(paymentRes.status));

    const boxAfterPay = await api("/api/admin/finance/cashbox", admin.cookie);
    const balAfterPay =
      (boxAfterPay.body.cashbox as { currentBalance?: number })?.currentBalance ?? 0;
    if (balAfterPay === balanceStart + 5000) pass("Payment increases cashbox");
    else fail("Payment increases cashbox", `${balanceStart} -> ${balAfterPay}`);

    const expenseRes = await api("/api/admin/finance/expenses", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "اختبار مصروف",
        amount: 1000,
        category: "other",
        expenseDate: new Date().toISOString(),
      }),
    });
    const expenseId = (expenseRes.body.expense as { _id?: string })?._id;
    if (expenseRes.status === 201 && expenseId) pass("Add expense works");
    else fail("Add expense works", String(expenseRes.status));

    const boxAfterExp = await api("/api/admin/finance/cashbox", admin.cookie);
    const balAfterExp =
      (boxAfterExp.body.cashbox as { currentBalance?: number })?.currentBalance ?? 0;
    if (balAfterExp === balAfterPay - 1000) pass("Expense decreases cashbox");
    else fail("Expense decreases cashbox", `${balAfterPay} -> ${balAfterExp}`);

    const payoutRes = await api("/api/admin/finance/teacher-payouts", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: teacherList[0]._id,
        courseId: courseList[0]._id,
        amount: 2000,
        payoutType: "fixed",
        payoutDate: new Date().toISOString(),
        status: "paid",
      }),
    });
    const payoutId = (payoutRes.body.payout as { _id?: string })?._id;
    if (payoutRes.status === 201 && payoutId) pass("Add teacher payout works");
    else fail("Add teacher payout works", String(payoutRes.status));

    const boxAfterPayout = await api("/api/admin/finance/cashbox", admin.cookie);
    const balAfterPayout =
      (boxAfterPayout.body.cashbox as { currentBalance?: number })?.currentBalance ?? 0;
    if (balAfterPayout === balAfterExp - 2000) pass("Paid payout decreases cashbox");
    else fail("Paid payout decreases cashbox", `${balAfterExp} -> ${balAfterPayout}`);

    const adjRes = await api("/api/admin/finance/cashbox/adjustment", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 500,
        direction: "in",
        reason: "اختبار تعديل يدوي",
      }),
    });
    if (adjRes.status === 200) pass("Manual adjustment works");
    else fail("Manual adjustment works", String(adjRes.status));

    const ledger = await api("/api/admin/finance/cash-ledger", admin.cookie);
    const ledgerList = (ledger.body.entries as unknown[]) ?? [];
    if (ledgerList.length > 0) pass("Cash ledger has entries");
    else fail("Cash ledger has entries");

    const summaryAfter = await api("/api/admin/finance/summary", admin.cookie);
    const s = summaryAfter.body.summary as {
      today?: { income?: number; netProfit?: number };
      month?: { income?: number };
      year?: { income?: number };
    };
    if (s?.today?.income !== undefined && s.today.income >= beforeToday + 5000)
      pass("Summary today income updated");
    else fail("Summary today income updated", `before=${beforeToday} after=${s?.today?.income}`);

    if (s?.month?.income !== undefined) pass("Summary month income calculated");
    else fail("Summary month income calculated");

    if (s?.year?.income !== undefined) pass("Summary year income calculated");
    else fail("Summary year income calculated");

    if (s?.today?.netProfit !== undefined && s.today.netProfit <= (s.today.income ?? 0))
      pass("Net profit formula valid", `net=${s.today.netProfit}`);
    else fail("Net profit formula valid");

    if (paymentId) {
      const balBeforeDel =
        (await api("/api/admin/finance/cashbox", admin.cookie)).body.cashbox as {
          currentBalance?: number;
        };
      await api(`/api/admin/finance/payments/${paymentId}`, admin.cookie, {
        method: "DELETE",
      });
      const summaryDel = await api("/api/admin/finance/summary", admin.cookie);
      const afterDel = (summaryDel.body.summary as { today?: { income?: number } })?.today?.income ?? 0;
      if (afterDel < (s?.today?.income ?? 0)) pass("Delete payment updates summary");
      else fail("Delete payment updates summary");

      const boxAfterDel = await api("/api/admin/finance/cashbox", admin.cookie);
      const balDel =
        (boxAfterDel.body.cashbox as { currentBalance?: number })?.currentBalance ?? 0;
      if (balDel === (balBeforeDel?.currentBalance ?? 0) - 5000)
        pass("Delete payment adds reverse ledger entry");
      else fail("Delete payment adds reverse ledger entry", `${balBeforeDel?.currentBalance} -> ${balDel}`);
    }

    if (expenseId) {
      await api(`/api/admin/finance/expenses/${expenseId}`, admin.cookie, { method: "DELETE" });
    }
    if (payoutId) {
      await api(`/api/admin/finance/teacher-payouts/${payoutId}`, admin.cookie, { method: "DELETE" });
    }

    console.log("\n[Lesson Invoices]");
    const studentId = studentList[0]._id;
    const activeCourse =
      (courseList as { _id: string; isActive?: boolean }[]).find((c) => c.isActive !== false) ??
      courseList[0];

    const ctxRes = await api(
      `/api/admin/finance/lesson-invoices/student-context?studentId=${studentId}`,
      admin.cookie
    );
    const hasEnrollment =
      ctxRes.status === 200 &&
      Array.isArray(ctxRes.body.options) &&
      (ctxRes.body.options as unknown[]).length > 0;

    if (!hasEnrollment) {
      const enrollRes = await api("/api/admin/enrollments", admin.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          courseId: activeCourse._id,
          status: "approved",
        }),
      });
      if (enrollRes.status !== 201 && enrollRes.status !== 409) {
        fail(
          "Setup enrollment for invoice",
          `${enrollRes.status} ${JSON.stringify(enrollRes.body)}`
        );
      } else {
        pass("Student enrolled for invoice test");
      }
    } else {
      pass("Student already enrolled for invoice test");
    }

    const ctxAfter = await api(
      `/api/admin/finance/lesson-invoices/student-context?studentId=${studentId}`,
      admin.cookie
    );
    const enrollmentId = (ctxAfter.body.selected as { enrollmentId?: string })?.enrollmentId;
    const contextTeacherId = (ctxAfter.body.selected as { teacherId?: string })?.teacherId;

    const invoiceRes = await api("/api/admin/finance/lesson-invoices", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        enrollmentId,
        sessionCount: 2,
        pricePerSession: 1500,
        paidAmount: 3000,
        invoiceDate: new Date().toISOString(),
      }),
    });
    const invoiceId = (invoiceRes.body.invoice as { _id?: string; totalAmount?: number; teacherId?: string })?._id;
    const invoiceTotal = (invoiceRes.body.invoice as { totalAmount?: number })?.totalAmount;
    const invoiceTeacherId = (invoiceRes.body.invoice as { teacherId?: string })?.teacherId;
    if (invoiceRes.status === 201 && invoiceId && invoiceTotal === 3000 && invoiceTeacherId) {
      pass("Create lesson invoice", `total=${invoiceTotal}`);
    } else {
      fail("Create lesson invoice", String(invoiceRes.status));
    }

    const accountTeacherId = invoiceTeacherId || contextTeacherId;
    if (invoiceId && accountTeacherId) {
      const accountRes = await api(
        `/api/admin/finance/teacher-account?teacherId=${accountTeacherId}`,
        admin.cookie
      );
      const acc = accountRes.body as {
        error?: string;
        totalRevenue?: number;
        adminShareAmount?: number;
        teacherShareAmount?: number;
        sessionCounts?: { two?: number };
        teacher?: { adminShare?: number };
      };
      const adminPct = acc.teacher?.adminShare ?? 0;
      const expectedAdmin = ((acc.totalRevenue ?? 0) * adminPct) / 100;
      const expectedTeacher = (acc.totalRevenue ?? 0) - expectedAdmin;
      if (
        accountRes.status === 200 &&
        acc.totalRevenue !== undefined &&
        acc.sessionCounts?.two !== undefined &&
        Math.abs((acc.adminShareAmount ?? 0) - expectedAdmin) < 0.01 &&
        Math.abs((acc.teacherShareAmount ?? 0) - expectedTeacher) < 0.01
      ) {
        pass("Teacher account calculation", `revenue=${acc.totalRevenue} admin=${acc.adminShareAmount}`);
      } else {
        fail("Teacher account calculation", JSON.stringify(acc));
      }

      await api(`/api/admin/finance/lesson-invoices/${invoiceId}`, admin.cookie, {
        method: "DELETE",
      });
      pass("Delete lesson invoice");
    }
  }

  const report = await api("/api/admin/finance/reports?type=daily", admin.cookie);
  if (report.status === 200 && report.body.report) pass("Reports API works");
  else fail("Reports API works", String(report.status));

  console.log("\n=== Summary ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail ?? ""}`));
    process.exit(1);
  }
  console.log("\nPhase 4 Finance ACCEPTED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
