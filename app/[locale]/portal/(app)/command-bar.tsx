"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * 找东西 —— 这个工作台一直没有的那一层。
 *
 * ── 为什么做这个，而不是再调一次颜色（2026-09-02）────────────────────────────
 * 老板：`就是如果很多页的话 就好像会一直重复的问题 所以才要你去学习去复刻
 * 更多不同后台的页面 看看其他人是什么去做的`。
 *
 * **28 个真的后台，28 个都有搜索。我们有 0 个。**（`.screenshots/admins/`，
 * 9-02 实拍：Studio Admin 顶栏 `Search ⌘J` · Tabler · AntD Pro · Notus ·
 * shadcn-admin · Horizon · Mantis · Flowbite…）
 *
 * 而我们最需要它：老板手上有 **83 个组件 · 216 个版段 · 12 个模板 · 6 套风格**
 * 加他自己的页，**三百多样东西，没有任何一个地方可以找**。
 * 版段库那一页实测 **21,417px 高** —— 22 个屏幕的滚动，才是「翻一遍」。
 *
 * ⚠️ **[任务 15](../../../../docs/founder-tasks.md) 砍掉过一个 ⌘K。**
 * 砍的理由是它**搜不到东西** —— 在一个卖「先看到你的系统」的预览里放一个
 * 假的搜索框。那一条禁的是**假的**，不是搜索。这一个搜的是真的东西，
 * 而且每一条结果都真的落在那样东西上（组件跟版段带 `?q=`，落地就已经筛好）。
 *
 * ── 三个决定 ────────────────────────────────────────────────────────────────
 * **① 目录是懒载入的。** 组件那份目录要 `puckConfig`，那是这个仓库最重的一份
 * import。挂在外壳上等於每一页都付一次钱，而九成的页面永远不会打开这个面板。
 * 所以按下去才 `await import(...)`。
 *
 * **② 键盘不是唯一的门。** ⌘K 只有知道它存在的人按得到 ——
 * 手机编辑器那个「可以左右滑」的教训（[任务 92](../../../../docs/founder-tasks.md)）：
 * **画面上没有讲，就等於没有。** 所以侧栏顶上有一颗看得见的按钮，
 * 上面印着快捷键。
 *
 * **③ 分组、而且讲清楚每一条是什么。** 一份三百条的平清单答不了
 * 「我找到的是一个组件还是我自己的一页」。右边那个字就是答案。
 */

type Kind = "page" | "go" | "block" | "section";

type Hit = {
  id: string;
  label: string;
  /** 第二行 —— 它属於哪一格（组件的分类、版段的货架）。 */
  sub?: string;
  kind: Kind;
  href: string;
};

/** 分组的顺序 = 他最可能在找什么的顺序。他自己的页永远第一。 */
const KIND_ORDER: Kind[] = ["page", "go", "block", "section"];

/** 一条结果配不配得上这个字：不分大小写，标签跟第二行都算。
 *  故意**不做**模糊匹配 —— 一个把「表格」配到「表单」的搜索，
 *  比没有搜索更让人不信任它。 */
function score(h: Hit, q: string): number {
  const label = h.label.toLowerCase();
  const sub = (h.sub ?? "").toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  const i = label.indexOf(q);
  if (i >= 0) return 2 + i / 100;
  if (sub.includes(q)) return 40;
  if (h.id.toLowerCase().includes(q)) return 50;
  return Infinity;
}

/** 把配到的那几个字画亮。用品牌色 —— 这是整个面板唯一有颜色的地方。 */
function Mark({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent [color:var(--color-brand)] [font-weight:var(--fw-semibold)]">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function CommandBar({
  locale,
  open,
  onClose,
  pages,
  isOwner,
}: {
  locale: string;
  open: boolean;
  onClose: () => void;
  /** 他自己的页，外壳本来就有 —— 不再查一次。 */
  pages: { key: string; label: string }[];
  isOwner: boolean;
}) {
  /** 目录。null = 还没载入（见决定 ①）。
   *  住在**外层**，所以关掉再打开不用重新算那三百条。 */
  const [catalogue, setCatalogue] = useState<Hit[] | null>(null);
  const base = `/${locale}/portal`;

  /* 决定 ①：打开才载入那三百条。 */
  useEffect(() => {
    if (!open || catalogue) return;
    let live = true;
    (async () => {
      const [{ BLOCK_META }, { puckConfig }, { shelfNames }, { LABELS_EN }] =
        await Promise.all([
          import("@/components/blocks"),
          import("@/design-system/editor/puck-config"),
          import("./sections/shelves"),
          import("@/design-system/editor/labels-en"),
        ]);
      if (!live) return;
      const shelves = shelfNames(locale);
      /* 🔴 组件的名字在 `puckConfig` 里是中文的 —— 中文是唯一真相，英文是它的
         投影（[任务 8](../../../../docs/founder-tasks.md)）。第一版我直接读了
         原文，於是在 `/en` 上搜「hero」，结果里混着「说明大标题」「重点数字卡」。
         **那正是[任务 18](../../../../docs/founder-tasks.md) 花一整轮清掉的
         386 条中文里的同一种。** 这里只借它那份对照表，不借
         `localisedPuckConfig` —— 我们要的只有名字，不要它整套包过的 render。 */
      const en = (x: string) => (locale === "zh" ? x : (LABELS_EN[x] ?? x));
      const out: Hit[] = [];

      /* 组件：走 Puck 自己的目录，不另外手写一份清单。
         这个仓库栽在「第二份手写名单」上至少四次。 */
      const cats = (puckConfig.categories ?? {}) as Record<
        string,
        { components?: string[] }
      >;
      const comps = puckConfig.components as unknown as Record<
        string,
        { label?: string }
      >;
      for (const [cat, group] of Object.entries(cats)) {
        for (const name of group.components ?? []) {
          const c = comps[name];
          if (!c) continue;
          const label = en(c.label ?? name);
          out.push({
            id: `block:${name}`,
            label,
            sub: en(cat),
            kind: "block",
            href: `${base}/library?q=${encodeURIComponent(label)}`,
          });
        }
      }

      for (const [key, meta] of Object.entries(BLOCK_META)) {
        out.push({
          id: `section:${key}`,
          label: meta.title,
          sub: shelves[meta.cats] ?? meta.cats,
          kind: "section",
          href: `${base}/sections?q=${encodeURIComponent(meta.title)}`,
        });
      }

      setCatalogue(out);
    })().catch(() => setCatalogue([]));
    return () => {
      live = false;
    };
  }, [open, catalogue, base, locale]);

  /* ⚠️ 关掉的时候**整个卸载**，不是留在那里把状态清空。
     清空要在 effect 里 setState，而那是 React 19 明确不建议的写法
     （`react-hooks/set-state-in-effect`，[任务 47](../../../../docs/founder-tasks.md)
     那道关会挡）。重新挂载天生就是空的，而且少一次多余的渲染。
     目录留在外层，所以「重新挂载」不会重算那三百条。 */
  if (!open) return null;
  return (
    <Palette
      locale={locale}
      onClose={onClose}
      pages={pages}
      isOwner={isOwner}
      catalogue={catalogue}
    />
  );
}

function Palette({
  locale,
  onClose,
  pages,
  isOwner,
  catalogue,
}: {
  locale: string;
  onClose: () => void;
  pages: { key: string; label: string }[];
  isOwner: boolean;
  catalogue: Hit[] | null;
}) {
  const t = useTranslations("portal.find");
  const tShell = useTranslations("portal.shell");
  const router = useRouter();
  const base = `/${locale}/portal`;

  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* 他自己的页 + 固定的去处。这两组不用等目录 —— 面板一打开就该有东西。 */
  const near = useMemo<Hit[]>(() => {
    const own: Hit[] = pages.map((p) => ({
      id: `page:${p.key}`,
      label: p.label,
      kind: "page",
      href: `${base}/${p.key}`,
    }));
    const go: Hit[] = [
      { id: "go:home", label: tShell("home"), kind: "go", href: base },
      {
        id: "go:enquiries",
        label: tShell("enquiries"),
        kind: "go",
        href: `${base}/enquiries`,
      },
      {
        id: "go:library",
        label: tShell("library"),
        kind: "go",
        href: `${base}/library`,
      },
      {
        id: "go:sections",
        label: tShell("sections"),
        kind: "go",
        href: `${base}/sections`,
      },
      {
        id: "go:templates",
        label: tShell("templates"),
        kind: "go",
        href: `${base}/templates`,
      },
      {
        id: "go:styles",
        label: tShell("styles"),
        kind: "go",
        href: `${base}/styles`,
      },
      {
        id: "go:account",
        label: tShell("account"),
        kind: "go",
        href: `${base}/account`,
      },
    ];
    /* 规格书是**买东西的人**才看的东西 —— 师傅打不开它，
       所以不给他一条会撞墙的结果。 */
    if (isOwner)
      go.splice(1, 0, {
        id: "go:spec",
        label: tShell("spec"),
        kind: "go",
        href: `${base}/spec`,
      });
    return [...own, ...go];
  }, [pages, base, tShell, isOwner]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = [...near, ...(catalogue ?? [])];
    if (!needle) {
      /* 空的时候不给三百条 —— 给「你可以去哪里」。
         Studio Admin 空手打开也是给 Navigation 那一组，不是给全部。 */
      return all.filter((h) => h.kind === "page" || h.kind === "go");
    }
    return all
      .map((h) => [h, score(h, needle)] as const)
      .filter(([, s]) => s !== Infinity)
      .sort(
        (a, b) =>
          a[1] - b[1] ||
          KIND_ORDER.indexOf(a[0].kind) - KIND_ORDER.indexOf(b[0].kind),
      )
      .slice(0, 40)
      .map(([h]) => h);
  }, [q, near, catalogue]);

  /* 分组，但保住排序：先出现的那一组排前面。 */
  const groups = useMemo(() => {
    const m = new Map<Kind, Hit[]>();
    for (const h of hits) {
      if (!m.has(h.kind)) m.set(h.kind, []);
      m.get(h.kind)!.push(h);
    }
    return [...m.entries()];
  }, [hits]);

  /** 扁平顺序 —— 键盘走的是这一条，不是分组。 */
  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  const goTo = useCallback(
    (h: Hit) => {
      onClose();
      router.push(h.href);
    },
    [onClose, router],
  );

  /* 隔一帧才 focus —— 面板是同一次点击开的，立刻 focus 会被那次点击吃掉
     （选图器那一次踩过）。这里没有 setState，所以它是一个真的副作用。 */
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  /* 走到哪里就滚到哪里。没有这一段，第九条以后用键盘是瞎走的。 */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[data-cursor='1']")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, hits]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh] [background-color:color-mix(in_srgb,#000_62%,transparent)] [backdrop-filter:blur(3px)]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="flex max-h-[70vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) =>
              flat.length ? (c - 1 + flat.length) % flat.length : 0,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            const h = flat[cursor];
            if (h) goTo(h);
          }
        }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-4 [border-color:var(--color-ink-800)]">
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0 [color:var(--color-paper-dim)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="w-full bg-transparent py-3.5 outline-none [color:var(--color-paper)] [font-size:var(--text-base)] placeholder:[color:var(--color-paper-dim)]"
          />
          <kbd className="shrink-0 rounded-[var(--radius-xs)] border px-1.5 py-0.5 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {catalogue === null
                ? t("loading")
                : t("nothing", { q: q.trim() })}
            </p>
          )}
          {groups.map(([kind, list]) => (
            <div key={kind} className="pb-1">
              <p className="px-4 pb-1 pt-2 uppercase [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:0.08em]">
                {t(`kind.${kind}`)}
              </p>
              {list.map((h) => {
                const i = flat.indexOf(h);
                const on = i === cursor;
                return (
                  <button
                    key={h.id}
                    type="button"
                    data-cursor={on ? "1" : "0"}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goTo(h)}
                    className={`flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left transition-colors ${
                      on
                        ? "[background-color:var(--color-ink-850)] [border-color:var(--color-brand)]"
                        : "border-transparent"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-sm)]">
                      <Mark text={h.label} q={q.trim().toLowerCase()} />
                    </span>
                    {h.sub && (
                      <span className="shrink-0 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                        {h.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 一条脚线，讲清楚这里面到底有多少东西 —— 那是这个产品交到他手上
            的规模，而在这之前没有任何一个画面讲过。 */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
          <span>{t("keys")}</span>
          <span className="tabular-nums">
            {catalogue === null
              ? t("loading")
              : t("scale", { n: near.length + catalogue.length })}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 侧栏顶上那颗看得见的按钮。见决定 ②。 */
export function FindButton({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("portal.find");
  /* ⚠️ 快捷键在服务端画不出来 —— Mac 是 ⌘K，其他是 Ctrl K，猜一个就有一半的人
     看到错的。`useSyncExternalStore` 是 React 给这件事的正解：服务端拿
     `false`，浏览器接手之后自己再画一次，不会有 hydration 警告，
     也不用在 effect 里 setState。 */
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-2 mt-2 flex items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2 transition-colors [border-color:var(--color-nav-border)] [color:var(--color-nav-fg-dim)] hover:[border-color:var(--color-brand)] hover:[color:var(--color-nav-fg)]"
    >
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.5 13.5 3 3" strokeLinecap="round" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-left [font-size:var(--text-xs)]">
        {t("open")}
      </span>
      <kbd
        aria-hidden="true"
        suppressHydrationWarning
        className="shrink-0 rounded-[var(--radius-xs)] border px-1.5 py-0.5 [border-color:var(--color-nav-border)] [font-size:var(--text-micro)]"
      >
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
