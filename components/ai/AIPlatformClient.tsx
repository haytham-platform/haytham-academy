"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Database, RefreshCw, Send, ShieldCheck } from "lucide-react";

type Scope = "admin" | "teacher" | "parent" | "student";
type Message = { role: "user" | "assistant"; content: string };
type Row = Record<string, unknown>;

const scopeMeta: Record<Scope, { title: string; description: string; examples: string[] }> = {
  admin: {
    title: "منصة الذكاء الاصطناعي للإدارة",
    description: "مساعد إداري آمن يستعمل ملخصات مصرح بها من التقارير والمالية والحضور.",
    examples: ["اعرض الغياب اليوم", "ما أهم مؤشرات المالية اليوم؟", "اعطني ملخصا عن الطلاب غير المدفوعين"],
  },
  teacher: {
    title: "مساعد الأستاذ الذكي",
    description: "يساعدك في التحضير، تحليل أداء طلابك، وصياغة ملاحظات تربوية ضمن نطاقك فقط.",
    examples: ["اقترح خطة درس للأسبوع", "حلل أداء طلابي", "اكتب تمارين مراجعة قصيرة"],
  },
  parent: {
    title: "مساعد ولي الأمر الذكي",
    description: "يفسر بيانات الأبناء المرتبطين بحسابك ويقترح خطط متابعة منزلية.",
    examples: ["لخص حضور أبنائي", "اشرح الرصيد المتبقي", "اقترح خطة مراجعة منزلية"],
  },
  student: {
    title: "مساعد الطالب الذكي",
    description: "يساعدك في المراجعة وتنظيم الدراسة وفهم نقاط القوة والتحسين.",
    examples: ["اصنع لي خطة مراجعة", "اشرح نقاط ضعفي من العلامات", "ولد لي أسئلة تدريبية"],
  },
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function renderRows(rows: unknown) {
  const list = Array.isArray(rows) ? rows.slice(0, 20) as Row[] : [];
  if (!list.length) return <p className="text-sm text-muted">لا توجد نتائج.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <tbody>
          {list.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              <td className="w-16 p-3 font-bold text-muted">{index + 1}</td>
              <td className="p-3"><pre className="whitespace-pre-wrap font-sans text-xs">{JSON.stringify(row, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AIPlatformClient({ scope }: { scope: Scope }) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Row>({});
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<Row | null>(null);
  const meta = scopeMeta[scope];
  const canDataQuery = scope === "admin";
  const disabled = loading || !message.trim();

  const providerReady = useMemo(() => Boolean(status.providerConfigured), [status]);

  useEffect(() => {
    fetch("/api/ai/status").then((res) => res.json()).then(setStatus).catch(() => setStatus({}));
  }, []);

  async function send() {
    setLoading(true);
    setError("");
    const outgoing = message.trim();
    setMessages((rows) => [...rows, { role: "user", content: outgoing }]);
    setMessage("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, message: outgoing, conversationId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر الحصول على إجابة");
      setConversationId(payload.conversationId || conversationId);
      setMessages((rows) => [...rows, { role: "assistant", content: payload.answer }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  async function runQuery() {
    setLoading(true);
    setError("");
    setQueryResult(null);
    try {
      const response = await fetch("/api/ai/data-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ الاستعلام");
      setQueryResult(payload);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{meta.title}</h1>
            <p className="text-sm text-muted">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {providerReady ? `المزود مهيأ: ${text(status.provider)}` : "المزود غير مهيأ"}
        </div>
      </header>

      {!providerReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          لم يتم ضبط مزود الذكاء الاصطناعي. لن يتم توليد إجابات وهمية. اضبط متغيرات البيئة AI_PROVIDER و AI_API_KEY و AI_API_BASE_URL و AI_MODEL.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          {meta.examples.map((example) => (
            <button key={example} type="button" onClick={() => setMessage(example)} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-foreground hover:bg-pink-50 hover:text-primary">
              {example}
            </button>
          ))}
        </div>
        <div className="min-h-[280px] space-y-3 rounded-xl bg-gray-50 p-3">
          {messages.length === 0 && <p className="text-center text-sm text-muted">ابدأ بسؤال مصرح به ضمن نطاق حسابك.</p>}
          {messages.map((item, index) => (
            <div key={index} className={`max-w-[85%] rounded-2xl p-3 text-sm ${item.role === "user" ? "mr-auto bg-primary text-white" : "ml-auto bg-white text-foreground shadow-sm"}`}>
              {item.content}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="input-field min-h-20 flex-1 resize-none" placeholder="اكتب سؤالك هنا..." />
          <button type="button" disabled={disabled} onClick={send} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
          </button>
        </div>
      </section>

      {canDataQuery && (
        <section className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="font-bold">استعلام ذكي عن البيانات المصرح بها</h2>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-field flex-1" placeholder="مثال: اعرض الغياب اليوم أو الدفعات هذا الأسبوع" />
            <button type="button" onClick={runQuery} disabled={loading || !query.trim()} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">تنفيذ</button>
          </div>
          {queryResult && (
            <div className="space-y-3">
              <p className="text-sm text-muted">النية: {text(queryResult.intent)}</p>
              {renderRows(queryResult.rows)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
