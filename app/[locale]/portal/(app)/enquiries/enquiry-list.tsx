"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConvertEnquiry } from "./convert";
import { formatDayTime } from "@/lib/format-date";
import chrome from "../../chrome.module.css";

/**
 * 询价的清单 —— 而 `status` 这一栏第一次被画出来。
 *
 * ── 🔴 为什么要一个 client 组件才画得出「新的」──────────────────────────────
 * `site_enquiries.status` 有 'new' / 'read'，`mark-read.tsx` 在**开页面那一刻**
 * 就把整批标成已读，然后 `router.refresh()`。所以：
 *
 *     第一次服务端渲染   status = 'new'   ← 唯一一次它是真的
 *     mark-read 之后     status = 'read'  ← 画面上看到的永远是这个
 *
 * **而中间那一步从来没有把它画出来。** 於是这一栏被写进去、被读出来、
 * 被覆盖掉，一个字都没有给老板看过 —— 这个仓库第十七次「能力有、线没接」，
 * 而且落在他每天最想知道的那一件事上：**这封是我看过的，还是刚进来的。**
 *
 * 修法是把那一刻的名单**接住**：`useState` 的初始值只算一次，
 * `router.refresh()` 重画的是服务端那棵树，client 组件的 state 留着。
 * 所以标已读照跑（侧栏的徽章要它），而「哪几封是新的」在这一次开着的画面上
 * 一直看得到 —— 下一次进来才归零，那正好是「新」这个字的意思。
 *
 * ⚠️ 不要把它改成读 `status` 就好：那样写出来会**永远显示零封新的**，
 * 而且看起来完全正常。
 *
 * ── 联络方式不一定是电话 ────────────────────────────────────────────────────
 * 旧版无论收到什么都组 `wa.me/${contact.replace(/[^0-9]/g,"")}` ——
 * 一个 email 会变成 `wa.me/` 加上里面刚好有的几个数字，按下去开一个不存在的人。
 * 现在先判是不是 email，是就 `mailto:`。
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
function contactHref(contact: string): { href: string; kind: "wa" | "mail" | "none" } {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())) {
    return { href: `mailto:${contact.trim()}`, kind: "mail" };
  }
  const digits = contact.replace(/[^0-9]/g, "");
  if (digits.length >= 8) return { href: `https://wa.me/${digits}`, kind: "wa" };
  return { href: "", kind: "none" };
}

export function EnquiryList({
  rows,
  locale,
  hasPipeline,
}: {
  rows: Row[];
  locale: string;
  hasPipeline: boolean;
}) {
  const t = useTranslations("portal");

  /* 只算一次 —— 见档头。之后 mark-read 把 status 改掉了也不影响这一份。 */
  const [wasNew] = useState(
    () => new Set(rows.filter((r) => r.status === "new").map((r) => r.id)),
  );

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const isNew = wasNew.has(r.id);
        const { href, kind } = contactHref(r.contact);
        return (
          <li
            key={r.id}
            className="rounded-[var(--radius-lg)] border p-5 [background-color:var(--color-ink-900)]"
            style={{
              /* 新的那几封在左缘立一条主色 —— 一整排卡片里，眼睛先扫到的是
                 那一条竖线，不是任何一个字。旧的用同一条但是灰的，
                 这样两种卡片的内容起点是同一个 x。

                 ⚠️ 用的是 jade —— 这个外壳里唯一一个「这里是活的」的颜色
                 （侧栏那颗官网上线的绿点就是它）。主色在这个外壳里解析成近白，
                 拿它当强调等於没有强调（第一版就是这样，拍出来那条竖线是白的）。 */
              borderColor: "var(--color-ink-800)",
              borderLeftWidth: "2px",
              borderLeftColor: isNew ? "var(--color-jade)" : "var(--color-ink-800)",
            }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {isNew && (
                <span className={chrome.annotation} style={{ color: "var(--color-jade-bright)" }}>
                  {t("enquiryNew")}
                </span>
              )}
              <span className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [color:var(--color-paper)]">
                {r.name}
              </span>
              {/* ⚠️ 服务端跑 UTC，旧版用 `toLocaleString()` —— 一封下午 3:41 进来的
                  询价印出来是 7:41am。`formatDayTime` 钉死在马来西亚时区，
                  `lib/format-date.ts` 的档头就是为这件事写的，而这一页没有用它。 */}
              <span className="ml-auto [font-family:var(--font-numeric)] [font-size:var(--text-xs)] [color:var(--color-paper-dim)] tabular-nums">
                {formatDayTime(r.created_at, locale)}
              </span>
            </div>

            {/* 客人自己打的字。整张卡最值钱的就是这几行，所以它是最大的一段，
                而问题降成一行眉标 —— 旧版是「问题：答案」同一个字级用冒号接起来，
                读起来像一行倒出来的资料，不像一个人在讲话。 */}
            {Object.entries(r.answers ?? {}).map(([k, v]) => (
              <div key={k} className="mt-4">
                <div className={chrome.annotation}>{k}</div>
                <p className="mt-1 [font-size:var(--text-base)] [color:var(--color-paper)]">
                  {String(v)}
                </p>
              </div>
            ))}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3 border-t pt-4 [border-color:var(--color-ink-800)]">
              {kind !== "none" && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  /* 回一句话是他收到询价之后真的会做的第一件事 —— [任务 26](../../../../../docs/founder-tasks.md)
                     实测 19 家马来西亚 SME，15 家第一屏就给 WhatsApp。
                     旧版把它渲染成一行加底线的小字，跟日期一样重。 */
                  className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 [border-color:var(--color-ink-700)] [color:var(--color-paper)] [font-size:var(--text-xs)] transition-colors hover:[background-color:var(--color-ink-850)]"
                >
                  <span aria-hidden className="[color:var(--color-jade)]">
                    {kind === "wa" ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.6 11.6 0 0 1-4.8-4.3c-.4-.6-1-1.5-1-2.9 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.5-.3.3c-.1.2-.2.3 0 .6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.2.1.4 0 .5-.1l.8-1c.2-.2.3-.2.6-.1l2 1c.3.1.4.2.5.3v1.2Z" />
                      </svg>
                    ) : "✉"}
                  </span>
                  <span className="tabular-nums">
                    {kind === "wa" ? t("enquiryWhatsApp", { number: r.contact }) : r.contact}
                  </span>
                </a>
              )}
              <span className="ml-auto flex flex-wrap items-center gap-3">
                {/* ⚠️ 这一格从「Opens a job on: Quotations」改成「→ 报价单」。
                    它不能删 —— 按钮写死是「Open a quotation」，而一家系统里
                    只有订单没有报价单的生意，单是开在订单上的，那一行是唯一
                    讲得出落点的字。但整句话跟按钮讲的是同一件事，
                    两个东西讲同一句话正是[印那一套被砍掉]的理由，
                    所以留资讯、去掉句子。 */}
                {hasPipeline ? (
                  <>
                    <span className={chrome.annotation}>{r.landsInLabel}</span>
                  <ConvertEnquiry
                    enquiryId={r.id}
                    locale={locale}
                    converted={r.converted}
                  />
                  </>
                ) : (
                  <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
                    {t("enquiryNoPipeline")}
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
