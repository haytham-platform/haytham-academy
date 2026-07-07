import type {
  MockCourse,
  MockTeacher,
  MockNews,
  MockTestimonial,
  MockStat,
  MockService,
  MockNotification,
} from "@/types/ui";

export const mockStats: MockStat[] = [
  { label: "طالب مسجل", value: "1200+", icon: "users" },
  { label: "دورة تعليمية", value: "45+", icon: "book" },
  { label: "أستاذ متميز", value: "18+", icon: "award" },
  { label: "نسبة النجاح", value: "95%", icon: "trophy" },
];

export const mockServices: MockService[] = [
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

export const mockTeachers: MockTeacher[] = [
  {
    _id: "t1",
    name: "أستاذ أحمد بن علي",
    subject: "الرياضيات",
    phone: "0555123456",
    teachingLevel: "بكالوريا - علوم",
    subjects: ["الرياضيات", "الفيزياء التطبيقية"],
  },
  {
    _id: "t2",
    name: "أستاذة فاطمة مرزوق",
    subject: "اللغة العربية",
    phone: "0555987654",
    teachingLevel: "ثانوي",
    subjects: ["اللغة العربية", "الأدب", "التعبير الكتابي"],
  },
  {
    _id: "t3",
    name: "أستاذ كريم بوزيان",
    subject: "الفيزياء",
    phone: "0555789012",
    teachingLevel: "بكالوريا - علوم",
    subjects: ["الفيزياء", "العلوم"],
  },
  {
    _id: "t4",
    name: "أستاذة سارة حمدي",
    subject: "اللغة الإنجليزية",
    phone: "0555345678",
    teachingLevel: "جميع المستويات",
    subjects: ["اللغة الإنجليزية"],
  },
];

export const mockCourses: MockCourse[] = [
  {
    _id: "c1",
    title: "دورة الرياضيات - البكالوريا",
    description:
      "دورة شاملة لتحضير طلاب البكالوريا في مادة الرياضيات مع تمارين تطبيقية وحلول مفصلة لامتحانات سنوات سابقة.",
    teacher: { _id: "t1", name: "أستاذ أحمد بن علي", subject: "الرياضيات" },
    price: 8000,
    image: "",
    level: "متقدم",
    duration: "3 أشهر",
    startDate: "2026-09-01",
    seats: 25,
  },
  {
    _id: "c2",
    title: "دورة اللغة العربية - الثانوية",
    description:
      "تقوية في القواعد والأدب والتعبير الكتابي للمرحلة الثانوية مع متابعة فردية.",
    teacher: { _id: "t2", name: "أستاذة فاطمة مرزوق", subject: "اللغة العربية" },
    price: 6000,
    image: "",
    level: "متوسط",
    duration: "2 شهر",
    startDate: "2026-09-15",
    seats: 30,
  },
  {
    _id: "c3",
    title: "دورة الفيزياء - البكالوريا",
    description: "شرح مفصل للدروس مع حل تمارين الامتحانات السابقة وتطبيقات عملية.",
    teacher: { _id: "t3", name: "أستاذ كريم بوزيان", subject: "الفيزياء" },
    price: 7500,
    image: "",
    level: "متقدم",
    duration: "3 أشهر",
    startDate: "2026-09-01",
    seats: 20,
  },
  {
    _id: "c4",
    title: "دورة الرياضيات - المتوسط",
    description: "مراجعة وتقوية في الرياضيات للمرحلة المتوسطة مع تمارين تفاعلية.",
    teacher: { _id: "t1", name: "أستاذ أحمد بن علي", subject: "الرياضيات" },
    price: 5000,
    image: "",
    level: "مبتدئ",
    duration: "6 أسابيع",
    startDate: "2026-10-01",
    seats: 25,
  },
  {
    _id: "c5",
    title: "دورة التعبير الكتابي",
    description: "تطوير مهارات الكتابة والتعبير للطلاب في جميع المراحل.",
    teacher: { _id: "t2", name: "أستاذة فاطمة مرزوق", subject: "اللغة العربية" },
    price: 4500,
    image: "",
    level: "جميع المستويات",
    duration: "4 أسابيع",
    startDate: "2026-10-15",
    seats: 20,
  },
  {
    _id: "c6",
    title: "دورة اللغة الإنجليزية - B1",
    description: "تعلم اللغة الإنجليزية للمستوى المتوسط مع التركيز على المحادثة.",
    teacher: { _id: "t4", name: "أستاذة سارة حمدي", subject: "اللغة الإنجليزية" },
    price: 5500,
    image: "",
    level: "متوسط",
    duration: "2 شهر",
    startDate: "2026-11-01",
    seats: 15,
  },
];

export const mockNews: MockNews[] = [
  {
    _id: "n1",
    title: "افتتاح التسجيل للموسم الدراسي 2026-2027",
    excerpt: "نعلن عن بدء التسجيل في جميع دورات الأكاديمية للموسم الدراسي الجديد.",
    content:
      "يسعدنا الإعلان عن افتتاح باب التسجيل للموسم الدراسي 2026-2027. نوفر دورات متنوعة في جميع المواد الأساسية مع أساتذة ذوي خبرة. سارع بالتسجيل قبل اكتمال العدد.",
    image: "",
    category: "إعلانات",
    author: "إدارة الأكاديمية",
    publishedAt: "2026-06-15",
  },
  {
    _id: "n2",
    title: "نتائج مميزة لطلابنا في امتحان البكالوريا",
    excerpt: "حقق طلابنا نسبة نجاح بلغت 95% في امتحان البكالوريا 2025.",
    content:
      "نفخر بنتائج طلابنا المتميزة في امتحان البكالوريا 2025 حيث حقق 95% من المشاركين النجاح. هذا إنجاز يعكس جودة التعليم في أكاديميتنا.",
    image: "",
    category: "إنجازات",
    author: "إدارة الأكاديمية",
    publishedAt: "2026-06-01",
  },
  {
    _id: "n3",
    title: "ورشة عمل مجانية: مهارات المذاكرة الفعالة",
    excerpt: "ورشة تدريبية مجانية لجميع الطلاب حول طرق المذاكرة الذكية.",
    content:
      "ندعو جميع الطلاب لحضور ورشة عمل مجانية حول مهارات المذاكرة الفعالة. ستتضمن الورشة تقنيات التحفيز الذاتي وإدارة الوقت.",
    image: "",
    category: "فعاليات",
    author: "أستاذ أحمد بن علي",
    publishedAt: "2026-05-20",
  },
];

export const mockTestimonials: MockTestimonial[] = [
  {
    _id: "r1",
    name: "ياسين بوعزة",
    role: "طالب بكالوريا - علوم",
    content:
      "بفضل أكاديمية هيثم نجحت في مادة الرياضيات بمعدل ممتاز. الأساتذة محترفون والمتابعة ممتازة.",
    rating: 5,
    avatar: "",
  },
  {
    _id: "r2",
    name: "مريم خليفي",
    role: "طالبة ثانوية",
    content:
      "تجربة رائعة! الدروس منظمة والجو التعليمي محفز. أنصح كل طالب بالانضمام.",
    rating: 5,
    avatar: "",
  },
  {
    _id: "r3",
    name: "أمين زروقي",
    role: "طالب بكالوريا - آداب",
    content:
      "تحسنت كثيراً في اللغة العربية والتعبير الكتابي. شكراً لأستاذة فاطمة على جهودها.",
    rating: 4,
    avatar: "",
  },
];

export const mockNotifications: MockNotification[] = [
  {
    _id: "not1",
    title: "تم قبول تسجيلك",
    message: "تم قبول طلب تسجيلك في دورة الرياضيات - البكالوريا",
    read: false,
    createdAt: "2026-06-20",
  },
  {
    _id: "not2",
    title: "تذكير بالحصة",
    message: "لديك حصة غداً الساعة 14:00 في قاعة A2",
    read: true,
    createdAt: "2026-06-18",
  },
  {
    _id: "not3",
    title: "دورة جديدة",
    message: "تم إضافة دورة اللغة الإنجليزية - B1. سجل الآن!",
    read: true,
    createdAt: "2026-06-10",
  },
];

export function getMockCourseById(id: string): MockCourse | undefined {
  return mockCourses.find((c) => c._id === id);
}

export function getMockTeacherById(id: string): MockTeacher | undefined {
  return mockTeachers.find((t) => t._id === id);
}

export function getMockNewsById(id: string): MockNews | undefined {
  return mockNews.find((n) => n._id === id);
}

export function getMockCoursesByTeacherId(teacherId: string): MockCourse[] {
  return mockCourses.filter((c) => c.teacher._id === teacherId);
}
