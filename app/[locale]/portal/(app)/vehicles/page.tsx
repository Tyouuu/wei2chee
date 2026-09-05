import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody, Section } from "../section";
import { PlateSearch } from "./plate-search";

/**
 * 一个车牌，跟它做过的每一件事。
 *
 * ── 为什么这一页要存在（2026-09-05）──────────────────────────────────────
 *
 * `find_vehicle` · `vehicle_history` · `vehicles_overdue`（20260905290000）
 * 从做出来那天就答得出这三句话，而**画面上一个入口都没有** ——
 * [任务 157](../../../../../docs/founder-tasks.md#157) 的收尾自己写着
 * 「柜台打车牌那个框不存在」。
 *
 * 而一间车厂柜台上真正在问的只有一句：
 * **「WA 1234 A —— 上次什么时候来，做了什么，几公里？」**
 *
 * 🔴 而这一行是他第一批客人里最大的一群：`find:prospects` 扫怡保 278 家，
 * **车行 91 · 车厂 30 · 汽车配件 11 = 132 家，将近一半**。
 *
 * ── 这一页只有两半，因为柜台上只有两件事 ────────────────────────────────
 *
 *   ① **查一台车** —— 客人站在面前
 *   ② **好久没来的** —— 没有人站在面前的时候，打电话给谁
 *
 * 第二半按**多久没来**排，不按里程 —— **我们不知道那台车今天几公里**
 * （20260905290000 自己写着这一条），而一份照猜出来的里程排出来的名单，
 * 会让他打一整天没有用的电话。
 *
 * ── ⚠️ 一间没有车的生意 ────────────────────────────────────────────────
 *
 * 这一页对**每一个有员工身分的人**都开得了（`vehicles` 是 `works_here`，
 * 不是 `sees_money` —— 查一台车是柜台的工作，不是钱）。
 * 而一间从来没有登记过车的生意打开它，看到的是一个空的搜索框跟一句话，
 * **不是一张假的清单**。
 */

type Overdue = {
  vehicle_id: string;
  plate: string;
  descr: string;
  owner_name: string;
  owner_whatsapp: string;
  last_seen: string | null;
  months_since: number | null;
  last_odometer_km: number | null;
  due_at_km: number | null;
};

export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
  const [{ data: overdueRows }, { count: fleet }, { data: partyRows }] = await Promise.all([
    supabase.rpc("vehicles_overdue", { in_project_id: workspace.projectId, in_months: 6 }),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("project_id", workspace.projectId)
      .is("archived_at", null),
    /* 车主那一格从**他自己的客户**里挑。⚠️ 只拿客户那一本 ——
       一台车的车主不会是供应商，也不会是他的师傅。 */
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "customers")
      .is("archived_at", null)
      .order("name"),
  ]);

  /* 🔴 读不到跟一台都没有，是两件事。`null` 是「问不到」——
     而把它当成 0 会在这一页上写「一台车都还没有」，
     对一间登记了两百台车的车厂撒谎。 */
  const registered = fleet ?? null;
  const overdue = (overdueRows ?? []) as Overdue[];

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
      <PageBar title={t("vehicles.title")} subtitle={t("vehicles.lede")} />
      <PageBody>
        <Section label={t("vehicles.lookupLabel")}>
          <PlateSearch
            projectId={workspace.projectId}
            locale={locale}
            parties={((partyRows ?? []) as { id: string; name: string | null }[])
              .filter((r) => r.name)
              .map((r) => ({ id: r.id, name: r.name as string }))}
            words={{
              label: t("vehicles.plate"),
              placeholder: t("vehicles.platePlaceholder"),
              search: t("vehicles.search"),
              searching: t("vehicles.searching"),
              none: t("vehicles.notFound"),
              owner: t("vehicles.owner"),
              lastSeen: t("vehicles.lastSeen"),
              lastKm: t("vehicles.lastKm"),
              visits: t("vehicles.visits"),
              dueAt: t("vehicles.dueAt"),
              history: t("vehicles.history"),
              noHistory: t("vehicles.noHistory"),
              failed: t("vehicles.failed"),
              km: t("vehicles.km"),
              register: t("vehicles.register"),
              registering: t("vehicles.registering"),
              what: t("vehicles.what"),
              whatPlaceholder: t("vehicles.whatPlaceholder"),
              everyKm: t("vehicles.everyKm"),
              everyKmHint: t("vehicles.everyKmHint"),
              noOwner: t("vehicles.noOwner"),
              registered: t("vehicles.registered"),
              edit: t("vehicles.edit"),
              editCancel: t("vehicles.editCancel"),
              save: t("vehicles.save"),
              saving: t("vehicles.saving"),
              saved: t("vehicles.saved"),
              archive: t("vehicles.archive"),
            }}
          />
          {registered === 0 && (
            /* 一台都还没有 —— 讲出来，而且讲出第一台是怎么进来的：
               打一个车牌，查不到，就在那里登记。 */
            <p className="mt-5 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {t("vehicles.empty")}
            </p>
          )}
        </Section>

        {overdue.length > 0 && (
          <Section label={t("vehicles.overdueLabel")} count={overdue.length}>
            <p className="mb-4 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {t("vehicles.overdueLede")}
            </p>
            <ul className="flex flex-col">
              {overdue.map((v) => (
                <li
                  key={v.vehicle_id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-3 [border-color:var(--color-ink-800)]"
                >
                  <span className="tabular-nums [font-weight:var(--fw-semibold)] [letter-spacing:0.04em]">
                    {v.plate}
                  </span>
                  {v.descr && (
                    <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {v.descr}
                    </span>
                  )}
                  <span className="min-w-0 flex-1" />
                  {/* 他看完这一行下一件事就是打给车主 —— 所以那个号码
                      就在这一行上，而不是在两次点击之后。 */}
                  {v.owner_whatsapp ? (
                    <a
                      href={`https://wa.me/${v.owner_whatsapp.replace(/[^\d]/g, "")}`}
                      className="[font-size:var(--text-sm)] underline"
                    >
                      {v.owner_name || v.owner_whatsapp}
                    </a>
                  ) : v.owner_name ? (
                    <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {v.owner_name}
                    </span>
                  ) : null}
                  {v.months_since != null && (
                    <span className="tabular-nums [font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
                      {t("vehicles.monthsAgo", { n: v.months_since })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </PageBody>
    </StyleScope>
  );
}
