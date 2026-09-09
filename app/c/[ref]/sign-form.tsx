"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 她在自己手机上按下去。
 *
 * ── 🔴 为什么不是一块用手指画名字的板 ────────────────────────────────────
 *
 * [任务 164] 判过一次，这里照搬：一条画在萤幕上的歪线，在争执的时候
 * 证明不了任何事 —— 没有人比得了两条线是不是同一个人画的。
 * **一个有时间戳、而且是她自己从她自己那条连结按下去的动作，强得多。**
 *
 * ── 那一支回的是一个词，不是一句资料库的话 ────────────────────────────────
 *
 * `ok` / `incomplete` / `too_long` / `not_found` / `signed`。
 * 所以这里每一个词都要有她读得懂的句子 —— 一个把
 * 「violates check constraint」印给客人看的画面，等於没有讲。
 */

const WORDS = {
  en: {
    name: "Your name",
    note: "Anything you want to add (optional)",
    sign: "I agree",
    signing: "Sending...",
    /* 🔴 讲**要什么**，不讲**哪里错了**（Baymard），而且它贴着那一格。 */
    incomplete: "Write your name first.",
    too_long: "That is too long — keep it short.",
    not_found: "This link is not in use any more.",
    signed: "This one is already signed.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    name: "你的名字",
    note: "想补一句的话（可以不填）",
    sign: "我同意",
    signing: "送出去中…",
    incomplete: "先写你的名字。",
    too_long: "太长了 —— 写短一点。",
    not_found: "这条连结不能用了。",
    signed: "这一份已经签过了。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function SignForm({ refId, lang }: { refId: string; lang: "en" | "zh" }) {
  const w = WORDS[lang];
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /* 那一格空着的时候按下去，把话讲在那一格底下并且把光标送回去。 */
  const [need, setNeed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function sign() {
    if (busy) return;
    /* 🔴 不把按钮变灰。一颗按不动又不说为什么的按钮，比一句话糟 ——
       按下去才是她学会要填哪一格的那一刻（[任务 281] 学到的同一条）。 */
    if (!name.trim()) {
      setNeed(true);
      nameRef.current?.focus();
      return;
    }
    setNeed(false);
    setProblem(null);
    setBusy(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc("sign_consent", {
        in_ref: refId,
        in_name: name,
        in_note: note,
      });
      if (error) {
        setProblem(w.failed);
        return;
      }
      const word = String(data ?? "");
      if (word === "ok") {
        router.refresh();
        return;
      }
      setProblem((w as Record<string, string>)[word] ?? w.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {w.name}
        </span>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (need) setNeed(false);
          }}
          aria-invalid={need || undefined}
          className="ds-control h-11 w-full min-w-0 [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)] outline-none"
        />
        {need ? (
          <span
            role="alert"
            className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {w.incomplete}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {w.note}
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="ds-control w-full [font-size:var(--text-sm)] [padding:0.75rem] outline-none"
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => void sign()}
        className="inline-flex h-11 items-center justify-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-inline:calc(var(--pad-control-x)*1.4)] disabled:opacity-50"
      >
        {busy ? w.signing : w.sign}
      </button>

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
