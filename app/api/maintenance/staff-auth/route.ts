import crypto from "crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { comparePassword, hashPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const dynamic = "force-dynamic";

type StaffKey = "admin" | "deputy" | "secretary";

type StaffSpec = {
  key: StaffKey;
  role: StaffKey;
  name: string;
  identifier: "email" | "phone";
  email?: string;
  phone?: string;
};

type RequestBody = {
  action?: "inspect" | "repair";
  backupHash?: string;
  passwords?: Partial<Record<StaffKey, string>>;
};

const STAFF_SPECS: StaffSpec[] = [
  {
    key: "admin",
    role: "admin",
    name: "Haytham Hanancha",
    identifier: "email",
    email: "haythamhanancha@gmail.com",
  },
  {
    key: "deputy",
    role: "deputy",
    name: "Deputy Director",
    identifier: "phone",
    phone: "0672991053",
  },
  {
    key: "secretary",
    role: "secretary",
    name: "Secretary",
    identifier: "phone",
    phone: "0676955623",
  },
];

const STAFF_ROLES = STAFF_SPECS.map((spec) => spec.role);

function forbidden() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function sanitizeDocument(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    role: doc.role ?? null,
    isActive: doc.isActive ?? null,
    status: doc.status ?? null,
    hasPasswordHash: typeof doc.password === "string" && doc.password.length > 0,
    passwordHashAlgorithm:
      typeof doc.password === "string" && doc.password.startsWith("$2")
        ? "bcrypt"
        : "invalid-or-missing",
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

async function loadSnapshot() {
  await connectDB();

  const identityFilters = STAFF_SPECS.map((spec) =>
    spec.identifier === "email" ? { email: spec.email } : { phone: spec.phone }
  );

  const docs = await User.find({
    $or: [{ role: { $in: STAFF_ROLES } }, ...identityFilters],
  })
    .select("+password")
    .lean();

  const sortedDocs = docs
    .map((doc) => JSON.parse(JSON.stringify(doc)) as Record<string, unknown>)
    .sort((a, b) => String(a._id).localeCompare(String(b._id)));

  return {
    generatedAt: new Date().toISOString(),
    databaseName: mongoose.connection.db?.databaseName ?? "",
    collection: "users",
    documents: sortedDocs,
  };
}

function findMatches(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  spec: StaffSpec
) {
  return snapshot.documents.filter((doc) =>
    spec.identifier === "email" ? doc.email === spec.email : doc.phone === spec.phone
  );
}

async function validateAccount(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  spec: StaffSpec,
  password?: string
){
  const matches = findMatches(snapshot, spec);
  const issues: string[] = [];
  const changes: Record<string, unknown> = {};
  let passwordVerifies: boolean | null = null;

  if (matches.length === 0) {
    issues.push("missing_account");
    changes.create = true;
    return {
      key: spec.key,
      expectedIdentifier: spec.identifier === "email" ? spec.email : spec.phone,
      matchCount: 0,
      duplicate: false,
      issues,
      plannedChanges: changes,
      passwordVerifies,
      document: null,
    };
  }

  if (matches.length > 1) {
    issues.push("duplicate_account");
    return {
      key: spec.key,
      expectedIdentifier: spec.identifier === "email" ? spec.email : spec.phone,
      matchCount: matches.length,
      duplicate: true,
      issues,
      plannedChanges: {},
      passwordVerifies,
      documents: matches.map(sanitizeDocument),
    };
  }

  const doc = matches[0];
  const passwordHash = typeof doc.password === "string" ? doc.password : "";

  if (doc.role !== spec.role) {
    issues.push("invalid_role");
    changes.role = spec.role;
  }
  if (doc.isActive !== true) {
    issues.push("disabled_account");
    changes.isActive = true;
  }
  if (doc.status !== "active") {
    issues.push("invalid_status");
    changes.status = "active";
  }
  if (spec.email && doc.email !== spec.email) {
    issues.push("email_mismatch");
    changes.email = spec.email;
  }
  if (spec.phone && doc.phone !== spec.phone) {
    issues.push("phone_mismatch");
    changes.phone = spec.phone;
  }
  if (!doc.name || typeof doc.name !== "string") {
    issues.push("schema_mismatch_name");
    changes.name = spec.name;
  }
  if (!passwordHash.startsWith("$2")) {
    issues.push("invalid_password_hash");
    changes.password = "bcrypt";
  } else if (password) {
    passwordVerifies = await comparePassword(password, passwordHash);
    if (!passwordVerifies) {
      issues.push("password_does_not_verify");
      changes.password = "bcrypt";
    }
  }

  return {
    key: spec.key,
    expectedIdentifier: spec.identifier === "email" ? spec.email : spec.phone,
    matchCount: 1,
    duplicate: false,
    issues,
    plannedChanges: changes,
    passwordVerifies,
    schema: {
      hasVerifiedPath: Boolean(User.schema.path("verified")),
      compatible: Boolean(doc.name && doc.password && (doc.email || doc.phone)),
    },
    document: sanitizeDocument(doc),
  };
}

async function buildReport(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  passwords?: RequestBody["passwords"]
) {
  const accounts = [];
  for (const spec of STAFF_SPECS) {
    accounts.push(await validateAccount(snapshot, spec, passwords?.[spec.key]));
  }

  const duplicateRoles = STAFF_ROLES.flatMap((role) => {
    const docs = snapshot.documents.filter((doc) => doc.role === role);
    return docs.length > 1
      ? [{ role, count: docs.length, documents: docs.map(sanitizeDocument) }]
      : [];
  });

  return {
    staffKeys: STAFF_SPECS.map((spec) => spec.key),
    databaseName: snapshot.databaseName,
    snapshotHash: sha256(snapshot.documents),
    inspectedDocumentCount: snapshot.documents.length,
    inspectedAccounts: accounts,
    duplicateRoles,
    backup: snapshot,
  };
}

async function repairAccounts(
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>,
  passwords: NonNullable<RequestBody["passwords"]>
) {
  const repaired: Array<{ key: StaffKey; id: string; fieldsChanged: string[] }> = [];
  const created: Array<{ key: StaffKey; id: string; fieldsSet: string[] }> = [];
  const skipped: Array<{ key: StaffKey; reason: string }> = [];

  for (const spec of STAFF_SPECS) {
    const matches = findMatches(snapshot, spec);
    const password = passwords[spec.key];

    if (!password || password.length < 8) {
      skipped.push({ key: spec.key, reason: "missing_or_short_password" });
      continue;
    }

    if (matches.length > 1) {
      skipped.push({ key: spec.key, reason: "duplicate_account" });
      continue;
    }

    if (matches.length === 0) {
      const createdUser = await User.create({
        name: spec.name,
        ...(spec.email ? { email: spec.email } : {}),
        ...(spec.phone ? { phone: spec.phone } : {}),
        role: spec.role,
        status: "active",
        isActive: true,
        password: await hashPassword(password),
      });
      created.push({
        key: spec.key,
        id: createdUser._id.toString(),
        fieldsSet: ["name", spec.identifier, "role", "status", "isActive", "password"],
      });
      continue;
    }

    const doc = matches[0];
    const set: Record<string, unknown> = {};
    const fieldsChanged: string[] = [];

    if (doc.role !== spec.role) {
      set.role = spec.role;
      fieldsChanged.push("role");
    }
    if (doc.isActive !== true) {
      set.isActive = true;
      fieldsChanged.push("isActive");
    }
    if (doc.status !== "active") {
      set.status = "active";
      fieldsChanged.push("status");
    }
    if (spec.email && doc.email !== spec.email) {
      set.email = spec.email;
      fieldsChanged.push("email");
    }
    if (spec.phone && doc.phone !== spec.phone) {
      set.phone = spec.phone;
      fieldsChanged.push("phone");
    }
    if (!doc.name || typeof doc.name !== "string") {
      set.name = spec.name;
      fieldsChanged.push("name");
    }

    const passwordHash = typeof doc.password === "string" ? doc.password : "";
    const passwordOk =
      passwordHash.startsWith("$2") && (await comparePassword(password, passwordHash));
    if (!passwordOk) {
      set.password = await hashPassword(password);
      fieldsChanged.push("password");
    }

    if (fieldsChanged.length > 0) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(String(doc._id)) },
        { $set: set },
        { runValidators: true }
      );
      repaired.push({ key: spec.key, id: String(doc._id), fieldsChanged });
    }
  }

  return { repaired, created, skipped };
}

export async function POST(request: Request) {
  const expectedToken = process.env.MAINTENANCE_STAFF_AUTH_TOKEN;
  const providedToken = request.headers.get("x-maintenance-token");

  if (!expectedToken || providedToken !== expectedToken) {
    return forbidden();
  }

  const body = (await request.json()) as RequestBody;
  const snapshot = await loadSnapshot();
  const report = await buildReport(snapshot, body.passwords);

  if (body.action === "inspect") {
    return NextResponse.json(report);
  }

  if (body.action !== "repair") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!body.backupHash || body.backupHash !== report.snapshotHash) {
    return NextResponse.json(
      { error: "Backup hash mismatch; inspect and save backup before repair" },
      { status: 409 }
    );
  }

  const duplicateAccount = report.inspectedAccounts.find((account) => account.duplicate);
  if (duplicateAccount) {
    return NextResponse.json(
      { error: "Duplicate account detected; refusing automatic repair", report },
      { status: 409 }
    );
  }

  const changes = await repairAccounts(snapshot, body.passwords ?? {});
  const afterSnapshot = await loadSnapshot();
  const afterReport = await buildReport(afterSnapshot, body.passwords);

  return NextResponse.json({
    beforeHash: report.snapshotHash,
    afterHash: afterReport.snapshotHash,
    changes,
    after: {
      inspectedAccounts: afterReport.inspectedAccounts,
      duplicateRoles: afterReport.duplicateRoles,
      inspectedDocumentCount: afterReport.inspectedDocumentCount,
    },
  });
}
