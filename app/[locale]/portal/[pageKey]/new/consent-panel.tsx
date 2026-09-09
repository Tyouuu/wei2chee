"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「她签了没有。」
 *
 * ── 为什么它在客户那一页 ──────────────────────────────────────────────────
 *
 * 因为那是她会去问这一句的地方。客人坐下来，前台打开她的名字 ——
 * 「你上次签的那一份还在，今天这个疗程要另外签一份。」
 * 一份全店的同意书清单回答不了这一句，它回答的是另一个问题
 * （这个月签了几份）。跟套票那一段同一条。
 *
 * ── 🔴 那条连结收得回来，而签过的收不回来 ─────────────────────────────────
 *
 * `share_ref` 不是那一行的 id（20260909130000）——
 * 所以「收回」当场失效，而再发一次是**另一条**。
 * ⚠️ 而**签过的那一份收不回来**：那不是一个设定，那是发生过的事，
 * 而她本来就该回得去看自己签了什么。
 *
 * ── 一份都还没写的时候 ────────────────────────────────────────────────────
 *
 * 这一段不画一个选不了东西的下拉，它画一条**去写第一份**的连结 ——
 * 那正是她想到这件事的那一刻。一颗按下去必然失败的按钮是这个仓库禁的第一条。
 */

export type ConsentSheet = {
  id: string;
  formName: string;
  shareRef: string | null;
  sentAt: string;
  signedAt: string | null;
  signedName: string | null;
  signedNote: string | null;
};

export type ConsentForm = { id: string; name: string };

export function ConsentPanel({
  partyId,
  origin,
  consentHref,
  sheets,
  forms,
  copy,
}: {
  partyId: string;
  origin: string;
  /** 去写范本那一页 —— 一份都还没有的时候唯一有用的那颗按钮。 */
  consentHref: string;
  sheets: readonly ConsentSheet[];
  forms: readonly ConsentForm[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState(forms[0]?.id ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  async function send() {
    if (!pick) return;
    setError(null);
    setBusy("send");
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "request_consent",
        { in_party_id: partyId, in_form_id: pick },
      );
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function takeBack(id: string) {
    setError(null);
    setBusy(id);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "revoke_consent_request",
        { in_id: id },
      );
      if (err) setError(err.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.consentHeading}
        </h2>
        <p className={"mt-1 " + dim}>{copy.consentLede}</p>
      </div>

      {sheets.length === 0 ? (
        <p className={dim}>{copy.consentNone}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sheets.map((s) => {
            const link = s.shareRef ? `${origin}/c/${s.shareRef}` : null;
            return (
              <li key={s.id} className="flex flex-col gap-2">
                <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
                  {s.formName}
                </p>
                {s.signedAt ? (
                  <>
                    <p className={dim}>
                      {copy.consentSigned.replace("{d}", s.signedAt.slice(0, 10))}
                      {s.signedName ? ` · ${s.signedName}` : ""}
                    </p>
                    {s.signedNote ? (
                      <p className={"whitespace-pre-line " + dim}>{s.signedNote}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className={dim}>
                      {copy.consentWaiting.replace("{d}", s.sentAt.slice(0, 10))}
                    </p>
                    {/* 🔴 收回去过的那一份，连结是空的 —— 那时候不画一个
                        空的框，画一句话：她今天打不开它了。 */}
                    {link ? (
                      <>
                        <input
                          readOnly
                          aria-label={copy.consentShareLink}
                          value={link}
                          onFocus={(e) => e.currentTarget.select()}
                          className="ds-control h-10 w-full min-w-0 [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)] text-[color:var(--color-paper)] outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(link).then(
                                () => {
                                  setCopied(s.id);
                                  window.setTimeout(() => setCopied(null), 4000);
                                },
                                () => setCopied(null),
                              );
                            }}
                            className={ghost}
                          >
                            {copy.consentCopy}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void takeBack(s.id)}
                            className={"min-h-10 underline " + dim}
                          >
                            {busy === s.id ? copy.saving : copy.consentTakeBack}
                          </button>
                          {copied === s.id ? (
                            <span className={dim}>{copy.consentCopied}</span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className={dim}>{copy.consentTakenBack}</p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 发一份给她。🔴 一份范本都还没写的时候，画的是去写第一份那条连结 ——
          一个选不了东西的下拉加一颗必然失败的按钮，比没有更糟。 */}
      {forms.length === 0 ? (
        <p className={dim}>
          {copy.consentNoForms}{" "}
          <a href={consentHref} className="underline">
            {copy.consentWrite}
          </a>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={copy.consentPick}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="ds-control h-10 min-w-0 flex-1 [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)] text-[color:var(--color-paper)] outline-none"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy !== null || !pick}
            onClick={() => void send()}
            className={solid}
          >
            {busy === "send" ? copy.saving : copy.consentSend}
          </button>
        </div>
      )}

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
