"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import type { Skip } from "@/lib/portal/skip-codes";
import { sayWhyNot } from "./ai-assistant";

/**
 * 一颗火花 —— 这一块唯一一个自己的形状。
 *
 * 24×24 的画框、`stroke="currentColor"`、1.8 的笔画 —— 跟侧栏那一套
 * （`rail-icons.tsx`）同一只手画的，所以它自己没有颜色，
 * 套什么配色就跟着走。收起来的时候它是「这里可以讲话」唯一的记号：
 * 改之前那一条只有一句小字，而一句小字在画面下缘读起来是一句说明，不是一个入口。
 */
function IconSpark({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5 13.8 8.2 18.5 10 13.8 11.8 12 16.5 10.2 11.8 5.5 10 10.2 8.2Z" />
      <path d="M18.4 15.6 19.2 17.8 21.4 18.6 19.2 19.4 18.4 21.6 17.6 19.4 15.4 18.6 17.6 17.8Z" />
    </svg>
  );
}

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
  /**
   * 🔴 他刚才讲过什么 —— **一个助手不记得上一句话，就不叫助手。**
   *
   * ── 为什么这一格 2026-09-09 补上 ──────────────────────────────────────
   *
   * 接进产品那一边的第一版**一个字都没送**，而编辑器那一块从写出来那天就
   * 送最近三轮（`ai-assistant.tsx:381`）。於是同一支 route、同一个模型，
   * 在他每天开的那一页上比在「改设计」那一屏上笨 —— 他讲
   * 「加一单 陈太太 4,800」，再讲「照样再来一张给合发」，它不知道「照样」
   * 是什么。**能力有、线没接**，第十八次。
   *
   * ── 只有三轮，而且只有做成的那几轮 ────────────────────────────────────
   *
   * 跟编辑器那一份**一模一样的三行**（`.filter(done).slice(-3)`），不是
   * 另一份：两份会漂，而漂的那天他会发现同一句话在两个地方结果不同。
   *
   * ⚠️ **拒绝的那几轮也进来，而这是跟编辑器那一份对齐的**（它 filter 的是
   * `state === "done"`，也就是这一次呼叫成功，不是「做成了一件事」）。
   * 一句「那要在改设计那边讲」是他刚才真的读到的一句话 —— 藏起来，
   * 他接着讲「那算了」的时候模型不知道在讲哪一件。
   * **只有整支呼叫失败（没有 explanation）的那几轮不进来。**
   *
   * ⚠️ **它活在这个分页里，关掉就没了** —— 那是今天的实况，不是设计。
   * 跨次开机的记忆要一张表，[任务 322] 记着（mem0 的做法：只加不覆盖 ·
   * 做成了的事实优先 · 注入成一段带标题的话）。
   */
  const [turns, setTurns] = useState<{ asked: string; did: string }[]>([]);
  /**
   * 🔴 刚才那一句话把页面改成什么样 —— 而这一格在修一个量得到的竞走。
   *
   * ── 2026-09-09 `check:work-ai` 抳出来的 ──────────────────
   *
   * 他用讲的开一张单，马上接着讲那一张（「在那张上加三个风扇」），
   * 助手回**「这一页上找不到那张单」** —— 而那一行就在他眼前的表里。
   * 两次跑一次绿一次红，典型的竞走：`router.refresh()` 发出去而还没落地，
   * 面板手上那棵树还是旧的，而 `describeLayout` 就是照那棵树印行号的。
   *
   * ── 为什么接回来那一棵，而不是等它刷完 ────────────────
   *
   * 那一支 route 写完真记录之后会用**同一支投影**（`withFreshRows`）
   * 把新那几行插回回传的那棵树里 —— 也就是说**答案本来就在手上**，
   * 只是之前没有人接。编辑器那一块一直在接（它 dispatch 进画布），
   * 而这一块把它丢掉了。**同一件事两条路，只修了一条。**
   *
   * ⚠️ 而伯器刷完的那一刻，`data` 那个 prop 会换一个新的 ——
   * 那时候伯器那一份才是权威的，所以下面那一句把这一格清掉。
   */
  const [latest, setLatest] = useState<Data | null>(null);
  /* 伯器那一份刷到了 → 以它为准。 */
  useEffect(() => setLatest(null), [data]);

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
          layout: latest ?? data,
          instruction: asked,
          pageKey,
          pages,
          /* 最近三轮 —— 跟编辑器那一块同一份形状。见 `turns` 的注解。 */
          history: turns.slice(-3),
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
        /* 带着刚写进去那几行的那棵树 —— 见 `latest`。 */
        layout?: Data;
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
      /* 🔴 只记做成了的那几轮，而且记的是**它自己那一句**，不是我们
         替它拼的那几行 —— 拼出来的那几行带着「顺手扣了一次套票」那种
         事实，送回去会被当成他讲过的话。 */
      /* 🔴 接住它，下一句话就指得到刚才那一行。 */
      if (out.layout) setLatest(out.layout);
      const did = (out.explanation ?? "").trim();
      if (did) setTurns((prev) => [...prev, { asked, did }].slice(-3));
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
      <>
        {/* 宽屏 —— 一条底栏，中间**一个看起来就是输入框的东西**。
            改之前它是一整条贴边的灰，左边一句小字，右边一大片空白：
            实拍上它读起来像浏览器的状态列，而这是这个产品的招牌承诺
            （[任务 318](../../../../docs/founder-tasks.md)）。
            ⚠️ 位置一个像素都没有动 —— 整页宽、`fixed`、在内容外面，
            那三样是 system-view 的 `askClass` 两次看图换来的。 */}
        <div className="max-lg:hidden [background-color:var(--color-surface)] [border-color:var(--color-line)] [border-top-width:1px] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]">
          <button
            type="button"
            data-work-ai="closed"
            onClick={() => setOpen(true)}
            className="mx-auto flex w-full max-w-[46rem] items-center gap-2 [background-color:var(--color-canvas)] [border-color:var(--color-line)] [border-radius:var(--radius-control)] [border-width:1px] [color:var(--color-on-surface-dim)] [font-size:var(--text-sm)] [min-height:40px] [padding-inline:var(--pad-control-x)] text-start"
          >
            <IconSpark className="h-[16px] w-[16px] shrink-0" />
            <span className="truncate">{t("aiWorkOpen")}</span>
          </button>
        </div>

        {/* 窄屏 —— 一颗浮在那条分页列**上面**的圆钮。
            改之前窄屏一个字都没画，理由写在 `askClass` 上：
            两条贴在同一条边上，吃掉的永远是内容最后那一行。**那句话是对的**，
            所以这里不再多贴一条 —— 一颗离下缘 72px 的圆钮避得开那条 64px 的分页列，
            而 16 个老板端 app 里放这颗钮的位置就是这里。 */}
        <button
          type="button"
          data-work-ai="closed-narrow"
          aria-label={t("aiWorkOpen")}
          onClick={() => setOpen(true)}
          className="fixed bottom-[4.5rem] end-4 z-30 grid h-14 w-14 place-items-center rounded-full shadow-lg lg:hidden [background-color:var(--color-primary)] [color:var(--color-on-primary)]"
        >
          <IconSpark className="h-6 w-6" />
        </button>
      </>
    );
  }

  return (
    <section
      data-work-ai="open"
      aria-label={t("aiWorkTitle")}
      /* 🔴 窄屏上它是一张从下缘长出来的纸，**停在那条分页列上面**（`bottom-16`）——
         盖住换页那一条，等於在他讲话的时候把出路收走。
         宽屏上它就是那条底栏自己长高，位置不变。
         两边共用同一个中线宽度（46rem），所以摊开来跟收起来是同一个东西。 */
      className="flex flex-col gap-2 [background-color:var(--color-surface)] [border-color:var(--color-line)] [border-top-width:1px] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-16 max-lg:z-30 max-lg:[border-radius:var(--radius-md)_var(--radius-md)_0_0] max-lg:shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-[46rem] items-center justify-between gap-2">
        <span className="flex items-center gap-2 [color:var(--color-on-surface)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
          <IconSpark className="h-[16px] w-[16px] shrink-0" />
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
          /* 它回的话会长 —— 一段读得完的宽度，而且**自己滚**，
             不要把底下那个框推出画面。 */
          className="mx-auto flex w-full max-w-[46rem] flex-col gap-1 overflow-y-auto [color:var(--color-on-surface)] [font-size:var(--text-sm)] [max-height:38vh]"
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
        className="mx-auto w-full max-w-[46rem] resize-none [background-color:var(--color-canvas)] [border-color:var(--input,var(--color-line))] [border-radius:var(--radius-control)] [border-width:1px] [color:var(--color-on-canvas)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]"
      />

      <div className="mx-auto flex w-full max-w-[46rem] items-center justify-between gap-2">
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
