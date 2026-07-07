"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";

interface Message {
  _id: string;
  name: string;
  phone: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const res = await fetch("/api/admin/messages");
    const data = await res.json();
    setMessages(data.messages || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const res = await fetch("/api/admin/messages");
      const data = await res.json();
      if (active) {
        setMessages(data.messages || []);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function markAsRead(id: string) {
    await fetch(`/api/admin/messages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;
    await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    loadData();
  }

  return (
    <div>
      <Title title="رسائل التواصل" subtitle="عرض وإدارة رسائل الزوار" className="mb-8" />

        {loading ? (
          <p className="text-muted">جاري التحميل...</p>
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg._id} className={`card ${!msg.isRead ? "border-primary bg-blue-50/30" : ""}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{msg.name}</h3>
                      {!msg.isRead && <span className="badge badge-pending">جديدة</span>}
                    </div>
                    <p className="text-sm text-muted">{msg.phone}</p>
                    <p className="mt-2 text-sm leading-7">{msg.message}</p>
                  </div>
                  <div className="flex gap-2">
                    {!msg.isRead && (
                      <button type="button" onClick={() => markAsRead(msg._id)} className="text-sm text-primary hover:underline">
                        تعليم كمقروءة
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(msg._id)} className="text-sm text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">لا توجد رسائل</p>
        )}
    </div>
  );
}
