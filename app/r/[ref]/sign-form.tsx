"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 客人在他自己手机上按一下「收到了」。
 *
 * ── 🔴 为什么不是一块用手指画名字的板 ────────────────────────────────────
 *
 * 一条画在萤幕上的歪线，在争执的时候证明不了任何事 —— 没有人比得了
 * 两条线是不是同一个人画的。**一个有时间戳、而且是他自己从他自己那条
 * 连结按下去的动作，比一条线强得多**（20260905510000 的判断，照搬）。
 *
 * ── 「我们打的」跟「他自己签的」是两栏，不是一栏配一个勾 ─────────────────
 *
 * 老板在门口自己打的那个名字（`received_by`）是我们这一边的说法；
 * 这里按下去写的是 `signed_at` / `signed_name`。
 * **在争执的时候那两样不是同一个重量。**
 *
 * ⚠️ 一趟货一条自己的门牌 —— 所以这一颗签的是**这一趟**，不是整张单。
 * 一张单分两车出去，第二车要他再签一次，那本来就是对的。
 */

const WORDS = {
  en: {
    /* 🔴 **不可以也叫「Your name」。** 同一页上答覆那一段已经有一个了 ——
       两个一模一样的标签，读屏软件念出来是同一句，而拿键盘的人分不出
       自己在填哪一个。（我自己的尺也被这个骗过一次。） */
    name: "Who is signing",
    sign: "I received this",
    signing: "Sending...",
    incomplete: "Write your name first.",
    already: "This has already been signed.",
    not_found: "This link is not in use any more.",
    failed: "It did not go through. Try again.",
  },
  zh: {
    name: "签收人",
    sign: "我收到了",
    signing: "送出去中…",
    incomplete: "先写你的名字。",
    already: "这一趟已经签过了。",
    not_found: "这条连结不能用了。",
    failed: "没有送出去，再试一次。",
  },
} as const;

export function SignForm({
  refId,
  deliveryRef,
  lang,
}: {
  refId: string;
  deliveryRef: string;
  lang: "en" | "zh";
}) {
  const w = WORDS[lang];
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function sign() {
    if (busy) return;
    setProblem(null);
    setBusy(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc("sign_delivery", {
        in_ref: refId,
        in_delivery_ref: deliveryRef,
        in_name: name,
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
    <div className="mt-1 flex flex-wrap items-end gap-2">
      <label className="flex min-w-40 flex-1 flex-col gap-1">
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {w.name}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ds-control h-11 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => void sign()}
        className="inline-flex h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-50"
      >
        {busy ? w.signing : w.sign}
      </button>
      {problem ? (
        <p
          role="alert"
          className="w-full [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {problem}
        </p>
      ) : null}
    </div>
  );
}
