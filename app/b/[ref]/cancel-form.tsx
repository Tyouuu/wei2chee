"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 她按下取消 —— 两下，不是一下。
 *
 * 手写簿上她打电话说「不来了」，柜台没有再跟她核对一次；这里多问一句
 * 纯粹是因为**这一下没有人在电话另一头帮她确认**，按错了要嘛跟她另开
 * 一张新的（柜台的事），要嘛她自己再订一次——两下比打错电话省事。
 *
 * ⚠️ `cancel_shared_appointment` 回一个词，不抛例外——跟 `answer_shared_record`
 * 同一个契约，一句资料库的错误讯息对她没有意义。
 */

const WORDS = {
  en: {
    cancel: "Cancel this booking",
    confirm: "Cancel it for good?",
    yes: "Yes, cancel it",
    no: "No, keep it",
    sending: "Cancelling...",
    done: "Cancelled. See you another time.",
    already: "This has already been settled.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    cancel: "取消这一笔",
    confirm: "真的要取消吗？",
    yes: "对，取消",
    no: "不，留着",
    sending: "取消中…",
    done: "取消了。下次再约。",
    already: "这一笔已经处理过了。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function CancelForm({ refId, lang }: { refId: string; lang: "en" | "zh" }) {
  const w = WORDS[lang];
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function confirmCancel() {
    if (busy) return;
    setProblem(null);
    setBusy(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc(
        "cancel_shared_appointment",
        { in_ref: refId },
      );
      if (error) {
        setProblem(w.failed);
        return;
      }
      const word = String(data ?? "");
      if (word === "ok") {
        router.refresh();
        return;
      }
      setProblem(word === "already_settled" ? w.already : w.failed);
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]"
      >
        {w.cancel}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">{w.confirm}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirmCancel()}
          className="inline-flex h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-50"
        >
          {busy ? w.sending : w.yes}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAsking(false)}
          className="inline-flex h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-50"
        >
          {w.no}
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
