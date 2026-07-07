import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({
  children,
  className,
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card shadow-soft",
        paddings[padding],
        hover && "transition hover:-translate-y-1 hover:shadow-soft-lg",
        className
      )}
    >
      {children}
    </article>
  );
}
