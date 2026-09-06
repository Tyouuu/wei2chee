import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { TransferDesk } from "./transfer-desk";

/**
 * 从吉隆坡搬二十包去 Puchong。
 *
 * ── 为什么这一页要存在（2026-09-06）─────────────────────────────────────
 *
 * `transfer_stock` · `transfers_of` · `undo_transfer`（20260906）三支
 * **画面上一个入口都没有** —— [任务 148](#148) 立分店库存的时候自己写着
 * 「**没有调拨**（从 KL 搬 20 包去 Puchong）—— 今天要记一出一进两笔」。
 *
 * 而两笔当然记得了，重点是**那两笔会对不上**：他打了「出 20」，
 * 接一通电话，回来打「进 2」—— 架上从此少了十八包，
 * **而没有任何东西会讲**。一次呼叫两笔，同一个编号串着，
 * 打错只能整个打错，不会打错一半。
 *
 * ── 🔴 这一页的骨架是抄来的 ────────────────────────────────────────────
 *
 * 老板：**「找模板去學習別人的設計啊」**。
 * 照他 9-04 挑的那一套里 **`up-logistics` 那一张运单卡** ——
 * **左边一块「从哪里」、右边一块「到哪里」，中间一条虚线**，
 * 底下一行写着装的是什么跟什么时候到。
 *
 * 一次调拨就是那个形状：**KL ⟶ Puchong · 水泥 50kg · 20 包**。
 * 一串「日期 · 货品 · 数量 · 从 · 到」的表格读得出同样的字，
 * 而**读不出方向** —— 而方向正是这一件唯一会记错的东西。
 *
 * ⚠️ [任务 191](#191) 记着 logistics 那一页给过我们「左清单右详情」；
 * 这一次拿的是**同一页上另一块**（运单卡本身），不是同一样东西再用一次
 * （[重点 7h](../../../../../docs/founder-points.md)）。
 *
 * ── 只有两间店以上才画得出来 ────────────────────────────────────────────
 *
 * 一间店的生意搬不了货 —— 一张「从这里搬到这里」的表单是一个
 * 永远按不下去的按钮。所以这一页在只有一间店的时候讲一句话，不画表单。
 */

type Row = {
  transfer_id: string;
  item_id: string;
  item_name: string;
  qty: number;
  from_branch: string;
  from_name: string;
  to_branch: string;
  to_name: string;
  moved_on: string;
};

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
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

  const [{ data: branchRows }, { data: itemRows }, { data: moveRows }] =
    await Promise.all([
      supabase
        .from("branches")
        .select("id, name, active")
        .eq("project_id", workspace.projectId)
        .order("name"),
      supabase
        .from("catalog_items")
        .select("id, name, unit")
        .eq("project_id", workspace.projectId)
        .is("archived_at", null)
        .order("name"),
      supabase.rpc("transfers_of", { in_project_id: workspace.projectId }),
    ]);

  /* ⚠️ 那一栏叫 `active`，不是 `closed_at` —— 我猜错了一次，
     而 PostgREST 对一个不存在的栏位只回一个 error、**不抛**，
     於是这一页静静地判「一间店都没有」然后 404，
     看起来完全像这一页做坏了。 */
  const branches = (
    (branchRows ?? []) as { id: string; name: string; active: boolean }[]
  )
    .filter((b) => b.active)
    .map((b) => ({ id: b.id, name: b.name }));
  const items = (
    (itemRows ?? []) as { id: string; name: string; unit: string }[]
  ).map((i) => ({ id: i.id, name: i.name, unit: i.unit ?? "" }));
  const rows = (moveRows ?? []) as Row[];

  /* 一间店都没开过的生意根本到不了这一页 —— 侧栏那一行是按分店数画的。
     而**万一到了**，这一页要讲得出为什么什么都没有，不是画一张空表单。 */
  if (branches.length === 0 && rows.length === 0) notFound();

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("transfers.title")} subtitle={t("transfers.lede")} />
      <PageBody>
        {branches.length < 2 ? (
          <DeskCard>
            <p className={deskDim}>{t("transfers.needTwo")}</p>
          </DeskCard>
        ) : items.length === 0 ? (
          <DeskCard>
            <p className={deskDim}>{t("transfers.needItems")}</p>
          </DeskCard>
        ) : (
          <TransferDesk
            branches={branches}
            items={items}
            rows={rows.map((r) => ({
              id: r.transfer_id,
              item: r.item_name,
              qty: Number(r.qty),
              from: r.from_name,
              to: r.to_name,
              on: r.moved_on,
            }))}
            words={{
              formTitle: t("transfers.formTitle"),
              item: t("transfers.item"),
              fromBranch: t("transfers.fromBranch"),
              toBranch: t("transfers.toBranch"),
              qty: t("transfers.qty"),
              note: t("transfers.note"),
              move: t("transfers.move"),
              pastTitle: t("transfers.pastTitle"),
              none: t("transfers.none"),
              undo: t("transfers.undo"),
              sameBranch: t("transfers.sameBranch"),
              saveFailed: t("transfers.saveFailed"),
              shortWarn: t("transfers.shortWarn"),
              moved: t("transfers.moved"),
              formNote: t("transfers.formNote"),
            }}
          />
        )}
      </PageBody>
    </StyleScope>
  );
}
