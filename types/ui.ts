export interface MockCourse {
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
  };
}

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

export interface TeacherCardData {
  _id: string;
  name: string;
  subject: string;
  teachingLevel: string;
}

export interface MockTeacher {
  _id: string;
  name: string;
  subject: string;
  phone: string;
  teachingLevel: string;
  subjects: string[];
}

export interface MockNews {
  _id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  publishedAt: string;
}

export interface MockTestimonial {
  _id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar: string;
}

export interface MockStat {
  label: string;
  value: string;
  icon: string;
}

export interface MockService {
  title: string;
  description: string;
  icon: string;
}

export interface MockNotification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
