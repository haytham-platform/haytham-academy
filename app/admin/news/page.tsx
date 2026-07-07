"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { mockNews } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { MockNews } from "@/types/ui";

export default function AdminNewsPage() {
  const [articles, setArticles] = useState(mockNews);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MockNews | null>(null);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "إعلانات",
  });

  function openCreate() {
    setEditing(null);
    setForm({ title: "", excerpt: "", content: "", category: "إعلانات" });
    setModalOpen(true);
  }

  function openEdit(article: MockNews) {
    setEditing(article);
    setForm({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
    });
    setModalOpen(true);
  }

  function handleSave() {
    if (editing) {
      setArticles((prev) =>
        prev.map((a) =>
          a._id === editing._id
            ? { ...a, ...form }
            : a
        )
      );
    } else {
      setArticles((prev) => [
        {
          _id: `n${Date.now()}`,
          ...form,
          image: "",
          author: "إدارة الأكاديمية",
          publishedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الخبر؟")) return;
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
          <Textarea
            label="المحتوى"
            rows={5}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} fullWidth>حفظ</Button>
            <Button variant="outline" onClick={() => setModalOpen(false)} fullWidth>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
