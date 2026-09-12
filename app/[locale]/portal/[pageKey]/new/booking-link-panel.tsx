"use client";

import { useState } from "react";
import type { RecordFormCopy } from "../record-copy";

/**
 * 她自己那条连结——取消 · 留评价。
 *
 * ── 为什么它比 `ShareRecordPanel` 简单一截（[任务 399] 收尾那一件）──────────
 *
 * `share_ref`（单据）要开、要收回，因为一份报价单**默认不给陌生人看**。
 * `appointments.public_ref` 不是这样——它从 `add_appointment` 那一刻就有，
 * 是这一笔预约天生带着的门牌，不是一个要老板决定要不要开的开关。
 * 所以这里没有 `shareOpen` / `shareStop` 那一对，只有复制。
 *
 * ⚠️ 跟 `ShareRecordPanel` 同一条：门牌是另一个号码，不是这一行的 id——
 * 复制出去的连结打开的是 `/b/<public_ref>`，不是这一笔的 uuid。
 */
export function BookingLinkPanel({
  origin,
  publicRef,
  copy,
}: {
  origin: string;
  publicRef: string;
  copy: RecordFormCopy;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${origin}/b/${publicRef}`;

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.bookingLinkHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.bookingLinkLede}</p>
      </div>

      <div className="flex flex-col gap-2">
        <input
          readOnly
          aria-label={copy.bookingLinkLink}
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
            {copy.bookingLinkCopy}
          </button>
          {copied ? <span className={dim}>{copy.bookingLinkCopied}</span> : null}
        </div>
      </div>
    </div>
  );
}
