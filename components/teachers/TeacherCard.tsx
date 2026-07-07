import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface TeacherCardProps {
  teacher: {
    _id: string;
    name: string;
    subject: string;
    teachingLevel: string;
  };
}

export default function TeacherCard({ teacher }: TeacherCardProps) {
  return (
    <Link href={`/teachers/${teacher._id}`}>
      <Card hover className="group h-full text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-sky-50 text-3xl transition group-hover:scale-105">
          <span className="text-2xl font-bold text-primary" aria-hidden="true">
            {teacher.name.charAt(0)}
          </span>
        </div>
        <h3 className="text-lg font-bold transition group-hover:text-primary">
          {teacher.name}
        </h3>
        <Badge className="mt-2">{teacher.subject}</Badge>
        <p className="mt-3 text-sm leading-6 text-muted">{teacher.teachingLevel}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-secondary opacity-0 transition group-hover:opacity-100">
          عرض الملف
          <ArrowLeft className="h-3.5 w-3.5" />
        </span>
      </Card>
    </Link>
  );
}
