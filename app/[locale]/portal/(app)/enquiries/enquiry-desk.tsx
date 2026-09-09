"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConvertEnquiry } from "./convert";
import { formatDayTime } from "@/lib/format-date";
import chrome from "../../chrome.module.css";

/**
 * 询价 —— 左边一条清单，右边读那一封，**底下一个回覆框**。
 *
 * ── 为什么换掉那一叠卡片（2026-09-10）────────────────────────────────────
 *
 * 老板问「他的画面你都全部拿完了吗」，数出来那个模版 24 页我们只拍过 15 页。
 * 补拍的五页里有一页是**信匣**（`.screenshots/admins/arham-mail.jpg`），
 * 而它正好是这一页缺的那个形状：
 *
 *   他们：**信匣栏 · 信件清单 · 右边读信，底下一个回覆框**
 *   我们：一叠卡片，一封一张，**而回不了**
 *
 * [任务 328](../../../../../docs/founder-tasks.md#328) 量过这一句：
 * **陌生人在他官网上问一句，他在系统里回不了** —— `site_enquiries` 只进不出。
 * 而 9-09 另一个 session 做完了 `reply_to_enquiry`（助手那一边），
 * 所以「写好words、他自己按送出」这条路已经在跑，**这一页是它缺的那一半**。
 *
 * ⚠️ **我们没有信匣栏**（他们那三栏的第一栏是 Inbox/Sent/Drafts）——
 * 我们只有一种东西，发明三个空的分类是在画一颗按不动的按钮。
 * 所以是两栏，不是三栏。
 *
 * ── 🔴 它不发送，而且这一句要写在画面上 ─────────────────────────────────
 *
 * 那颗按钮打开的是 WhatsApp，**字已经填好**，他读一遍自己按送出。
 * 助手那一边同一件事的回话就是这么写的（`replyDrafted`：
 * 「Written, NOT sent — open it, read it, and press send yourself」）。
 * 一个说「已送出」而其实没送的画面，是这个仓库禁得最严的那一类。
 */

type Row = {
  id: string;
  name: string;
  contact: string;
  answers: Record<string, string>;
  status: string;
  created_at: string;
  landsInLabel: string;
  converted: { recordId: string; moduleKey: string; docNo: string } | null;
};

/** 数字够不够多到像一支电话。太短的（门牌号、单号）不算。 */
function contactHref(contact: string): {
  href: string;
  kind: "wa" | "mail" | "none";
} {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())) {
    return { href: `mailto:${contact.trim()}`, kind: "mail" };
  }
  const digits = contact.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return { href: `https://wa.me/${digits}`, kind: "wa" };
  return { href: "", kind: "none" };
}

/** 清单上那一行要给一句话 —— 他自己打的第一句，不是问题的名字。 */
function firstLine(answers: Record<string, string>): string {
  for (const v of Object.values(answers ?? {})) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

export function EnquiryDesk({
  rows,
  locale,
  hasPipeline,
}: {
  rows: Row[];
  locale: string;
  hasPipeline: boolean;
}) {
  const t = useTranslations("portal");

  /* 只算一次 —— `mark-read` 开页面那一刻就把整批标成已读，
     而「哪几封是新的」要在这一次开着的画面上一直看得到。
     见旧档 enquiry-list.tsx 的档头，那一段的理由一个字都没变。 */
  const [wasNew] = useState(
    () => new Set(rows.filter((r) => r.status === "new").map((r) => r.id)),
  );
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  const open = rows.find((r) => r.id === openId) ?? null;
  const reach = open ? contactHref(open.contact) : { href: "", kind: "none" as const };
  const sendHref =
    reach.kind === "wa" && draft.trim()
      ? `${reach.href}?text=${encodeURIComponent(draft.trim())}`
      : reach.kind === "mail" && draft.trim()
        ? `${reach.href}?body=${encodeURIComponent(draft.trim())}`
        : reach.href;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* 左：一条清单。一行一封 —— 名字 · 他讲的第一句 · 几点进来的。 */}
      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]">
        {rows.map((r) => {
          const isNew = wasNew.has(r.id);
          const on = r.id === openId;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setOpenId(r.id);
                  setDraft("");
                }}
                aria-current={on}
                className="flex w-full flex-col gap-1 border-b p-4 text-left [border-color:var(--color-ink-800)]"
                style={{
                  /* 新的那几封在左缘立一条 jade —— 这个外壳里唯一一个
                     「这里是活的」的颜色。主色在这个外壳里解析成近白，
                     拿它当强调等於没有强调（旧版第一版就是这样）。 */
                  borderLeftWidth: "2px",
                  borderLeftColor: isNew
                    ? "var(--color-jade)"
                    : "transparent",
                  backgroundColor: on ? "var(--color-ink-850)" : undefined,
                }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                    {r.name}
                  </span>
                  <span className="shrink-0 [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
                    {formatDayTime(r.created_at, locale)}
                  </span>
                </span>
                <span className="truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                  {firstLine(r.answers)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 右：读那一封，底下回一句。 */}
      <div className="flex min-h-[24rem] flex-col rounded-[var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]">
        {!open ? (
          <p className="p-5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("enquiryPick")}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b p-5 [border-color:var(--color-ink-800)]">
              {wasNew.has(open.id) && (
                <span
                  className={chrome.annotation}
                  style={{ color: "var(--color-jade-bright)" }}
                >
                  {t("enquiryNew")}
                </span>
              )}
              <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {open.name}
              </span>
              <span className="ml-auto [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
                {formatDayTime(open.created_at, locale)}
              </span>
            </div>

            {/* 客人自己打的字。整张卡最值钱的就是这几行。 */}
            <div className="flex-1 p-5">
              {Object.entries(open.answers ?? {}).map(([k, v]) => (
                <div key={k} className="mb-4">
                  <div className={chrome.annotation}>{k}</div>
                  <p className="mt-1 [color:var(--color-paper)] [font-size:var(--text-base)]">
                    {String(v)}
                  </p>
                </div>
              ))}

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
                {hasPipeline ? (
                  <>
                    <span className={chrome.annotation}>
                      {open.landsInLabel}
                    </span>
                    <ConvertEnquiry
                      enquiryId={open.id}
                      locale={locale}
                      converted={open.converted}
                    />
                  </>
                ) : (
                  <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {t("enquiryNoPipeline")}
                  </span>
                )}
              </div>
            </div>

            {/* 🔴 回覆框 —— 这一页缺的那一半。见档头。 */}
            <div className="border-t p-5 [border-color:var(--color-ink-800)]">
              {reach.kind === "none" ? (
                <p className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                  {t("enquiryNoWay", { contact: open.contact })}
                </p>
              ) : (
                <>
                  <label className="flex flex-col gap-2">
                    <span className={chrome.annotation}>
                      {t("enquiryReply")}
                    </span>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-[var(--radius-md)] border p-3 [background-color:var(--color-ink-950)] [border-color:var(--input,var(--color-ink-700))] [color:var(--color-paper)] [font-size:var(--text-sm)]"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a
                      href={sendHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!draft.trim()}
                      className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border px-3 py-1.5 [border-color:var(--color-ink-700)] [color:var(--color-paper)] [font-size:var(--text-xs)] transition-colors hover:[background-color:var(--color-ink-850)] aria-disabled:opacity-50"
                      onClick={(e) => {
                        if (!draft.trim()) e.preventDefault();
                      }}
                    >
                      {reach.kind === "wa"
                        ? t("enquiryWhatsApp", { number: open.contact })
                        : open.contact}
                    </a>
                    {/* 🔴 它不发送，而这一句就写在按钮旁边。 */}
                    <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      {t("enquiryReplyNote")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
