import { NextResponse } from "next/server";

import { comparePassword, hashPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const dynamic = "force-dynamic";

type StaffKey = "admin" | "deputy" | "secretary";

type StaffSpec = {
  key: StaffKey;
  role: StaffKey;
  identifierType: "email" | "phone";
  identifier: string;
};

type RequestBody = {
  action?: "inspect" | "reset";
  password?: string;
};

const STAFF: StaffSpec[] = [
  {
    key: "admin",
    role: "admin",
    identifierType: "email",
    identifier: "haythamhanancha@gmail.com",
  },
  {
    key: "deputy",
    role: "deputy",
    identifierType: "phone",
    identifier: "0672991053",
  },
  {
    key: "secretary",
    role: "secretary",
    identifierType: "phone",
    identifier: "0676955623",
  },
];

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function queryFor(spec: StaffSpec) {
  return spec.identifierType === "email"
    ? { email: spec.identifier.toLowerCase() }
    : { phone: spec.identifier };
}

function sanitizeUser(user: Awaited<ReturnType<typeof User.findOne>>) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role,
    isActive: user.isActive,
    status: user.status,
    passwordHashAlgorithm: user.password?.startsWith("$2")
      ? "bcrypt"
      : "invalid-or-missing",
    schemaCompatible: Boolean(user.name && user.password && (user.email || user.phone)),
  };
}

async function inspect(password?: string) {
  await connectDB();

  const accounts = [];
  const duplicates = [];

  for (const spec of STAFF) {
    const matches = await User.find(queryFor(spec)).select("+password");
    if (matches.length > 1) {
      duplicates.push({
        key: spec.key,
        identifierType: spec.identifierType,
        identifier: spec.identifier,
        count: matches.length,
        ids: matches.map((user) => user._id.toString()),
      });
    }

    const user = matches[0] ?? null;
    accounts.push({
      key: spec.key,
      expectedRole: spec.role,
      identifierType: spec.identifierType,
      identifier: spec.identifier,
      found: matches.length === 1,
      matchCount: matches.length,
      passwordVerifies:
        user && password ? await comparePassword(password, user.password) : null,
      issues: [
        ...(matches.length === 0 ? ["missing_account"] : []),
        ...(matches.length > 1 ? ["duplicate_account"] : []),
        ...(user && user.role !== spec.role ? ["role_mismatch"] : []),
        ...(user && user.isActive !== true ? ["disabled_account"] : []),
        ...(user && user.status !== "active" ? ["status_not_active"] : []),
        ...(user && !user.password?.startsWith("$2") ? ["invalid_password_hash"] : []),
      ],
      user: sanitizeUser(user),
    });
  }

  return { accounts, duplicates };
}

export async function POST(request: Request) {
  const expected = process.env.MAINTENANCE_STAFF_PASSWORD_TOKEN;
  const provided = request.headers.get("x-maintenance-token");

  if (!expected || provided !== expected) {
    return unauthorized();
  }

  const body = (await request.json()) as RequestBody;

  if (body.action === "inspect") {
    return NextResponse.json(await inspect(body.password));
  }

  if (body.action !== "reset") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: "Password missing or too short" }, { status: 400 });
  }

  const before = await inspect(body.password);
  if (before.duplicates.length > 0) {
    return NextResponse.json({ error: "Duplicate account found", before }, { status: 409 });
  }
  const missing = before.accounts.filter((account) => !account.found);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Account missing", before }, { status: 409 });
  }

  const hashedPassword = await hashPassword(body.password);
  const reset = [];

  for (const spec of STAFF) {
    const result = await User.updateOne(queryFor(spec), {
      $set: { password: hashedPassword },
    });
    reset.push({
      key: spec.key,
      identifierType: spec.identifierType,
      identifier: spec.identifier,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      fieldsChanged: ["password"],
    });
  }

  return NextResponse.json({
    before,
    reset,
    after: await inspect(body.password),
  });
}
