import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { TablesDesk, type TableRow } from "./tables-desk";

/**
 * 三号桌点了什么 · 几号桌空着。
 *
 * ── 为什么这一页要存在（2026-09-08）─────────────────────────────────────
 *
 * `seat_table` · `close_table` · `tables_now` · `add_dining_table` ·
 * `update_dining_table`（20260908010000）五支从做出来那天起
 * **画面上一个入口都没有**。而餐饮是八个行业里唯一一个今天用不了这套东西的：
 * 它开局拿到总览 · 客户 · 订单 · 收款 · 官网，而一间茶餐室一整天在问的
 * 那一句「三号桌点了什么」，在这一页之前没有任何地方答得了。
 *
 * ⚠️ 那不是画面那一边的地盘 ——
 * [重点 22e](../../../../../docs/founder-points.md)：
 * **功能地基只接自己那一格的最后一寸**（一个入口 · 一颗按得动的按钮 ·
 * 一个显示得出来的数字），接完就停，不去动那一页的排法跟长相。
 *
 * ── 🔴 伙计也打得开，而且他要打得开 ────────────────────────────────────
 *
 * `tables_now` · `seat_table` 是 `works_here` —— 一间茶餐室里带位、
 * 点菜、清桌的那个人不是老板。只有两样是老板的：
 * **开／关一张桌**（那是店的设定，跟分店同一层，资料库那边是 `sees_money`）
 * 跟**收钱**（`close_table` 收到钱的时候先讲一句人话再挡，
 * 不让伙计读到 `add_ledger_entry` 那句资料库的错）。
 *
 * ── 开台要开在哪一页 ────────────────────────────────────────────────────
 *
 * 一张餐台单**就是一张单**（20260908010000：不另开一张中转单），
 * 所以它要落在这门生意自己那一页走单上 —— 餐饮开局那一页叫 `orders`。
 * 这里不写死那个字：从他自己开过的那几页里挑第一页走单的。
 * 一页走单都没有 → 那一页会讲出来，而不是画一颗按下去必然失败的按钮。
 */

export default async function TablesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;

  const { data: mapRows } = await supabase.rpc("tables_now", {
    in_project_id: workspace.projectId,
  });
  const rows = (mapRows ?? []) as TableRow[];

  /* 开台落在他自己那一页走单上。 */
  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, sort_order")
    .eq("project_id", workspace.projectId)
    .order("sort_order");
  /* 🔴 「他自己第一页走单」不够 —— 第一次开出来的单号是 **QT-2026-0001**，
     一张**报价单**的号码，因为那个帐号的报价单排在订单前面。
     而一张餐台单不是报价：客人已经点了，没有人在跟他报价。
     所以先找订单，找不到才退回第一页走单（而那时候是他自己的判断）。
     ⚠️ 这是用眼睛看那张图才看到的，读数当时全绿。 */
  const pipelineKeys = (pageRows ?? [])
    .map((p) => (p as { page_key: string }).page_key)
    .filter((k) => MODULE_BY_KEY[k]?.shape === "pipeline");
  const pipelineKey =
    pipelineKeys.find((k) => k === "orders") ?? pipelineKeys[0] ?? null;

  /* 关掉的那几张桌只有老板看得到 —— 那是店的设定。 */
  const { data: allRows } = workspace.isOwner
    ? await supabase
        .from("dining_tables")
        .select("id, name, seats, active")
        .eq("project_id", workspace.projectId)
        .order("sort_order")
    : { data: null };

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("tables.title")} subtitle={t("tables.lede")} />
      <PageBody>
        {!pipelineKey ? (
          <DeskCard title={t("tables.title")}>
            <p className={deskDim}>{t("tables.noPipeline")}</p>
          </DeskCard>
        ) : null}
        <TablesDesk
          projectId={workspace.projectId}
          locale={locale}
          isOwner={workspace.isOwner}
          pipelineKey={pipelineKey}
          rows={rows}
          tables={
            (allRows ?? []) as {
              id: string;
              name: string;
              seats: number | null;
              active: boolean;
            }[]
          }
        />
      </PageBody>
    </StyleScope>
  );
}
