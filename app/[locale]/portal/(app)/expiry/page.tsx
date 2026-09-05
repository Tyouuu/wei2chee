import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { ShelfLife } from "./shelf-life";

/**
 * 什么快过期了 —— 批号跟效期。
 *
 * ── 为什么这一页要存在（2026-09-06）──────────────────────────────────────
 *
 * `expiring_soon` · `add_stock_batch` · `batches_of`（20260905320000）
 * 从做出来那天起 **画面上一个入口都没有**，而
 * [任务 160](../../../../../docs/founder-tasks.md#160) 的收尾自己写着
 * 「画面上没有那一页 —— 「什么快过期了」那一屏是画面那一层」。
 *
 * 对药行 · 美容 · 食品，**一盒过期的货卖出去不是少一个功能，是一件会出事的事**。
 * 而老板真正在问的只有一句：**「什么快过期了？」**
 *
 * ── 先给答案，再给格子 ──────────────────────────────────────────────────
 *
 * 所以「快过期的」在最上面，「一批货进来了」在底下 ——
 * 他打开这一页十次有九次是要看第一段。
 *
 * ── ⚠️ 一间不管效期的生意 ──────────────────────────────────────────────
 *
 * 绝大多数五金店没有批号。这一页对他们是**一句话加一个空的清单**，
 * 而不是一张假的表 —— 而侧栏上那一行也**按有没有资料画**，
 * 所以他根本不会看到它（见 portal-shell）。
 *
 * `catalog_items` 是 `works_here`（去架上拿货的是师傅），所以这一页不挡师傅。
 */

type Expiring = {
  batch_id: string;
  item_id: string;
  item_name: string;
  code: string;
  expiry_on: string | null;
  days_left: number | null;
  on_hand: number;
  unit: string;
  location: string;
};

export default async function ExpiryPage() {
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  /* 他自己那一套配色 —— 跟记录页同一个来源。 */
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;
  const [{ data: soonRows }, { data: itemRows }] = await Promise.all([
    supabase.rpc("expiring_soon", { in_project_id: workspace.projectId, in_days: 90 }),
    supabase
      .from("catalog_items")
      .select("id, name, unit")
      .eq("project_id", workspace.projectId)
      .is("archived_at", null)
      .order("name"),
  ]);

  /* 🔴 **这一页穿的是他的系统，不是 Formae 的壳。**

     老板 2026-09-06 看着薪水那一页：
     「不是這個黑色的那個白色的啊 我們的system的Ui啊」—— 他对了。
     **深色是 Formae 的建造工具，浅色是他的系统**，
     而这一页是他每天拿来跑生意的，跟报价单那几页是同一件事。

     ⚠️ **连 `PageBar` 一起包进去** —— 只包内容会变成
     一条深色的横梁配一张白纸，那比两边都深色更像坏了。

     ⚠️ class 字串一个字都不用改：同一批 token 名字在两边都在，
     只是在 scope 里面解析成浅色那一套。 */
  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("expiry.title")} subtitle={t("expiry.lede")} />
      <PageBody>
        <ShelfLife
          soon={(soonRows ?? []) as Expiring[]}
          items={((itemRows ?? []) as { id: string; name: string; unit: string }[]).map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
          }))}
          words={{
            soonLabel: t("expiry.soonLabel"),
            soonLede: t("expiry.soonLede"),
            soonNone: t("expiry.soonNone"),
            gone: t("expiry.gone"),
            daysLeft: t("expiry.daysLeft"),
            left: t("expiry.left"),
            batchesLabel: t("expiry.batchesLabel"),
            batchesLede: t("expiry.batchesLede"),
            noItems: t("expiry.noItems"),
            item: t("expiry.item"),
            code: t("expiry.code"),
            codePlaceholder: t("expiry.codePlaceholder"),
            expiryOn: t("expiry.expiryOn"),
            receivedOn: t("expiry.receivedOn"),
            add: t("expiry.add"),
            adding: t("expiry.adding"),
            added: t("expiry.added"),
            failed: t("expiry.failed"),
            needCode: t("expiry.needCode"),
            itsBatches: t("expiry.itsBatches"),
            noBatches: t("expiry.noBatches"),
            onHand: t("expiry.onHand"),
            noExpiry: t("expiry.noExpiry"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
