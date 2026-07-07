import { cn } from "@/lib/utils";

interface PaginationProps {
  page?: number;
  currentPage?: number;
  totalPages: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  page,
  currentPage,
  totalPages,
  hasPrev,
  hasNext,
  onPageChange,
  className,
}: PaginationProps) {
  const activePage = page ?? currentPage ?? 1;
  const prev = hasPrev ?? activePage > 1;
  const next = hasNext ?? activePage < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-between gap-2 text-sm",
        className
      )}
    >
      <p className="text-muted">
        صفحة {activePage} من {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!prev}
          onClick={() => onPageChange(activePage - 1)}
          className={cn(
            "rounded-lg border border-border px-3 py-1.5",
            prev ? "hover:bg-muted/10" : "opacity-40"
          )}
        >
          السابق
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => onPageChange(activePage + 1)}
          className={cn(
            "rounded-lg border border-border px-3 py-1.5",
            next ? "hover:bg-muted/10" : "opacity-40"
          )}
        >
          التالي
        </button>
      </div>
    </div>
  );
}
