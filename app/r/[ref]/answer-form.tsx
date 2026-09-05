"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 「同意」跟「我要改一点」。
 *
 * ── 🔴 过期了只挡「同意」，不挡「我要改一点」 ────────────────────────────
 *
 * 一个有效期存在的全部意义，就是过了那天它不再能被**接受** ——
 * 而想问一句的人不该没有地方讲。所以过期之后那颗同意变灰，
 * 底下那一颗照旧按得动。
 *
 * ── 「我要改一点」为什么值得做 ───────────────────────────────────────────
 *
 * 客人本来就会在 WhatsApp 上讲「可不可以便宜一点」——**那句话讲完就散了**。
 * 按在这里，它变成写在那张单上的一句话，而那正是以后不会吵起来的原因。
 *
 * ⚠️ 那支函式回的是一个**词**（`ok` / `bad_answer` / `incomplete` /
 * `expired` / `already` / `not_found`），不是一句资料库的话 ——
 * 一个把「violates check constraint」印给屋主看的画面，等於没有讲。
 */

const WORDS = {
  en: {
    heading: "Your answer",
    name: "Your name",
    note: "Anything you want to say (optional)",
    accept: "I accept this",
    changes: "I want a change",
    sending: "Sending...",
    sent: "Sent. They can see it now.",
    incomplete: "Write your name first.",
    bad_answer: "Pick one of the two.",
    expired: "This has expired, so it cannot be accepted. You can still ask for a change.",
    already: "You have already accepted this.",
    not_found: "This link is not in use any more.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    heading: "你的答覆",
    name: "你的名字",
    note: "想讲的话（可以不填）",
    accept: "我同意",
    changes: "我要改一点",
    sending: "送出去中…",
    sent: "送出去了，他那边看得到。",
    incomplete: "先写你的名字。",
    bad_answer: "两个里挑一个。",
    expired: "这一张过期了，同意不了。想改的地方还是讲得出来。",
    already: "你已经同意过了。",
    not_found: "这条连结不能用了。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function AnswerForm({
  refId,
  lang,
  expired,
  answered,
}: {
  refId: string;
  lang: "en" | "zh";
  expired: boolean;
  answered: string | null;
}) {
  const w = WORDS[lang];
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function send(answer: "accepted" | "changes") {
    if (busy) return;
    setProblem(null);
    setOk(false);
    setBusy(answer);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc("answer_shared_record", {
        in_ref: refId,
        in_answer: answer,
        in_name: name,
        in_note: note,
      });
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
      setBusy(null);
    }
  }

  const box =
    "ds-control h-11 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] outline-none";
  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">{w.heading}</h2>

      <label className="flex flex-col gap-1.5">
        <span className={dim}>{w.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={box} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={dim}>{w.note}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="ds-control w-full p-3 [font-size:var(--text-sm)] outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {/* 🔴 过期了、或者已经同意过了，那一颗就不该按得动 ——
            一颗按下去一定被拒绝的按钮，是这个仓库禁的那一种。 */}
        <button
          type="button"
          disabled={busy !== null || expired || answered === "accepted" || !name.trim()}
          onClick={() => void send("accepted")}
          className="inline-flex h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-50"
        >
          {busy === "accepted" ? w.sending : w.accept}
        </button>
        <button
          type="button"
          disabled={busy !== null || !name.trim()}
          onClick={() => void send("changes")}
          className="inline-flex h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-50"
        >
          {busy === "changes" ? w.sending : w.changes}
        </button>
      </div>

      {expired ? <p className={dim}>{w.expired}</p> : null}
      {ok ? <p className={dim}>{w.sent}</p> : null}
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
