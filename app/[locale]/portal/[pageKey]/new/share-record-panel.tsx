"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 一条发给客人的连结，跟他答了什么。
 *
 * ── 为什么它值得一整段 ────────────────────────────────────────────────────
 *
 * 那四支函式 20260905230000 就做好了，而画面上一个入口都没有 ——
 * **一条没有人发得出去的连结，跟一条不存在的连结是同一件事。**
 *
 * 而这一件同时是[任务 155] 那两句：「客人线上按同意」跟
 * 「客人自己看得到这一单」底下是同一页，做一次两件一起有。
 *
 * ── 🔴 门牌是另一个号码 ──────────────────────────────────────────────────
 *
 * `share_ref` 不是那一行的 id，所以**收得回来**：按「收回」当场失效，
 * 而他答过的那句话留着。拿 id 当门牌就收不回来了。
 *
 * ⚠️ **再按一次是同一条网址** —— 不然他昨天发出去那一条会静静死掉。
 *
 * ── 他答了什么，画在老板这一边 ────────────────────────────────────────────
 *
 * 「同意」是一个承诺，而承诺要看得到日期跟名字；「我要改一点」带着他
 * 讲的那句话 —— 那句话本来会在 WhatsApp 上讲完就散了。
 * ⚠️ **`stage` 一动都不动**：同意是事实，搬他的流程是他的判断。
 */

export function ShareRecordPanel({
  recordId,
  shareRef,
  origin,
  answer,
  answeredName,
  answeredAt,
  answerNote,
  copy,
}: {
  recordId: string;
  /** 门牌。null = 还没开过。 */
  shareRef: string | null;
  origin: string;
  /** 'accepted' | 'changes' | null */
  answer: string | null;
  answeredName: string | null;
  answeredAt: string | null;
  answerNote: string | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = shareRef ? `${origin}/r/${shareRef}` : null;

  async function call(name: string, tag: string) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(name, {
        in_record_id: recordId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.shareHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.shareLede}</p>
      </div>

      {link ? (
        <div className="flex flex-col gap-2">
          <input
            readOnly
            aria-label={copy.shareLink}
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 4000);
                  },
                  () => setCopied(false),
                );
              }}
              className={ghost}
            >
              {copy.shareCopy}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void call("unshare_record", "off")}
              className={`min-h-10 underline ${dim}`}
            >
              {busy === "off" ? copy.saving : copy.shareStop}
            </button>
            {copied ? <span className={dim}>{copy.shareCopied}</span> : null}
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void call("share_record", "on")}
            className={solid}
          >
            {busy === "on" ? copy.saving : copy.shareOpen}
          </button>
        </div>
      )}

      {/* 他答了什么。⚠️ 连结收回去之后这一段照样画 ——
          他答过的那句话是历史，不是那条连结的附属品。 */}
      <div className="border-t pt-4 [border-color:var(--color-ink-800)]">
        {answer ? (
          <>
            <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
              {(answer === "accepted" ? copy.shareAccepted : copy.shareChanges)
                .replace("{name}", answeredName ?? "")
                .replace("{date}", (answeredAt ?? "").slice(0, 10))}
            </p>
            {answerNote ? <p className={`mt-1 ${dim}`}>{answerNote}</p> : null}
            {/* 🔴 他同意了，而那一单走到哪还是他自己决定 ——
                替他把单子从「等回覆」搬走，是替他做了一个他没有做的决定。 */}
            {answer === "accepted" ? <p className={`mt-1 ${dim}`}>{copy.shareStageHint}</p> : null}
          </>
        ) : (
          <p className={dim}>{copy.shareNoAnswer}</p>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
