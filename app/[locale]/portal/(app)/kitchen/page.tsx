import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { KitchenDesk, type QueueRow } from "./kitchen-desk";

/**
 * 厨房还有什么没出。
 *
 * ── 为什么这一页要存在（2026-09-08）─────────────────────────────────────
 *
 * `kitchen_queue` · `serve_line`（20260908040000）做出来那天起
 * **画面上一个入口都没有**。而它答的是一间茶餐室一整天在问的第二句。
 *
 * ── 🔴 一分钱都没有 ─────────────────────────────────────────────────────
 *
 * `kitchen_queue` 一栏金额都不回 —— 厨房不需要知道那一碟卖多少。
 * 所以这一页是 `works_here`：炒粉那个人打得开，而他在这一页上
 * 读不到这门生意的任何一个数字。
 *
 * ── 🔴 出菜是一个数字，不是一个勾 ───────────────────────────────────────
 *
 * 三碟粿条出了一碟，剩两碟 —— 一个勾答不了那一句。
 * 那是 frappe/hospitality 那张表上唯一真正值钱的一栏（`served`），
 * 也是这一页每一行右边那两颗按钮的全部理由：**出一碟** 跟 **全出**。
 *
 * ── 「几个钟头以内」是一个参数，不是一条结帐规矩 ──────────────────────
 *
 * 一个厨房的屏只看今天。少了它，一碟三个星期前忘了出的菜会永远挂在上面，
 * 然后整块屏没有人看 —— 跟一把天天叫狼的尺同一件事。
 */

export default async function KitchenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  void locale;
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

  const { data } = await supabase.rpc("kitchen_queue", {
    in_project_id: workspace.projectId,
  });
  const rows = (data ?? []) as QueueRow[];

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("kitchen.title")} subtitle={t("kitchen.lede")} />
      <PageBody>
        <DeskCard
          title={
            rows.length === 0
              ? t("kitchen.queueTitle")
              : /* 🔴 数的是**几碟**，不是几行。第一版写着「2 still to come out」
                   而画面上是三碟（两碟粿条 ＋ 一杯咖啡）—— 厨房问的是
                   「我还要煮几碟」，不是「屏上有几行」。 */
                t("kitchen.queueTitleN", {
                  n: rows.reduce((s, r) => s + Number(r.still_due), 0),
                })
          }
        >
          {rows.length === 0 ? (
            <p className={deskDim}>{t("kitchen.none")}</p>
          ) : (
            <KitchenDesk rows={rows} />
          )}
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}
