"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AcademyLogo from "@/components/ui/AcademyLogo";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-pink-50 via-background to-gray-50 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 lg:grid-cols-2 lg:items-center lg:px-8">
        <div className="hidden lg:block">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            العودة للرئيسية
          </Link>
          <AcademyLogo size="lg" className="mb-6" />
          <p className="mt-4 text-lg leading-8 text-muted">
            منصة تعليمية متكاملة تساعدك على تحقيق أهدافك الأكاديمية. انضم
            إلينا وابدأ رحلة النجاح.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {["1200+ طالب", "45+ دورة", "18+ أستاذ", "95% نجاح"].map((stat) => (
              <div key={stat} className="rounded-2xl bg-white p-4 shadow-soft">
                <p className="font-bold text-primary">{stat.split(" ")[0]}</p>
                <p className="text-xs text-muted">{stat.split(" ").slice(1).join(" ")}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="!shadow-soft-lg">
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-border pt-4 text-center text-sm">{footer}</div>}
        </Card>
      </div>
    </div>
  );
}

export { Input, Button };
