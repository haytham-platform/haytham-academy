export interface CourseCardData {
  _id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  level: string;
  duration: string;
  startDate: string;
  seats: number;
  teacher: {
    _id: string;
    name: string;
    subject: string;
  } | null;
}

export interface CourseDetailData extends CourseCardData {
  teacher: {
    _id: string;
    name: string;
    subject: string;
  };
}

export interface TeacherCardData {
  _id: string;
  name: string;
  subject: string;
  teachingLevel: string;
  subjects?: string[];
  academicLevels?: string[];
}

export interface NewsCardData {
  _id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  isPublished?: boolean;
  publishedAt: string;
}

export interface AcademyServiceData {
  title: string;
  description: string;
  icon: string;
}

export interface AcademyStatData {
  label: string;
  value: string;
  icon: string;
}

export interface AcademyTestimonialData {
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar?: string;
}
