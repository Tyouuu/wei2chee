"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 他自己讲一句话，送进老板的收件匣。
 *
 * ⚠️ **数量跟金额都可以不填。** 抄他自己 0042 的形状：
 * 送进来的是一个**说法**，不是一张单 —— 一个逼他填数量的表格，
 * 会把「下一批帮我留一点」变成他填不出来的东西。
 *
 * 🔴 那支函式回的是一个**词**（`ok` / `incomplete` / `too_long` /
 * `not_found` / `too_many` / `too_many_open`），不是一句资料库的话。
 * 所以这里每一个词都要有他读得懂的句子 —— 一个把
 * 「violates check constraint」印给经销商看的画面，等於没有讲。
 */

const WORDS = {
  en: {
    what: "What do you need?",
    qty: "How many (optional)",
    amount: "Amount (optional)",
    contact: "Your phone (optional)",
    send: "Send",
    sending: "Sending...",
    sent: "Sent. They can see it now.",
    incomplete: "Write what you need first.",
    too_long: "That is too long -- keep it short.",
    not_found: "This link is not in use any more.",
    too_many: "You have sent a few just now. Try again in a minute.",
    too_many_open: "You already have five with them. Wait for those first.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    what: "你要什么？",
    qty: "几个（可以不填）",
    amount: "多少钱（可以不填）",
    contact: "你的电话（可以不填）",
    send: "送出去",
    sending: "送出去中…",
    sent: "送出去了，他那边看得到。",
    incomplete: "先写你要什么。",
    too_long: "太长了 —— 写短一点。",
    not_found: "这条连结不能用了。",
    too_many: "你刚刚送了几笔，等一分钟再送。",
    too_many_open: "你在他那里已经有五笔在等，先等那几笔。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function RequestForm({ refId, lang }: { refId: string; lang: "en" | "zh" }) {
  const w = WORDS[lang];
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [qty, setQty] = useState("");
  const [amount, setAmount] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function send() {
    if (busy) return;
    setNote(null);
    setOk(false);
    setBusy(true);
    try {
      const num = (s: string) => {
        const n = Number(s.replace(/[^\d.]/g, ""));
        return s.trim() && Number.isFinite(n) ? n : null;
      };
      const cents = num(amount);
      const { data, error } = await createBrowserSupabaseClient().rpc("submit_party_request", {
        in_ref: refId,
        in_what: what,
        in_qty: num(qty),
        in_amount_cents: cents == null ? null : Math.round(cents * 100),
        in_contact: contact,
        /* 按两下只留一笔 —— 手机上双击是常态，不是错。 */
        in_idempotency_key: crypto.randomUUID(),
      });
      if (error) {
        setNote(w.failed);
        return;
      }
      const word = String(data ?? "");
      if (word === "ok") {
        setOk(true);
        setWhat("");
        setQty("");
        setAmount("");
        router.refresh();
        return;
      }
      setNote((w as Record<string, string>)[word] ?? w.failed);
    } finally {
      setBusy(false);
    }
  }

  const box =
    "h-11 w-full rounded-md border border-neutral-300 px-3 text-sm text-neutral-900 outline-none focus-visible:border-neutral-900";

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-600">{w.what}</span>
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 p-3 text-sm text-neutral-900 outline-none focus-visible:border-neutral-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600">{w.qty}</span>
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={box} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-600">{w.amount}</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={box} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-600">{w.contact}</span>
        <input
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className={box}
        />
      </label>

      <button
        type="button"
        disabled={busy || !what.trim()}
        onClick={() => void send()}
        className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? w.sending : w.send}
      </button>

      {ok ? <p className="text-sm text-neutral-600">{w.sent}</p> : null}
      {note ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {note}
        </p>
      ) : null}
    </div>
  );
}
