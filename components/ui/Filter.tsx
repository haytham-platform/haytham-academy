"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function Filter({
  label,
  options,
  value,
  onChange,
  className,
}: FilterProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              value === option.value
                ? "bg-primary text-white shadow-soft"
                : "border border-border bg-white text-foreground hover:border-secondary hover:text-secondary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
