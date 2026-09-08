"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import type { RecordFormCopy } from "../record-copy";

/**
 * 一条发给这个经销商的连结，跟他送进来的那几笔。
 *
 * ── 为什么这一段存在 ──────────────────────────────────────────────────────
 *
 * 六支函式 20260905680000 就是真的了，而到 2026-09-05 为止
 * **画面上一个入口都没有**（grep 全 app = 0）。一条没有人发得出去的连结，
 * 跟一条不存在的连结是同一件事。
 *
 * ── 🔴 一个人一条门牌，不是那一行的 id ──────────────────────────────────
 *
 * `portal_ref` 是另一个号码，所以**收得回来**：关掉那条连结当场失效，
 * 而他送过的那几笔一笔不少。拿那一行的 id 当门牌就收不回来了。
 *
 * ── 「一按变单」走的是人按的那一支 ────────────────────────────────────────
 *
 * `record_from_request` 里面呼叫 `add_pipeline_record` —— 单号 · 第一个阶段 ·
 * 连到那个人 · 防重复 · 分店守卫，五样白捡（重点 23）。
 * 再按一次是同一张，不是第二张。
 */

export type PartyRequest = {
  id: string;
  what: string;
  qty: number | null;
  amountCents: number | null;
  contact: string;
  status: string;
  docNo: string | null;
  createdAt: string;
};

export function PartyPortalPanel({
  partyId,
  portalRef,
  origin,
  requests,
  /** 一按变单开在哪一页。null = 这个系统里没有能放单的那一页 —— 那时候
   *  **不画那颗按钮**，而不是画一颗按下去会失败的。 */
  landsIn,
  landsInLabel,
  copy,
}: {
  partyId: string;
  portalRef: string | null;
  origin: string;
  requests: readonly PartyRequest[];
  landsIn: string | null;
  landsInLabel: string | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = portalRef ? `${origin}/p/${portalRef}` : null;

  async function call(
    name: string,
    args: Record<string, unknown>,
    tag: string,
  ) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        name,
        args,
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
          {copy.portalHeading}
        </h2>
        {/* 🔴 一句说明只在**空的时候**画。
          参考那一页（EspoCRM 真的客户记录页，`.screenshots/pagerefs/crm/`）
          **一句说明都没有** —— 抬头加资料，就这样。而他 2026-09-09 讲
          「太长了吧 有点看看别人的如何做这个 UI 设计的」，量出来这一页
          手机 2698px、电脑 2485px，而说明那几句是最大的一块。

          分界线是：**一句说明教的是「这一格是干什么的」** ——
          他第一次遇到的时候需要它，而东西已经列在下面的时候，
          那几行自己就讲完了，说明每一次都要他滑过去。 */}
        {!link ? (
          <p className={`mt-1 ${dim}`}>{copy.portalLede}</p>
        ) : null}
      </div>

      {link ? (
        <div className="flex flex-col gap-2">
          {/* 唯读，因为改这一格什么都不会发生 —— 一个打得了字、
              而打了没有用的框，就是这个仓库禁的那种控件。 */}
          <input
            readOnly
            aria-label={copy.portalLink}
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
              {copy.portalCopy}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void call(
                  "close_party_portal",
                  { in_party_id: partyId },
                  "close",
                )
              }
              className={`min-h-10 underline ${dim}`}
            >
              {busy === "close" ? copy.saving : copy.portalClose}
            </button>
            {copied ? <span className={dim}>{copy.portalCopied}</span> : null}
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void call("open_party_portal", { in_party_id: partyId }, "open")
            }
            className={solid}
          >
            {busy === "open" ? copy.saving : copy.portalOpen}
          </button>
        </div>
      )}

      {/* 他送进来的那几笔。⚠️ 一条连结都还没开的时候这一段照样画 ——
          他关掉连结之后，送过的那几笔一笔不少，而那正是要看得到的事。 */}
      <div className="border-t pt-4 [border-color:var(--color-ink-800)]">
        <h3 className={`[font-weight:var(--fw-semibold)] ${dim}`}>
          {copy.portalInbox}
        </h3>
        {requests.length === 0 ? (
          <p className={`mt-2 ${dim}`}>{copy.portalInboxNone}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5">
                <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                  {r.what}
                </p>
                <p className={dim}>
                  {(r.createdAt ?? "").slice(0, 10)}
                  {r.qty != null ? ` · ${r.qty}` : ""}
                  {r.amountCents != null ? ` · ${ringgit(r.amountCents)}` : ""}
                  {r.contact ? ` · ${r.contact}` : ""}
                </p>
                {r.status === "done" ? (
                  <p className={dim}>
                    {copy.portalDone.replace("{doc}", r.docNo ?? "")}
                  </p>
                ) : r.status === "dropped" ? (
                  <p className={dim}>{copy.portalDropped}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {landsIn ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void call(
                            "record_from_request",
                            { in_request_id: r.id, in_module_key: landsIn },
                            r.id,
                          )
                        }
                        className={ghost}
                      >
                        {busy === r.id
                          ? copy.saving
                          : copy.portalTurn.replace(
                              "{page}",
                              landsInLabel ?? landsIn,
                            )}
                      </button>
                    ) : (
                      <span className={dim}>{copy.portalNowhere}</span>
                    )}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void call(
                          "drop_party_request",
                          { in_request_id: r.id },
                          `drop-${r.id}`,
                        )
                      }
                      className={`min-h-10 underline ${dim}`}
                    >
                      {copy.portalDrop}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
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
