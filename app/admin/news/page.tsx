"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import type { NewsCardData } from "@/types/ui";

const emptyForm = {
  title: "",
  excerpt: "",
  content: "",
  category: "إعلانات",
  image: "",
};

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<NewsCardData[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NewsCardData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadNews() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/news");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setArticles(data.news || []);
    } catch {
      setError("حدث خطأ أثناء جلب الأخبار");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/news");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "حدث خطأ");
          return;
        }
        if (active) setArticles(data.news || []);
      } catch {
        setError("حدث خطأ أثناء جلب الأخبار");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(article: NewsCardData) {
    setEditing(article);
    setForm({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      image: article.image,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const url = editing ? `/api/admin/news/${editing._id}` : "/api/admin/news";
    const method = editing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setModalOpen(false);
      await loadNews();
    } catch {
      setError("حدث خطأ أثناء حفظ الخبر");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الخبر؟")) return;
    const res = await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "حدث خطأ أثناء حذف الخبر");
      return;
    }
    setArticles((prev) => prev.filter((a) => a._id !== id));
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Title title="إدارة الأخبار" subtitle="إضافة وتعديل وحذف الأخبار والمقالات" />
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          إضافة خبر
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : articles.length > 0 ? (
        <div className="space-y-4">
          {articles.map((article) => (
            <Card key={article._id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{article.category}</Badge>
                    <span className="text-xs text-muted">{formatDate(article.publishedAt)}</span>
                  </div>
                  <h3 className="mt-2 font-bold">{article.title}</h3>
                  <p className="mt-1 text-sm text-muted">{article.excerpt}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(article)}>
                    <Pencil className="h-3.5 w-3.5" />
                    تعديل
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(article._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted">لا توجد أخبار منشورة بعد</p>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "تعديل خبر" : "إضافة خبر جديد"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="العنوان"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            label="التصنيف"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            label="المقتطف"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          />
          <Input
            label="رابط الصورة"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />
          <Textarea
            label="المحتوى"
            rows={5}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} fullWidth>حفظ</Button>
            <Button variant="outline" onClick={() => setModalOpen(false)} fullWidth>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
