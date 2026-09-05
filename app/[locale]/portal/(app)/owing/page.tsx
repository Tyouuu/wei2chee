import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { PageBar } from "../page-bar";
import { PageBody, Section } from "../section";

/**
 * 谁欠我钱，欠多久。
 *
 * ── 为什么这一页要存在 ────────────────────────────────────────────────────
 *
 * `party_aging`（20260905140000）从做出来那天就答得出整家公司的账龄分段，
 * 而**画面上一个入口都没有** —— [任务 142] 记着「今天只有助手答得出来」，
 * 也就是他要先想到去问一句话，才知道谁欠他钱。
 *
 * SQL Account 的 `Customer` 那一栏，它自己列的第一个卖点就是账龄
 * （[任务 67]）。一个批发商每天在做的判断是一句话：
 * **「这家还欠我三万，六十天了，今天这一车还出不出？」**
 *
 * ── 🔴 分段是算出来的，不是存起来的 ──────────────────────────────────────
 *
 * 同一笔钱今天 59 天、明天 61 天，而没有人会在半夜去改那一栏。
 * 这一页只是把那支函式画出来 —— 没有第二份算术。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * `party_aging` 自己就是 `sees_money`，所以师傅打这一支拿回来是空的 ——
 * 而**空的会画成「没有人欠你钱」**，对一个挂着三万应收的老板撒谎。
 * 所以这一页对他 404，不是画一张空表。
 */

type Aging = {
  party_id: string;
  current_cents: number;
  d30_cents: number;
  d60_cents: number;
  d90_cents: number;
  older_cents: number;
  total_cents: number;
};

export default async function OwingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  /* 🔴 师傅打不开 —— 见档头。 */
  if (workspace.role !== "owner") notFound();

  const supabase = await createSessionSupabaseClient();
  /* 他自己那一套配色 —— 跟记录页同一个来源。 */
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;
  const [{ data: rows }, { data: parties }] = await Promise.all([
    supabase.rpc("party_aging", { p_project_id: workspace.projectId }),
    supabase
      .from("directory_entries")
      .select("id, name, module_key")
      .eq("project_id", workspace.projectId)
      .is("archived_at", null),
  ]);

  const nameOf = new Map(
    ((parties ?? []) as { id: string; name: string | null; module_key: string }[]).map((p) => [
      p.id,
      { name: p.name ?? "", moduleKey: p.module_key },
    ]),
  );

  /* 欠最多的排前面 —— 他第一眼要看的就是那一个。
     ⚠️ 而「欠最久」是另一个问题，所以最老那两格单独画出来
     （一个欠 RM 300、欠了两年的客户排在最后，而他正是要打电话的那一个）。 */
  const owing = ((rows ?? []) as Aging[])
    .filter((r) => Number(r.total_cents) > 0)
    .sort((a, b) => Number(b.total_cents) - Number(a.total_cents));

  const total = owing.reduce((n, r) => n + Number(r.total_cents), 0);
  const overdue = owing.reduce(
    (n, r) => n + Number(r.d60_cents) + Number(r.d90_cents) + Number(r.older_cents),
    0,
  );

  /* 🔴 **零就留空。** 一行五个「RM 0」是杂讯，而账龄表存在的全部意义
     就是让眼睛落在**不是零**的那一格上。看图才看到的。 */
  const money = (cents: number) => (cents > 0 ? ringgit(cents) : "");
  const cell = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";
  const head = "py-2 pr-3 text-right [font-weight:var(--fw-medium)] whitespace-nowrap";

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
      <PageBar title={t("owing.title")} subtitle={t("owing.lede")} />
      <PageBody>
        <Section label={t("owing.label")} count={owing.length}>
          {owing.length === 0 ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {t("owing.none")}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* 两个数字：一共欠多少，其中过了两个月的有多少。
                  🔴 第二个才是他要打电话的那一笔。 */}
              <div className="flex flex-wrap gap-10">
                <div>
                  <div className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                    {t("owing.total")}
                  </div>
                  <div className="mt-0.5 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums">
                    {ringgit(total)}
                  </div>
                </div>
                {overdue > 0 ? (
                  <div>
                    <div className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {t("owing.overdue")}
                    </div>
                    <div className="mt-0.5 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-clay-bright)]">
                      {ringgit(overdue)}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full [font-size:var(--text-sm)]">
                  <thead>
                    <tr className="text-left text-[color:var(--color-on-canvas-dim)]">
                      <th className="py-2 pr-3 [font-weight:var(--fw-medium)]">{t("owing.who")}</th>
                      <th className={head}>{t("owing.current")}</th>
                      <th className={head}>{t("owing.d30")}</th>
                      <th className={head}>{t("owing.d60")}</th>
                      <th className={head}>{t("owing.d90")}</th>
                      <th className={head}>{t("owing.older")}</th>
                      <th className={head}>{t("owing.rowTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owing.map((r) => {
                      const who = nameOf.get(r.party_id);
                      const late =
                        Number(r.d60_cents) + Number(r.d90_cents) + Number(r.older_cents) > 0;
                      return (
                        <tr
                          key={r.party_id}
                          className="border-t [border-color:var(--color-ink-800)]"
                        >
                          <td className="py-2 pr-3">
                            {/* 点得进那个人 —— 他看完这一行下一件事就是打给他，
                                而电话在那一页上。 */}
                            {who ? (
                              <a
                                href={`/${locale}/portal/${who.moduleKey}/${r.party_id}`}
                                className="underline"
                              >
                                {who.name}
                              </a>
                            ) : (
                              t("owing.unknown")
                            )}
                          </td>
                          <td className={cell}>{money(Number(r.current_cents))}</td>
                          <td className={cell}>{money(Number(r.d30_cents))}</td>
                          <td className={cell}>{money(Number(r.d60_cents))}</td>
                          <td className={cell}>{money(Number(r.d90_cents))}</td>
                          <td className={cell}>{money(Number(r.older_cents))}</td>
                          <td
                            className={`${cell} [font-weight:var(--fw-semibold)] ${
                              late ? "text-[color:var(--color-clay-bright)]" : ""
                            }`}
                          >
                            {ringgit(Number(r.total_cents))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {t("owing.note")}
              </p>
            </div>
          )}
        </Section>
      </PageBody>
    </StyleScope>
  );
}
