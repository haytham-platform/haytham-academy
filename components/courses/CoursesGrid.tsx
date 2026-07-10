"use client";

import { useMemo, useState } from "react";
import CourseCard from "@/components/courses/CourseCard";
import SearchBox from "@/components/ui/SearchBox";
import Filter from "@/components/ui/Filter";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import type { CourseCardData } from "@/types/ui";

const ITEMS_PER_PAGE = 6;

const levelOptions = [
  { value: "all", label: "الكل" },
  { value: "مبتدئ", label: "مبتدئ" },
  { value: "متوسط", label: "متوسط" },
  { value: "متقدم", label: "متقدم" },
  { value: "جميع المستويات", label: "جميع المستويات" },
];

interface CoursesGridProps {
  courses: CourseCardData[];
}

export default function CoursesGrid({ courses }: CoursesGridProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !search ||
        course.title.includes(search) ||
        course.description.includes(search) ||
        course.teacher?.name?.includes(search);
      const matchesLevel = level === "all" || course.level === level;
      return matchesSearch && matchesLevel;
    });
  }, [courses, search, level]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SearchBox
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="ابحث عن دورة..."
          className="lg:max-w-md"
        />
        <Filter
          label="المستوى"
          options={levelOptions}
          value={level}
          onChange={(v) => { setLevel(v); setPage(1); }}
        />
      </div>

      {paginated.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginated.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            className="mt-10"
          />
        </>
      ) : (
        <EmptyState
          title="لا توجد دورات"
          description="لم نجد دورات تطابق بحثك. جرب تغيير معايير البحث."
          actionLabel="عرض جميع الدورات"
          onAction={() => { setSearch(""); setLevel("all"); setPage(1); }}
        />
      )}
    </div>
  );
}
