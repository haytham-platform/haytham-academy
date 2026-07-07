import { cn } from "@/lib/utils";

interface TitleProps {
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  badge?: string;
  className?: string;
  dark?: boolean;
}

export default function Title({
  title,
  subtitle,
  align = "start",
  badge,
  className,
  dark = false,
}: TitleProps) {
  return (
    <div
      className={cn(
        align === "center" && "text-center mx-auto",
        className
      )}
    >
      {badge && (
        <span className="mb-3 inline-flex rounded-full bg-pink-100 px-4 py-1 text-xs font-semibold text-primary">
          {badge}
        </span>
      )}
      <h2
        className={cn(
          "section-title",
          align === "center" && "mx-auto",
          dark && "text-white"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "section-subtitle",
            align === "center" && "mx-auto",
            dark && "text-pink-100"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
