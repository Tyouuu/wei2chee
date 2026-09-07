import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { CounterDesk } from "./counter-desk";

/**
 * 柜台。
 *
 * ── 为什么这一页要存在（2026-09-07）────────────────────────────────────
 *
 * `scan_item` · `ring_up_sale`（20260906830000 · 850000）两支
 * **画面上一个入口都没有**，而 [任务 242](../../../../../docs/founder-tasks.md#242)
 * 自己的收尾就写着这一句：
 *
 *   「**那一屏不存在** —— 扫描框 · 篮子 · 收钱那一格，三样都是画面那一边。」
 *
 * 一笔柜台交易到今天为止要打**四次**（开单 → 写行 → 出货 → 记钱），
 * 而柜台一天做两百笔。
 *
 * ── 🔴 它挑哪一页开那张单 ───────────────────────────────────────────────
 *
 * `ring_up_sale` 要一个走单模块。柜台**没有报价这一步** ——
 * 客人拿着东西站在面前，钱当场收。所以它开在「订单」那一类上，
 * 而不是报价单。这一页自己去问他有哪几页，**挑第一页会开单而且不是报价的**；
 * 一页都没有就讲一句话，不画一张按下去一定失败的表单。
 *
 * ── 一页货架都没有就不画 ────────────────────────────────────────────────
 *
 * 扫码问的是 `catalog_items.sku`。一间没有货架的生意（装修 · 沙龙）
 * 扫什么都扫不到 —— 而那不是一句错误讯息，那是「这一页不属於你」。
 */

export const dynamic = "force-dynamic";

export default async function CounterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  /* 🔴 柜台在收钱 —— 而钱那一层只有老板看得到（20260901010000）。
     一个师傅打开它，`ring_up_sale` 底下那一支记帐会拒绝，
     而他要填完整篮才知道。 */
  if (workspace.role !== "owner") notFound();

  const supabase = await createSessionSupabaseClient();
  const [
    { data: paletteRow },
    { data: pageRows },
    { data: itemRows },
    { data: branchRows },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("palette")
      .eq("id", workspace.projectId)
      .maybeSingle(),
    supabase
      .from("project_pages")
      .select("page_key")
      .eq("project_id", workspace.projectId)
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("catalog_items")
      .select("id")
      .eq("project_id", workspace.projectId)
      .is("archived_at", null)
      .limit(1),
    supabase
      .from("branches")
      .select("id, name, active")
      .eq("project_id", workspace.projectId)
      .order("name"),
  ]);

  const palette = (paletteRow?.palette as string | null) ?? null;
  const keys = ((pageRows ?? []) as { page_key: string }[]).map(
    (p) => p.page_key,
  );
  /* 一张柜台的单开在「订单」那一类上。⚠️ 顺序是判断不是巧合：
     `orders` 是最贴的一个，`projects`/`tasks` 是退而求其次，
     **`quotations` 永远不在里面** —— 柜台没有报价这一步。 */
  const moduleKey =
    ["orders", "projects", "tasks"].find((k) => keys.includes(k)) ?? null;
  const hasShelf = ((itemRows ?? []) as unknown[]).length > 0;
  const branches = (
    (branchRows ?? []) as { id: string; name: string; active: boolean }[]
  )
    .filter((b) => b.active)
    .map((b) => ({ id: b.id, name: b.name }));

  const words = {
    scan: t("counter.scan"),
    scanHint: t("counter.scanHint"),
    add: t("counter.add"),
    /* 🔴 这两句带占位符（{code} · {name}），而值只有浏览器那一边知道 ——
       他刚扫的那一串、那件货的名字。next-intl 会把 {…} 当成 ICU 参数，
       所以 `t()` 不给值会退回 key 本身：画面上印出 `portal.counter.scanNone`。
       `t.raw` 拿的是没有解析过的那一句，替换交给那一边做。
       ⚠️ 那把尺现在有一条在守这件事：整屏不准出现 `portal.` 开头的字。 */
    scanNone: t.raw("counter.scanNone"),
    scanSerial: t.raw("counter.scanSerial"),
    scanFailed: t("counter.scanFailed"),
    qty: t("counter.qty"),
    remove: t("counter.remove"),
    basket: t("counter.basket"),
    taken: t("counter.taken"),
    branch: t("counter.branch"),
    branchAny: t("counter.branchAny"),
    ring: t("counter.ring"),
    ringing: t("counter.ringing"),
    ringFailed: t("counter.ringFailed"),
    change: t("counter.change"),
    owed: t("counter.owed"),
    shortShelf: t.raw("counter.shortShelf"),
    doneNew: t("counter.doneNew"),
    doneAgain: t("counter.doneAgain"),
    next: t("counter.next"),
    empty: t("counter.empty"),
  };

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("counter.title")} subtitle={t("counter.lede")} />
      <PageBody>
        {!hasShelf ? (
          <DeskCard>
            <p className={deskDim}>{t("counter.needShelf")}</p>
          </DeskCard>
        ) : !moduleKey ? (
          <DeskCard>
            <p className={deskDim}>{t("counter.needPage")}</p>
          </DeskCard>
        ) : (
          <CounterDesk
            projectId={workspace.projectId}
            moduleKey={moduleKey}
            branches={branches}
            words={words}
          />
        )}
      </PageBody>
    </StyleScope>
  );
}
