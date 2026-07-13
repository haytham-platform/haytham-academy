"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetUrl("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setResetUrl(data.resetUrl || "");
      setSubmitted(true);
    } catch {
      setError("حدث خطأ أثناء إنشاء رابط إعادة التعيين");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="نسيت كلمة المرور"
      subtitle="أدخل رقم هاتفك وسنرسل لك رابط إعادة التعيين"
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {submitted ? (
        <div className="rounded-xl bg-green-50 p-4 text-center">
          <Mail className="mx-auto mb-3 h-10 w-10 text-green-600" />
          <p className="font-medium text-green-800">تم إرسال رابط إعادة التعيين</p>
          <p className="mt-2 text-sm text-green-700">
            تحقق من رسائلك أو تواصل مع الإدارة إذا لم تستلم الرابط.
          </p>
          {resetUrl && (
            <Link href={resetUrl} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              فتح رابط إعادة التعيين
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
          )}
          <Input
            label="رقم الهاتف"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            إرسال رابط إعادة التعيين
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
