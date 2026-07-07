/**
 * Phase 5 Academic Management acceptance tests
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
  console.log("=== Phase 5 Academic Acceptance ===\n");

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

  const depTeachers = await api("/api/admin/teachers", deputy.cookie);
  if (depTeachers.status === 200) pass("Deputy can manage teachers");
  else fail("Deputy teachers API", String(depTeachers.status));

  const secTeachersDel = await api("/api/admin/teachers/fake", secretary.cookie, { method: "DELETE" });
  if (secTeachersDel.status === 403) pass("Secretary blocked from teachers");
  else fail("Secretary teachers blocked", String(secTeachersDel.status));

  const secStudents = await api("/api/admin/students?page=1&limit=5", secretary.cookie);
  if (secStudents.status === 200) pass("Secretary can view students");
  else fail("Secretary students view", String(secStudents.status));

  const secStudentPost = await api("/api/admin/students", secretary.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "x", phone: "000" }),
  });
  if (secStudentPost.status === 403) pass("Secretary blocked from student create");
  else fail("Secretary student create blocked", String(secStudentPost.status));

  console.log("\n[Students CRUD]");
  const phone = `09${Date.now().toString().slice(-8)}`;
  const createStudent = await api("/api/admin/students", admin.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "طالب اختبار",
      phone,
      password: "test123456",
      wilaya: "الجزائر",
      studyLevel: "ثانوي",
      gender: "male",
    }),
  });
  const studentId = (createStudent.body.student as { _id?: string })?._id;
  if (createStudent.status === 201 && studentId) pass("Create student");
  else fail("Create student", String(createStudent.status));

  if (studentId) {
    const updateStudent = await api(`/api/admin/students/${studentId}`, admin.cookie, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyLevel: "بكالوريا", notes: "ملاحظة" }),
    });
    if (updateStudent.status === 200) pass("Update student");
    else fail("Update student", String(updateStudent.status));

    const searchStudents = await api(
      `/api/admin/students?search=${encodeURIComponent("طالب")}&page=1&limit=5`,
      admin.cookie
    );
    const list = (searchStudents.body.students as unknown[]) ?? [];
    const pag = searchStudents.body.pagination as { total?: number };
    if (searchStudents.status === 200 && list.length > 0 && pag?.total !== undefined) {
      pass("Student search/filter/pagination", `total=${pag.total}`);
    } else fail("Student search/filter/pagination", `status=${searchStudents.status} count=${list.length}`);

    const delRes = await api(`/api/admin/students/${studentId}`, admin.cookie, { method: "DELETE" });
    if (delRes.status !== 200) fail("Soft delete student", String(delRes.status));
    else pass("Soft delete student");

    const restore = await api(`/api/admin/students/${studentId}/restore`, admin.cookie, { method: "POST" });
    if (restore.status === 200) pass("Restore student");
    else fail("Restore student", String(restore.status));
  }

  console.log("\n[Teachers CRUD]");
  const createTeacher = await api("/api/admin/teachers", admin.cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "أستاذ اختبار",
      subject: "علوم",
      phone: `0555${Date.now().toString().slice(-6)}`,
      teachingLevel: "بكالوريا",
      adminShare: 40,
    }),
  });
  const teacherId = (createTeacher.body.teacher as { _id?: string })?._id;
  if (createTeacher.status === 201 && teacherId) pass("Create teacher");
  else fail("Create teacher", String(createTeacher.status));

  if (teacherId) {
    const updateTeacher = await api(`/api/admin/teachers/${teacherId}`, admin.cookie, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teachingLevel: "ثانوي", adminShare: 35 }),
    });
    if (updateTeacher.status === 200) pass("Update teacher");
    else fail("Update teacher", String(updateTeacher.status));
  }

  console.log("\n[Courses CRUD + Enrollments]");
  let courseId = "";
  if (teacherId) {
    const createCourse = await api("/api/admin/courses", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "دورة اختبار",
        description: "وصف",
        teacher: teacherId,
        price: 3000,
        level: "مبتدئ",
        duration: "1 شهر",
        startDate: new Date().toISOString(),
        seats: 2,
        department: "علوم",
        room: "A1",
      }),
    });
    courseId = (createCourse.body.course as { _id?: string })?._id ?? "";
    const remaining = (createCourse.body.course as { remainingSeats?: number })?.remainingSeats;
    if (createCourse.status === 201 && courseId && remaining === 2) {
      pass("Create course with seats", `remaining=${remaining}`);
    } else fail("Create course", String(createCourse.status));
  }

  if (studentId && courseId) {
    const enroll1 = await api("/api/admin/enrollments", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, courseId, status: "pending" }),
    });
    const enrollmentId = (enroll1.body.enrollment as { _id?: string })?._id;
    if (enroll1.status === 201 && enrollmentId) pass("Create enrollment");
    else fail("Create enrollment", String(enroll1.status));

    const courseAfter = await api(`/api/admin/courses/${courseId}`, admin.cookie);
    const remainingAfter =
      (courseAfter.body.course as { remainingSeats?: number })?.remainingSeats ?? -1;
    if (courseAfter.status === 200 && remainingAfter === 1) {
      pass("Seats decrease on enrollment", `remaining=${remainingAfter}`);
    } else fail("Seats decrease", `status=${courseAfter.status} remaining=${remainingAfter}`);

    const dup = await api("/api/admin/enrollments", admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, courseId, status: "pending" }),
    });
    if (dup.status === 409) pass("Duplicate enrollment blocked");
    else fail("Duplicate enrollment blocked", String(dup.status));

    if (enrollmentId) {
      const approve = await api(`/api/admin/enrollments/${enrollmentId}`, admin.cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (approve.status === 200) pass("Approve enrollment");
      else fail("Approve enrollment", String(approve.status));
    }
  }

  console.log("\n[Stats + Reports]");
  const stats = await api("/api/admin/stats", admin.cookie);
  const s = stats.body.stats as {
    students?: number;
    activeStudents?: number;
    remainingSeats?: number;
    topCourse?: unknown;
  };
  if (stats.status === 200 && s?.students !== undefined && s.activeStudents !== undefined) {
    pass("Stats API", `students=${s.students}`);
  } else fail("Stats API");

  const reportStudents = await api("/api/admin/reports/students?page=1&limit=5", admin.cookie);
  if (reportStudents.status === 200 && reportStudents.body.pagination) pass("Reports students");
  else fail("Reports students", String(reportStudents.status));

  const secReport = await api("/api/admin/reports/enrollments", secretary.cookie);
  if (secReport.status === 200) pass("Secretary can view reports");
  else fail("Secretary reports", String(secReport.status));

  const secEnroll = await api("/api/admin/enrollments/meta", secretary.cookie);
  if (secEnroll.status === 200) pass("Secretary enrollment meta");
  else fail("Secretary enrollment meta", String(secEnroll.status));

  if (teacherId) {
    await api(`/api/admin/teachers/${teacherId}`, admin.cookie, { method: "DELETE" });
  }
  if (courseId) {
    await api(`/api/admin/courses/${courseId}`, admin.cookie, { method: "DELETE" });
  }

  console.log("\n=== Summary ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail ?? ""}`));
    process.exit(1);
  }
  console.log("\nPhase 5 Academic ACCEPTED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
