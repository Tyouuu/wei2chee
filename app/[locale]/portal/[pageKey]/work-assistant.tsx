"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import type { Skip } from "@/lib/portal/skip-codes";
import { sayWhyNot } from "./ai-assistant";

/**
 * 用讲的做事 —— 在**他的系统**那一页上，不是在改设计那一屏上。
 *
 * ── 他 2026-09-09 问的那一句 ──────────────────────────────────────────────
 *
 *     `這個ai 助手是我們產品的還是平台的 如果是產品為什麼不是接在產品裡面呢`
 *
 * 他分得对。那一支 route 从写出来那天就同时做两件事：
 *
 *   · **改设计** 10 个动作 —— 平台那一半，他**一辈子走一次**
 *   · **做事**   11 个动作 —— 产品那一半，他**一年开三百天**
 *     （开单 · 记一笔钱 · 建客户 · 建货品 · 动库存 · 改一笔的状态 ·
 *      记一天工 · 盘点 · 收货 · 发／收回一条给客人的连结 · 下一步 · 冲正）
 *
 * 而那块面板**只被编辑器那两个外壳 import**（`editor-client.tsx` ·
 * `mobile-editor.tsx`）。所以那 11 个动作从来只在改设计那一屏上够得到 ——
 * [任务 268] 量过这一句：投在「会做事」那一半的每一分工，回报是另一半的三百倍。
 *
 * 🔴 而 `front-door.ts`（2026-09-07）之后每一次登入都直接进他的系统，
 * 编辑器连同助手退到「改设计」那一颗按钮后面。**那次改动本身是对的**
 * （在那之前他系统里每一颗按钮都按不动），而没有人回头量它的代价：
 * 这个产品的招牌承诺是「用讲的改」，而它今天在每一页、对每一个老板，
 * 都在一颗按钮后面。
 *
 * ── 🔴 这个档案只接功能，不设计长相 ──────────────────────────────────────
 *
 * 他 2026-09-09 讲的：`你只是要接功能 反正Ui是另外一邊設計的`。
 * 所以这里是**一条能按的线 ＋ 一个能打字的框 ＋ 它回的那几句**，
 * 用的全部是已经在的 token，没有一个新的形状。
 * 排法、密度、它该长什么样 —— [重点 22c] 那是画面那一边的地盘，登记在任务档里。
 *
 * ── 为什么不复用编辑器那一块 ──────────────────────────────────────────────
 *
 * `ai-assistant.tsx` 那一块 1,184 行，而它 `usePuck()` —— 它整个存在的理由
 * 有一半是**把回来那棵树 dispatch 进画布**。他的系统这一页没有画布：
 * `WorkView` 画的是伺服器那一份。把它搬过来要一个 Puck provider，
 * 那等於为了一个输入框在这一页上装一整套编辑器。
 *
 * 🔴 **而没有被抄一份的，是那几句话**：`sayWhyNot` 从那一块 import 过来，
 * 因为它认得的是 `messages/{en,zh}.json` 里那 68 个代号 —— 抄一份过来
 * 就是第二份会漂的清单，而这个仓库栽在那上面至少八次。
 *
 * ── 它跟编辑器那一块**行为上**的三个不同，每一个都有理由 ──────────────────
 *
 *   ① **送 `surface: "work"`**。这一页改不了样子，所以那一支会告诉模型，
 *      而万一它还是给了一个改版面的操作，那个操作会被**当成没做成并且讲出来**
 *      （`designSurfaceOnly`）。做不到而不讲，就是「说了没做」。
 *   ② **没有撤销**。编辑器那一块的撤销撤的是**版面**（它存着 `before` 那棵树）。
 *      这里做成的是**他帐上的一行** —— 那不是一颗按钮撤得掉的东西，
 *      而画一颗撤不了的撤销按钮，是这个仓库禁得最严的那一条。
 *      要冲正一笔钱，讲「这一笔记错了」（`reverse_ledger_entry`）。
 *   ③ **做成了就 `router.refresh()`**。那一行在资料库里，不在这棵树里 ——
 *      不刷，助手说记好了而画面不动，正是[重点 23] 讲的那件事。
 */
export function WorkAssistant({
  pageKey,
  data,
  pages,
}: {
  pageKey: string;
  /** 这一页现在长什么样 —— **只送出去给模型看**，不接回来。
   *  它带着投影过的真行（`live-rows`），而那几行的编号正是
   *  「陈太太来了」指得到那一笔的唯一方法（`describeLayout` 印它们）。 */
  data: Data;
  /** 他这套系统有哪几页。只用来给模型认路，什么都不授权。 */
  pages: { key: string; label: string }[];
}) {
  const t = useTranslations("portal.editor");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  /** 上一句的结果。**一句话加上几条它自己讲不出来的事实** —— 顺手扣掉的
   *  那一次套票、差了几个、那条给客人的连结，全部在 `notes` 里，
   *  而它们非讲不可（见 skip-codes.ts 的档头）。 */
  const [said, setSaid] = useState<string[] | null>(null);

  async function send() {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: data,
          instruction: asked,
          pageKey,
          pages,
          /* 🔴 这一格就是这个档案存在的那一句。见 route 里 `surface` 的注解。 */
          surface: "work",
          /* 这一页早就保存过了 —— 他正在看的就是保存出来的那一份。
             讲实话要紧：`generated: true` 会让模型以为「排法」还改得动。 */
          generated: false,
        }),
      });
      if (res.status === 429) {
        setSaid([t("aiRateLimited")]);
        return;
      }
      if (!res.ok) {
        setSaid([t("aiBroke")]);
        return;
      }
      const out = (await res.json()) as {
        explanation?: string;
        applied?: number;
        notes?: Skip[];
        skipped?: Skip[];
        refetch?: boolean;
      };
      const lines = [
        (out.explanation ?? "").trim() ||
          (out.applied ? t("aiWorkDone") : t("aiWorkNothing")),
        ...(out.notes ?? []).map((n) => sayWhyNot(t, n)),
        ...(out.skipped ?? []).map((n) => sayWhyNot(t, n)),
      ].filter(Boolean);
      setSaid(lines);
      setText("");
      /* 🔴 那一行在资料库里，不在这一页手上那棵树里。见档头 ③。 */
      if (out.refetch) router.refresh();
    } catch {
      setSaid([t("aiFailed")]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        data-work-ai="closed"
        onClick={() => setOpen(true)}
        className="w-full [background-color:var(--color-surface)] [border-color:var(--color-line)] [border-top-width:1px] [color:var(--color-on-surface-dim)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] text-start"
      >
        {t("aiWorkOpen")}
      </button>
    );
  }

  return (
    <section
      data-work-ai="open"
      aria-label={t("aiWorkTitle")}
      className="flex flex-col gap-2 [background-color:var(--color-surface)] [border-color:var(--color-line)] [border-top-width:1px] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="[color:var(--color-on-surface)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
          {t("aiWorkTitle")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="[color:var(--color-on-surface-dim)] [font-size:var(--text-xs)] [min-height:44px] underline"
        >
          {t("aiClose")}
        </button>
      </div>

      {said ? (
        <div
          data-work-ai-said
          className="flex flex-col gap-1 [color:var(--color-on-surface)] [font-size:var(--text-sm)]"
        >
          {said.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          /* Enter 送出、Shift+Enter 换行 —— 跟编辑器那一块同一条，
             也跟他每天在用的每一个讯息框同一条。 */
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        rows={2}
        aria-label={t("aiWorkTitle")}
        placeholder={t("aiWorkPlaceholder")}
        className="w-full resize-none [background-color:var(--color-canvas)] [border-color:var(--input,var(--color-line))] [border-radius:var(--radius-control)] [border-width:1px] [color:var(--color-on-canvas)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="[color:var(--color-on-surface-dim)] [font-size:var(--text-micro)]">
          {t("aiEnterHint")}
        </span>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="[background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [min-height:44px] [padding-inline:calc(var(--pad-control-x)*1.4)] disabled:opacity-60"
        >
          {busy ? t("aiThinking") : t("aiSubmit")}
        </button>
      </div>
    </section>
  );
}
