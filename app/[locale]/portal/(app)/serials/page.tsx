import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";
import { SerialSearch } from "./serial-search";
import { TrackedItems } from "./tracked-items";

/**
 * 一台一台管的那几件货 —— 一个号码查得到它走过的路。
 *
 * ── 为什么这一页要存在（2026-09-07）──────────────────────────────────────
 *
 * `serial_history` · `set_item_serial_tracking`（20260906100000）从做出来那天
 * 就答得出这两件事，而**画面上一个入口都没有**
 * （[任务 252](../../../../../docs/founder-tasks.md#252) 数的 24 支之二）。
 *
 * 🔴 而它服务的是他自己那份名单上最大的一群：
 * [任务 181](#181) 拿 `find:prospects` 扫怡保 262 家数过 ——
 * **车行 90 ＋ 电器 19 ＋ 手机店 13 = 122 家，47%**，
 * 而**车行是排第一的行业**。一间二手车行的整个库存就是序号。
 *
 * ── 这一页只有两半 ────────────────────────────────────────────────────────
 *
 *   ① **查一个号码** —— 客人站在面前，或者他手上拿着一张过户文件
 *   ② **哪几件货是一台一台管的** —— 一件货身上一个开关，预设是关的
 *
 * ⚠️ 第二半故意排在下面而且默认收着：他多半是来查一个号码的，
 * 而一份货架清单摆在他要打字的那个框上面，是把设定挡在动作前面。
 *
 * ── ⚠️ 一间从来没有开过序号的生意 ─────────────────────────────────────────
 *
 * 打开它看到的是一个空的搜索框跟一句话，**不是一张假的清单**。
 * 而查不到的时候那一段登记**只在已经有货开了序号的时候才画** ——
 * 一件都没有的时候他要做的是先去把某一件货打开。
 */

export default async function SerialsPage() {
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

  const { data: itemRows } = await supabase
    .from("catalog_items")
    .select("id, name, unit, tracks_serial")
    .eq("project_id", workspace.projectId)
    .is("archived_at", null)
    .order("name");
  const rows = (itemRows ?? []) as {
    id: string;
    name: string | null;
    unit: string | null;
    tracks_serial: boolean | null;
  }[];

  /* 已经登记了几台。⚠️ **只问开着的那几件** —— 一件没开序号的货身上
     那个数字没有意义，而问它只是多几次往返。 */
  const tracked = rows.filter((r) => r.tracks_serial);
  const counts = new Map<string, number>();
  if (tracked.length) {
    const { data: batchRows } = await supabase
      .from("stock_batches")
      .select("item_id")
      .in(
        "item_id",
        tracked.map((r) => r.id),
      );
    for (const b of (batchRows ?? []) as { item_id: string }[]) {
      counts.set(b.item_id, (counts.get(b.item_id) ?? 0) + 1);
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    unit: r.unit,
    tracks: Boolean(r.tracks_serial),
    units: counts.get(r.id) ?? 0,
  }));

  /* 🔴 **这一页穿的是他的系统，不是 Formae 的壳** ——
     深色是建造工具，浅色是他每天拿来跑生意的东西。
     ⚠️ 连 `PageBar` 一起包进去：只包内容会变成一条深色的横梁配一张白纸。 */
  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("serials.title")} subtitle={t("serials.lede")} />
      <PageBody>
        <DeskCard title={t("serials.lookupLabel")}>
          <SerialSearch
            projectId={workspace.projectId}
            items={items.filter((i) => i.tracks).map((i) => ({ id: i.id, name: i.name }))}
            words={{
              code: t("serials.code"),
              codePlaceholder: t("serials.codePlaceholder"),
              search: t("serials.search"),
              searching: t("serials.searching"),
              notFound: t("serials.notFound"),
              inStock: t("serials.inStock"),
              gone: t("serials.gone"),
              cost: t("serials.cost"),
              cameIn: t("serials.cameIn"),
              wentOut: t("serials.wentOut"),
              noMoves: t("serials.noMoves"),
              registerTitle: t("serials.registerTitle"),
              whichItem: t("serials.whichItem"),
              register: t("serials.register"),
              registering: t("serials.registering"),
              noneTracked: t("serials.noneTracked"),
            }}
          />
        </DeskCard>

        <DeskCard title={t("serials.trackedLabel")}>
          <p className="mb-4 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {t("serials.trackedLede")}
          </p>
          <TrackedItems
            items={items}
            words={{
              unitsOn: t("serials.unitsOn"),
              turnOff: t("serials.turnOff"),
              turnOn: t("serials.turnOn"),
              turnOnLede: t("serials.turnOnLede"),
              noneOn: t("serials.noneOn"),
              showAll: t("serials.showAll"),
            }}
          />
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}
