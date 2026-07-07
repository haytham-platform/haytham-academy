"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ACADEMY } from "@/lib/constants";

interface AcademyLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  href?: string;
  variant?: "light" | "dark";
}

const sizes = {
  sm: { ar: "text-sm", en: "text-[10px]" },
  md: { ar: "text-sm", en: "text-[10px]" },
  lg: { ar: "text-lg", en: "text-xs" },
};

export default function AcademyLogo({
  size = "md",
  showText = true,
  className,
  href = "/",
  variant = "light",
}: AcademyLogoProps) {
  const s = sizes[size];

  if (!showText) {
    return (
      <Link
        href={href}
        className={cn("font-bold transition hover:opacity-90", s.ar, className)}
        aria-label={`${ACADEMY.name} - الرئيسية`}
      >
        {ACADEMY.name}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn("block transition hover:opacity-90", className)}
      aria-label={`${ACADEMY.name} - الرئيسية`}
    >
      <p
        className={cn(
          "font-bold leading-tight",
          s.ar,
          variant === "light" ? "text-primary" : "text-white"
        )}
      >
        {ACADEMY.name}
      </p>
      <p
        className={cn(
          "leading-tight",
          s.en,
          variant === "light" ? "text-muted" : "text-pink-200"
        )}
      >
        {ACADEMY.nameEn}
      </p>
    </Link>
  );
}
