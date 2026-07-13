"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("رابط إعادة التعيين غير صالح");
      return;
    }
    if (form.password !== form.confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (form.password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setDone(true);
    } catch {
      setError("حدث خطأ أثناء تغيير كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="إعادة تعيين كلمة المرور"
      subtitle="أدخل كلمة المرور الجديدة"
    >
      {!token ? (
        <div className="text-center">
          <p className="font-medium text-red-700">رابط إعادة التعيين غير صالح</p>
          <Button href="/forgot-password" className="mt-6" fullWidth>
            طلب رابط جديد
          </Button>
        </div>
      ) : done ? (
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
          <Button type="submit" fullWidth size="lg" loading={loading}>
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
