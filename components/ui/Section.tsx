"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Container from "./Container";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
  background?: "default" | "white" | "primary" | "muted";
  animate?: boolean;
}

const backgrounds = {
  default: "bg-background",
  white: "bg-white",
  primary: "gradient-hero text-white",
  muted: "bg-gray-50",
};

export default function Section({
  children,
  className,
  containerClassName,
  id,
  background = "default",
  animate = true,
}: SectionProps) {
  const content = (
    <Container className={containerClassName}>{children}</Container>
  );

  if (!animate) {
    return (
      <section id={id} className={cn("py-16 md:py-20", backgrounds[background], className)}>
        {content}
      </section>
    );
  }

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("py-16 md:py-20", backgrounds[background], className)}
    >
      {content}
    </motion.section>
  );
}
