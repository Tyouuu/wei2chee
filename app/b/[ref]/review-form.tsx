"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 她留一句评价 —— 一个 1–5 的数字，一句话（可以不写）。
 *
 * ⚠️ `submit_appointment_review` 回一个词，不抛例外——跟 `cancel_shared_appointment`
 * 同一个契约。星等是**按钮**不是 `<select>`（她在手机上，点比挑更快，
 * [重点 29] 数的是打几个字，这里连挑都不用挑）。
 */

const WORDS = {
  en: {
    heading: "How was it?",
    note: "Anything you want to say (optional)",
    send: "Send",
    sending: "Sending...",
    sent: "Thanks — they can see it now.",
    pick: "Pick a rating first.",
    not_yet: "This visit is not done yet.",
    already_submitted: "You have already left a review for this visit.",
    invalid: "Pick a rating first.",
    too_long: "That's a bit long — try a shorter note.",
    not_found: "This link is not in use any more.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    heading: "这一次做得怎么样？",
    note: "想讲的话（可以不填）",
    send: "送出",
    sending: "送出去中…",
    sent: "谢谢——他那边看得到了。",
    pick: "先选几颗星。",
    not_yet: "这一次还没做完。",
    already_submitted: "这一次你已经留过评价了。",
    invalid: "先选几颗星。",
    too_long: "有点长，写短一点再试。",
    not_found: "这条连结不能用了。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function ReviewForm({ refId, lang }: { refId: string; lang: "en" | "zh" }) {
  const w = WORDS[lang];
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function send() {
    if (busy) return;
    if (rating < 1) {
      setProblem(w.pick);
      return;
    }
    setProblem(null);
    setBusy(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc(
        "submit_appointment_review",
        { in_ref: refId, in_rating: rating, in_text: text },
      );
      if (error) {
        setProblem(w.failed);
        return;
      }
      const word = String(data ?? "");
      if (word === "ok") {
        setOk(true);
        router.refresh();
        return;
      }
      setProblem((w as Record<string, string>)[word] ?? w.failed);
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">{w.sent}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">{w.heading}</h2>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}`}
            onClick={() => setRating(n)}
            className="grid h-11 w-11 place-items-center [font-size:var(--text-lg,1.25rem)]"
          >
            <span
              className={
                n <= rating
                  ? "text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-on-canvas-dim)]"
              }
            >
              ★
            </span>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {w.note}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          className="ds-control w-full p-3 [font-size:var(--text-sm)] outline-none"
        />
      </label>

      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="inline-flex h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-50"
        >
          {busy ? w.sending : w.send}
        </button>
      </div>

      {problem ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {problem}
        </p>
      ) : null}
    </div>
  );
}
