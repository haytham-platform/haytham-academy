"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (form.password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setError("");
    setDone(true);
  }

  return (
    <AuthLayout
      title="إعادة تعيين كلمة المرور"
      subtitle="أدخل كلمة المرور الجديدة"
    >
      {done ? (
        <div className="text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <p className="font-medium text-green-800">تم تغيير كلمة المرور بنجاح</p>
          <Button href="/login" className="mt-6" fullWidth>
            <ArrowLeft className="h-4 w-4" />
            تسجيل الدخول
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
          )}
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Input
            label="تأكيد كلمة المرور"
            type="password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
          <Button type="submit" fullWidth size="lg">
            حفظ كلمة المرور
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-secondary hover:underline">العودة لتسجيل الدخول</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
