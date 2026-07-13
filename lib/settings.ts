import { connectDB } from "@/lib/db";
import { ACADEMY } from "@/lib/constants";
import AcademySettings, {
  type IAcademySettings,
  type IAcademyService,
  type IAcademyStat,
  type IAcademyTestimonial,
} from "@/models/AcademySettings";

export const defaultServices: IAcademyService[] = [
  {
    title: "دورات البكالوريا",
    description: "تحضير شامل لجميع شعب البكالوريا مع تمارين وامتحانات تجريبية",
    icon: "graduation-cap",
  },
  {
    title: "الدعم المدرسي",
    description: "مرافقة أكاديمية للمراحل المتوسطة والثانوية في جميع المواد",
    icon: "book-open",
  },
  {
    title: "دورات اللغات",
    description: "تعلم اللغات الأجنبية بطرق حديثة وتفاعلية",
    icon: "languages",
  },
  {
    title: "التكوين المهني",
    description: "مهارات عملية ودورات تقنية لتأهيل الطلاب لسوق العمل",
    icon: "briefcase",
  },
];

export const defaultStats: IAcademyStat[] = [
  { label: "طالب مسجل", value: "1200+", icon: "users" },
  { label: "دورة تعليمية", value: "45+", icon: "book" },
  { label: "أستاذ متميز", value: "18+", icon: "award" },
  { label: "نسبة النجاح", value: "95%", icon: "trophy" },
];

export const defaultTestimonials: IAcademyTestimonial[] = [
  {
    name: "ياسين بوعزة",
    role: "طالب بكالوريا - علوم",
    content:
      "بفضل أكاديمية هيثم نجحت في مادة الرياضيات بمعدل ممتاز. الأساتذة محترفون والمتابعة ممتازة.",
    rating: 5,
    avatar: "",
  },
  {
    name: "مريم خليفي",
    role: "طالبة ثانوية",
    content:
      "تجربة رائعة! الدروس منظمة والجو التعليمي محفز. أنصح كل طالب بالانضمام.",
    rating: 5,
    avatar: "",
  },
  {
    name: "أمين زروقي",
    role: "طالب بكالوريا - آداب",
    content:
      "تحسنت كثيراً في اللغة العربية والتعبير الكتابي. شكراً للأستاذة فاطمة على جهودها.",
    rating: 4,
    avatar: "",
  },
];

const DEFAULT_DESCRIPTION =
  "منصة تعليمية متخصصة في تقديم دورات عالية الجودة لمساعدة الطلاب على تحقيق أهدافهم.";

function formatService(service: IAcademyService): IAcademyService {
  return {
    title: service.title,
    description: service.description,
    icon: service.icon,
  };
}

function formatStat(stat: IAcademyStat): IAcademyStat {
  return {
    label: stat.label,
    value: stat.value,
    icon: stat.icon,
  };
}

function formatTestimonial(testimonial: IAcademyTestimonial): IAcademyTestimonial {
  return {
    name: testimonial.name,
    role: testimonial.role,
    content: testimonial.content,
    rating: testimonial.rating,
    avatar: testimonial.avatar ?? "",
  };
}

export function formatSettings(settings: IAcademySettings) {
  return {
    _id: settings._id.toString(),
    name: settings.name,
    nameEn: settings.nameEn,
    description: settings.description,
    phone: settings.phone,
    address: settings.address,
    services: (settings.services ?? []).map(formatService),
    stats: (settings.stats ?? []).map(formatStat),
    testimonials: (settings.testimonials ?? []).map(formatTestimonial),
    updatedAt: settings.updatedAt?.toISOString?.() ?? "",
  };
}

export async function getAcademySettings() {
  await connectDB();
  const settings = await AcademySettings.findOneAndUpdate(
    { singletonKey: "academy" },
    {
      $setOnInsert: {
        singletonKey: "academy",
        name: ACADEMY.name,
        nameEn: ACADEMY.nameEn,
        description: DEFAULT_DESCRIPTION,
        phone: ACADEMY.phone,
        address: ACADEMY.address,
        services: defaultServices,
        stats: defaultStats,
        testimonials: defaultTestimonials,
      },
    },
    { returnDocument: "after", upsert: true }
  );

  return settings;
}
