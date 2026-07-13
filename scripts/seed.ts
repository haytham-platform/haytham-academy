import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";
import User from "../models/User";
import Teacher from "../models/Teacher";
import Course from "../models/Course";
import { hashPassword } from "../lib/auth";

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
    /* .env optional when vars are set in shell */
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is required in .env");
  process.exit(1);
}

if (!STAFF_PASSWORD || STAFF_PASSWORD.length < 8) {
  console.error("STAFF_PASSWORD is required in .env and must be at least 8 characters");
  process.exit(1);
}

const staffAccounts = [
  {
    email: "haythamhanancha@gmail.com",
    name: "هيثم حنانشة",
    role: "admin" as const,
  },
  {
    phone: "0672991053",
    name: "نائب المدير",
    role: "deputy" as const,
  },
  {
    phone: "0676955623",
    name: "السكرتيرة",
    role: "secretary" as const,
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected to MongoDB");

  const hashedPassword = await hashPassword(STAFF_PASSWORD);

  for (const account of staffAccounts) {
    const filter = account.email
      ? { email: account.email }
      : { phone: account.phone };

    const existingUser = await User.findOne(filter);
    if (existingUser) {
      console.log(`Staff account already exists: ${account.name} (${account.role})`);
      continue;
    }

    await User.create({
      ...account,
      password: hashedPassword,
      isActive: true,
    });
    console.log(`Staff account created: ${account.name} (${account.role})`);
  }

  const teacherSeeds = [
    {
      name: "أستاذ أحمد بن علي",
      subject: "الرياضيات",
      phone: "0555123456",
      teachingLevel: "بكالوريا - علوم",
      adminShare: 30,
      isActive: true,
    },
    {
      name: "أستاذة فاطمة مرزوق",
      subject: "اللغة العربية",
      phone: "0555987654",
      teachingLevel: "ثانوي",
      adminShare: 25,
      isActive: true,
    },
    {
      name: "أستاذ كريم بوزيان",
      subject: "الفيزياء",
      phone: "0555789012",
      teachingLevel: "بكالوريا - علوم",
      adminShare: 30,
      isActive: true,
    },
  ];

  const teachers = [];
  for (const teacherSeed of teacherSeeds) {
    const teacher = await Teacher.findOneAndUpdate(
      { phone: teacherSeed.phone },
      { $setOnInsert: teacherSeed },
      { returnDocument: "after", upsert: true }
    );
    teachers.push(teacher);
  }
  console.log(`Created ${teachers.length} teachers`);

  const courseSeeds = [
    {
      title: "دورة الرياضيات - البكالوريا",
      description: "دورة شاملة لتحضير طلاب البكالوريا في مادة الرياضيات مع تمارين تطبيقية",
      teacher: teachers[0]._id,
      price: 8000,
      image: "",
      level: "متقدم",
      duration: "3 أشهر",
      startDate: new Date("2026-09-01"),
      seats: 25,
      remainingSeats: 25,
      isActive: true,
    },
    {
      title: "دورة اللغة العربية - الثانوية",
      description: "تقوية في القواعد والأدب والتعبير الكتابي للمرحلة الثانوية",
      teacher: teachers[1]._id,
      price: 6000,
      image: "",
      level: "متوسط",
      duration: "2 شهر",
      startDate: new Date("2026-09-15"),
      seats: 30,
      remainingSeats: 30,
      isActive: true,
    },
    {
      title: "دورة الفيزياء - البكالوريا",
      description: "شرح مفصل للدروس مع حل تمارين الامتحانات السابقة",
      teacher: teachers[2]._id,
      price: 7500,
      image: "",
      level: "متقدم",
      duration: "3 أشهر",
      startDate: new Date("2026-09-01"),
      seats: 20,
      remainingSeats: 20,
      isActive: true,
    },
    {
      title: "دورة الرياضيات - المتوسط",
      description: "مراجعة وتقوية في الرياضيات للمرحلة المتوسطة",
      teacher: teachers[0]._id,
      price: 5000,
      image: "",
      level: "مبتدئ",
      duration: "6 أسابيع",
      startDate: new Date("2026-10-01"),
      seats: 25,
      remainingSeats: 25,
      isActive: true,
    },
    {
      title: "دورة التعبير الكتابي",
      description: "تطوير مهارات الكتابة والتعبير للطلاب في جميع المراحل",
      teacher: teachers[1]._id,
      price: 4500,
      image: "",
      level: "جميع المستويات",
      duration: "4 أسابيع",
      startDate: new Date("2026-10-15"),
      seats: 20,
      remainingSeats: 20,
      isActive: true,
    },
  ];

  const courses = [];
  for (const courseSeed of courseSeeds) {
    const course = await Course.findOneAndUpdate(
      { title: courseSeed.title },
      { $setOnInsert: courseSeed },
      { returnDocument: "after", upsert: true }
    );
    courses.push(course);
  }
  console.log(`Created ${courses.length} courses`);

  console.log("\nSeed completed successfully!");
  console.log("Staff accounts checked (admin, deputy, secretary)");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
