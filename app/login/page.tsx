"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { getDashboardPath } from "@/lib/permissions";
import type { UserRole } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ emailOrPhone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      router.push(getDashboardPath(data.user.role as UserRole));
      router.refresh();
    } catch {
      setError("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="تسجيل الدخول"
      subtitle="أدخل بريدك الإلكتروني أو رقم هاتفك وكلمة المرور"
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            إنشاء حساب طالب
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
        )}
        <Input
          label="البريد الإلكتروني أو رقم الهاتف"
          type="text"
          required
          autoComplete="username"
          placeholder="example@email.com أو 0676955623"
          value={form.emailOrPhone}
          onChange={(e) => setForm({ ...form, emailOrPhone: e.target.value })}
        />
        <Input
          label="كلمة المرور"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="text-end">
          <Link href="/forgot-password" className="text-sm text-secondary hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>
        <Button type="submit" loading={loading} fullWidth size="lg">
          تسجيل الدخول
        </Button>
      </form>
    </AuthLayout>
  );
}
