import bcrypt from "bcryptjs";
import mongoose from "mongoose";
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

const STAFF_PASSWORD = "20020319AZEaze";

const accounts = [
  { key: "admin", query: { email: "haythamhanancha@gmail.com" } },
  { key: "deputy", query: { phone: "0672991053" } },
  { key: "secretary", query: { phone: "0676955623" } },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("FAIL: MONGODB_URI missing");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("FAIL: JWT_SECRET missing");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB\n");

  let ok = true;

  for (const { key, query } of accounts) {
    const user = await User.findOne(query).select("+password");
    if (!user) {
      console.error(`FAIL: ${key} account not found in DB`);
      ok = false;
      continue;
    }

    const valid = await bcrypt.compare(STAFF_PASSWORD, user.password);
    const hashed = user.password.startsWith("$2");

    console.log(`${key}:`);
    console.log(`  name: ${user.name}`);
    console.log(`  role: ${user.role}`);
    console.log(`  email: ${user.email ?? "-"}`);
    console.log(`  phone: ${user.phone ?? "-"}`);
    console.log(`  password hashed: ${hashed ? "yes" : "NO"}`);
    console.log(`  password verifies: ${valid ? "yes" : "NO"}`);

    if (!valid || !hashed) ok = false;
    console.log("");
  }

  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
