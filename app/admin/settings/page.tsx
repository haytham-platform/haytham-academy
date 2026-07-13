"use client";

import { useEffect, useState } from "react";
import { Save, Building2, Phone } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

const emptyForm = {
  name: "",
  nameEn: "",
  phone: "",
  address: "",
  description: "",
};

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "حدث خطأ");
          return;
        }
        if (active) {
          setForm({
            name: data.settings.name || "",
            nameEn: data.settings.nameEn || "",
            phone: data.settings.phone || "",
            address: data.settings.address || "",
            description: data.settings.description || "",
          });
        }
      } catch {
        setError("حدث خطأ أثناء جلب الإعدادات");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setForm({
        name: data.settings.name || "",
        nameEn: data.settings.nameEn || "",
        phone: data.settings.phone || "",
        address: data.settings.address || "",
        description: data.settings.description || "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Title title="الإعدادات" subtitle="إدارة معلومات الأكاديمية العامة" className="mb-8" />

      {error && (
        <div className="mx-auto mb-4 max-w-2xl rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted">جاري التحميل...</p>
      ) : (
        <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-bold">معلومات الأكاديمية</h2>
            </div>
            <div className="space-y-4">
              <Input
                label="اسم الأكاديمية"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="اسم الأكاديمية بالإنجليزية"
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              />
              <Textarea
                label="الوصف"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="font-bold">معلومات التواصل</h2>
            </div>
            <div className="space-y-4">
              <Input
                label="رقم الهاتف"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                label="العنوان"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </Card>

          {saved && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">
              تم حفظ الإعدادات بنجاح
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={saving}>
            <Save className="h-4 w-4" />
            حفظ الإعدادات
          </Button>
        </form>
      )}
    </div>
  );
}
