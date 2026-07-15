import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

const SELECTED_ENV_VAR = "MONGODB_URI";
const RELEVANT_COLLECTIONS = ["users", "sessions"];

function maskHostname(hostname: string): string {
  if (!hostname) return "";
  const parts = hostname.split(".");
  if (parts.length <= 2) return "<masked-host>";
  return `<masked>.${parts.slice(-2).join(".")}`;
}

function parseMongoUri(uri: string) {
  try {
    const parsed = new URL(uri);
    return {
      length: uri.length,
      maskedHostname: maskHostname(parsed.hostname),
      databaseName: parsed.pathname.replace(/^\//, "").split("?")[0] || "",
    };
  } catch {
    return {
      length: uri.length,
      maskedHostname: "",
      databaseName: "",
    };
  }
}

export async function GET(request: Request) {
  const expectedToken = process.env.AUDIT_DIAGNOSTIC_TOKEN;
  const providedToken = request.headers.get("x-audit-token");

  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mongoUri = process.env[SELECTED_ENV_VAR] ?? "";
  const parsedUri = parseMongoUri(mongoUri);

  const connection = await connectDB();
  const db = connection.connection.db;
  const collectionNames = db
    ? (await db.listCollections().toArray())
        .map((collection) => collection.name)
        .filter((name) => RELEVANT_COLLECTIONS.includes(name))
        .sort()
    : [];

  const counts = {
    users: db ? await db.collection("users").estimatedDocumentCount() : null,
    sessions: db ? await db.collection("sessions").estimatedDocumentCount() : null,
  };

  return NextResponse.json({
    selectedEnvVar: SELECTED_ENV_VAR,
    valueExists: Boolean(mongoUri),
    valueLength: parsedUri.length,
    maskedHostname: parsedUri.maskedHostname,
    parsedDatabaseName: parsedUri.databaseName,
    connectedDatabaseName: db?.databaseName ?? "",
    readyState: mongoose.connection.readyState,
    collections: collectionNames,
    counts,
    deploymentCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  });
}
