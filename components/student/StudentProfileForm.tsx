"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface StudentProfileFormProps {
  name: string;
  phone?: string;
}

export default function StudentProfileForm({ name, phone }: StudentProfileFormProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setPassword("");
      setMessage(data.message);
    } catch {
      setError("حدث خطأ أثناء تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      <Input label="الاسم الكامل" defaultValue={name} readOnly />
      <Input label="رقم الهاتف" defaultValue={phone} readOnly />
      <Input
        label="كلمة المرور الجديدة"
        type="password"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" fullWidth loading={loading} disabled={!password}>
        حفظ التغييرات
      </Button>
    </form>
  );
}
