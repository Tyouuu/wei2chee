"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
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
  open,
  setOpen,
}: {
  pageKey: string;
  /** 这一页现在长什么样 —— **只送出去给模型看**，不接回来。
   *  它带着投影过的真行（`live-rows`），而那几行的编号正是
   *  「陈太太来了」指得到那一笔的唯一方法（`describeLayout` 印它们）。 */
  data: Data;
  /** 他这套系统有哪几页。只用来给模型认路，什么都不授权。 */
  pages: { key: string; label: string }[];
  /** 开着没有 —— **住在外面**（`system-view`）。
   *
   *  Stripe 那一条是**把内容推开**，不是浮在字上面（2026-09-09 在 1400 的
   *  实拍上量的：内容从 1400 收到 1055）。要推开，外面那一层得知道它开着，
   *  所以这两个不在这里。
   *  ⚠️ 一个浮在他表格上的面板会盖掉最右边那一栏，而那一栏通常是钱。 */
  open: boolean;
  setOpen: (next: boolean) => void;
}) {
  const t = useTranslations("portal.editor");
  const router = useRouter();
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
  /**
   * 🔴 他拍的那一张 —— 供应商的发票 · 手写的单 · 一张截图。
   *
   * ── 为什么这颗回形针 2026-09-09 才到产品这一边 ────────────────
   *
   * 老板自己点名的用法：`拍照給妳分析啊 上傳invoice啊`。
   * 而量出来那颗回形针**只在「改设计」那一屏上** —— 也就是说，一个要把
   * 供应商发票拍进去的五金店老板，得先按进一个改版面的地方。
   * 他 9-09 又讲了一次：`我只要注重在我的产品罢了`。
   *
   * ── 🔴 图进的是 private 那个桶 ────────────────────────────
   *
   * `ask-photos`（20260909160000），跟编辑器那一块**同一个桶、同一条路**：
   * 只送**路径**不送网址，缩图是浏览器自己的 `blob:`。
   * 一张发票上印着他的进货价、他的供应商、他一个月的租金 ——
   * 那不可以变成一条任何人打得开的连结。
   */
  const [shot, setShot] = useState<{ path: string; preview: string } | null>(
    null,
  );
  const [attaching, setAttaching] = useState(false);
  /**
   * 🔴 用讲的，不用打的。
   *
   * ── 数字（2026-09-09 读回来的）────────────────────────────────────
   *
   * Gartner：**2026 年 75%** 的外勤公司会用语音；ServiceTitan 的行业报告：
   * **12% 已经在用、34% 在试**；Housecall Pro 问 400 多家承包商：
   * **70% 试过、40% 在用**。而这个仓库量出来是**零个语音输入**。
   *
   * [重点 19] 早就分清楚了：会坐着打字的是**建造期**那个老板；
   * 每天在工地上、手上带油、戴着手套的那一个是**运营期** —— 他打不了字。
   *
   * ── 🔴 转成字之后 **落在框里**，不自动送出 ─────────────────────
   *
   * 一句「三千」被听成「一万三」而直接写进他的帐，是他月底才发现的错。
   * 所以这里跟 `/api/receipt` 同一条：**它读，它不写**，按送出的还是他。
   *
   * ⚠️ **接上去的时候不覆盖他已经打的字** —— 他可能打了一半改用讲的。
   */
  const [hearing, setHearing] = useState<"off" | "rec" | "reading">("off");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function startTalking() {
    if (hearing !== "off") return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      /* 他按了「不允许」，或者这台机器没有麦克风。讲一句，不要静静没反应。 */
      setSaid([t("aiHearNoMic")]);
      return;
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      /* 🔴 麦克风要关掉。不关，浏览器上那颗红点会一直亮着 ——
         一个老板看到自己的手机在录音而他以为已经停了，只会关掉整个产品。 */
      stream.getTracks().forEach((tr) => tr.stop());
      const clip = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!clip.size) {
        setHearing("off");
        return;
      }
      setHearing("reading");
      try {
        const body = new FormData();
        body.append("clip", clip, "note.webm");
        const res = await fetch("/api/portal/hear", { method: "POST", body });
        const out = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          text?: string;
        };
        if (out.ok && out.text) {
          /* 接在他已经打的字后面，不覆盖。见上面那一段。 */
          setText((prev) => (prev.trim() ? `${prev.trim()} ${out.text}` : out.text!));
        } else {
          setSaid([t("aiHearNothing")]);
        }
      } catch {
        setSaid([t("aiHearNothing")]);
      } finally {
        setHearing("off");
      }
    };
    rec.start();
    setHearing("rec");
    /* 🔴 六十秒自己停。一支忘了按停的录音会一直录下去，
       而那一段最后要整个上传 —— 他的流量，他的电。 */
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 60000);
  }

  function stopTalking() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }
  const shotRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    setAttaching(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: ws } = await supabase.rpc("my_workspace");
      /* 他现在站着的那一家 —— **不是「我拥有的那一家」**。一个师傅拍
         工地照问一句，路径要落在老板那一家下面，不然那道闸
         （`works_here`）当场挡掉。 */
      const projectId = (ws as { project_id?: string }[] | null)?.[0]
        ?.project_id;
      if (!projectId) return;
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .slice(0, 5);
      const path = `${projectId}/ask-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("ask-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return;
      setShot({ path, preview: URL.createObjectURL(file) });
    } finally {
      setAttaching(false);
    }
  }

  function clearShot() {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }
  /* 伯器那一份刷到了 → 以它为准。 */
  useEffect(() => setLatest(null), [data]);

  async function send() {
    const asked = text.trim();
    /* 🔴 只附一张图、一个字都不打，也要送得出去 ——
       一个手上带着油的师傅拍完那张单，下一个动作就是按送出。 */
    if ((!asked && !shot) || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: latest ?? data,
          /* 只有一张图的时候，替他讲那一句 —— 那一支 route 拒绝空句子。 */
          instruction: asked || t("aiWorkShot"),
          /* 🔴 路径，不是网址。见 `shot` 那一段。 */
          imagePath: shot?.path ?? null,
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
      clearShot();
      /* 🔴 那一行在资料库里，不在这一页手上那棵树里。见档头 ③。 */
      if (out.refetch) router.refresh();
    } catch {
      setSaid([t("aiFailed")]);
    } finally {
      setBusy(false);
    }
  }

  /* 一句都还没讲的时候，给他几句现成的 —— **点一下就填进框里**。
     借的是 assistant-ui 那一块的「START WITH」（2026-09-09 拍到）：
     一个空框问的是「你要什么」，而他多半答不上来；
     几句现成的问的是「是不是这个」，那一句他答得了。
     ⚠️ 这几句**不是发明出来的**，是从他自己那一句例子拆出来的
     （`aiWorkPlaceholder`），所以它们永远是这一支真的做得到的事。 */
  const starters = t("aiWorkPlaceholder")
    .replace(/^e\.g\.\s*/i, "")
    .split(" · ")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!open) {
    /* 🔴 宽屏收起来的时候**这里什么都不画** —— 入口搬到侧栏那一行去了
       （`RailNav` 的 `askLabel`）。

       2026-09-09 拍了 23 家产品，真的开得出面板的六家里，
       **Stripe 文件跟 assistant-ui 把入口放在同一个位置**：跟搜索并排，
       主要控件那一区 —— 不是画面下缘。老板跟着纠正得更准：
       `不是顶栏吧 我们的是sidebar` —— 我们的主要控件那一区就是侧栏最上面。

       窄屏那条侧栏本来就藏起来，所以那里留一颗浮钮。
       六家里三家（Intercom · Chatbase · Tidio）收起来就是这一颗。 */
    return (
      <button
        type="button"
        data-work-ai="closed-narrow"
        aria-label={t("aiWorkOpen")}
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.5rem] end-4 z-30 grid h-14 w-14 place-items-center rounded-full shadow-lg lg:hidden [background-color:var(--color-primary)] [color:var(--color-on-primary)]"
      >
        <IconSpark className="h-6 w-6" />
      </button>
    );
  }

  /**
   * 右边一整条 —— 照 Stripe 文件那一条抄（[重点 7j]：照抄，不要自己判）。
   * 2026-09-09 在 1400 的实拍上逐项量的：
   *
   *   宽    **345px**，贴着右边
   *   形状  **没有圆角 · 没有留白 · 没有阴影**，左边一条 1px 的线
   *   高    整条到底
   *   抬头  **56px**：左边一颗火花 ＋ 标题，右边一颗 ×
   *   中间  对话，自己滚
   *   底下  **药丸形**的框（圆角 22px）＋ 右边一颗圆的送出钮
   *   内距  左右各 16px
   *
   * ⚠️ 借 assistant-ui 一样东西（[重点 7h]：一个来源留一点，写下落点）：
   * **空的时候那几句现成的问题**。
   *
   * ⚠️ 窄屏整屏 —— 那两家在手机上也是整屏；345 挤进 390 剩下 45px
   * 什么都放不下。
   */
  /* 🔴 **颜色用的是这个设计系统里真的存在的那几个名字。**
     第一版（连同底下那一条）写的是 `--color-surface` · `--color-on-surface`
     · `--color-line` —— **这四个名字整个仓库一个 CSS 档案都没有定义过**。
     没有定义的变数不会报错，它只是**什么都不画**：於是那一块是透明的，
     背后是 Formae 自己那层深色壳，拍出来整条是黑的。
     2026-09-09 逐像素量到 `[5,7,12]` 才看到（[重点 7l]：数字过关不等於眼睛过关）。
     真的那几个：地是 `--color-canvas` · 字是 `--color-paper` /
     `--color-paper-dim` · 线是 `--border-subtle`（跟 `DayColumns` 同一套）。 */
  return (
    <section
      data-work-ai="open"
      aria-label={t("aiWorkTitle")}
      className="fixed inset-0 z-40 flex flex-col [background-color:var(--color-canvas)] [border-color:var(--border-subtle)] lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[345px] lg:[border-left-width:1px]"
    >
      {/* 抬头 56px。 */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 [border-bottom-width:1px] [border-color:var(--border-subtle)] [padding-inline:var(--pad-control-x)]">
        <span className="flex items-center gap-2 [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
          <IconSpark className="h-[18px] w-[18px] shrink-0" />
          {t("aiWorkTitle")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("aiClose")}
          title={t("aiClose")}
          className="grid h-11 w-11 shrink-0 place-items-center [color:var(--color-paper-dim)] [font-size:var(--text-sm)]"
        >
          ✕
        </button>
      </div>

      {/* 对话 —— 自己滚。空的时候是那几句现成的。 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]">
        {said ? (
          <div
            data-work-ai-said
            className="flex flex-col gap-1 [color:var(--color-paper)] [font-size:var(--text-sm)]"
          >
            {said.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {starters.map((one) => (
              <button
                key={one}
                type="button"
                onClick={() => setText(one)}
                className="flex [border-radius:var(--radius-md)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] text-start hover:[background-color:var(--color-canvas)]"
              >
                {one}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底下那一格。 */}
      <div className="shrink-0 [border-color:var(--border-subtle)] [border-top-width:1px] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]">
        {shot ? (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.preview}
              alt=""
              className="h-10 w-14 rounded-[var(--radius-xs)] object-cover"
            />
            <button
              type="button"
              onClick={clearShot}
              className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] underline"
            >
              {t("aiImageRemove")}
            </button>
          </div>
        ) : null}

        {/* 药丸形的框 ＋ 右边一颗圆钮 —— 参考那六家里五家都是这个形状。 */}
        <div className="flex items-end gap-2 rounded-[22px] [background-color:var(--color-canvas)] [border-color:var(--border-subtle)] [border-width:1px] [padding-block:7px] [padding-inline:14px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              /* Enter 送出、Shift+Enter 换行 —— 跟他每天在用的每一个讯息框同一条。 */
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            aria-label={t("aiWorkTitle")}
            /* 🔴 **短的那一句。** 那三个例子已经在上面当按钮了（点一下就填进来），
               而完整那一句在 345 的框里会被切在半路：拍出来是
               `e.g. Mrs Tan has arrived · log RM 180 for` —— 断在介系词上。
               ⚠️ 这一句跟抬头今天是同一份字，看起来重复；
               要一句自己的（`aiWorkComposer`），而 `messages/*.json` 在别人手上。 */
            placeholder={t("aiWorkOpen")}
            className="max-h-32 min-h-[26px] w-full resize-none border-0 bg-transparent p-0 [color:var(--color-on-canvas)] [font-size:var(--text-sm)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!text.trim() && !shot)}
            aria-label={busy ? t("aiThinking") : t("aiSubmit")}
            title={busy ? t("aiThinking") : t("aiSubmit")}
            className="mb-[1px] grid h-7 w-7 shrink-0 place-items-center rounded-full [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] disabled:opacity-40"
          >
            ↑
          </button>
        </div>

        {/* 拍照 · 用讲的 · 那一句提示。全部留着，只是换了位置。 */}
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={shotRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attach(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            data-work-ai-mic
            onClick={() => (hearing === "rec" ? stopTalking() : void startTalking())}
            disabled={hearing === "reading" || busy}
            className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] [min-height:44px] underline disabled:opacity-60"
          >
            {hearing === "rec"
              ? t("aiHearStop")
              : hearing === "reading"
                ? t("aiHearReading")
                : t("aiHearStart")}
          </button>
          <button
            type="button"
            data-work-ai-shot
            onClick={() => shotRef.current?.click()}
            disabled={attaching}
            className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] [min-height:44px] underline disabled:opacity-60"
          >
            {attaching ? "\u2026" : t("aiImageAdd")}
          </button>
        </div>
        <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
          {t("aiEnterHint")}
        </p>
      </div>
    </section>
  );
}
