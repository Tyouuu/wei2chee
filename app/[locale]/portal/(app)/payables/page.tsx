import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";

/**
 * 买的那一边 —— 我欠谁多少，跟哪几张单对不上。
 *
 * ── 为什么这两件在同一页（2026-09-06）───────────────────────────────────
 *
 * 老板：**「還是有畫面沒接到 你去接一下」**。
 * `party_payables`（任务 209）跟 `purchase_mismatches`（任务 149）
 * 两支从做出来那天起**画面上一个入口都没有** —— 两条的收尾自己就写着这句。
 *
 * 它们是**同一个动作的两半**：他坐下来处理「买东西那一边」的时候问两句 ——
 * **「这个月要付哪几家」**、**「哪一张单我付了而货没到」**。
 * 分成两页，等於要他记得开第二个地方。
 *
 * ── 🔴 这一页的骨架是抄来的，不是我自己想的（2026-09-06）──────────────
 *
 * 老板：**「找模板去學習別人的設計啊」**。而他讲得对 ——
 * 我第一版把它画成「两张卡叠起来，上面那张装一串带左边线的行」，
 * 那是我自己顺手的形状，不是从任何一页参考来的。
 *
 * 照他 9-04 挑的那一套（arhamkhnz）里两页，**一页拿一样，两样不重叠**
 * （[重点 7h](../../../../../docs/founder-points.md)：一个来源留一点、写下落点）：
 *
 *   **`up-infrastructure` → 顶上那一排摘要药丸**
 *     他们是「6 Projects · 16 Environments · 36 Servers · 99.93% Uptime」——
 *     一行细边的小药丸，讲的是这一页的规模，不是任何一行的内容。
 *     [任务 195] 自己写着这一样「他们有，我们没有」，然后一直没拿。
 *
 *   **`up-patient` → 那一条警报带**
 *     他们把一件要人当场处理的事做成**一整条有色的带子**：
 *     一句话讲发生什么、底下一行小字讲细节、**右边一颗按钮**。
 *     一张对不上的进货单就是这个 —— 它不是清单里的一行，
 *     它是一件他今天要去做的事。
 *
 * ⚠️ **两样都不是「换个颜色」**：药丸是这一页多出来的一层（规模），
 * 警报带是把一串行换成一条**带动作的**带子。而底下那张欠款清单
 * 照旧是清单 —— 一家欠多少不是警报，硬做成警报就是天天叫狼。
 *
 * ── 🔴 对不上那一份不列对得上的 ──────────────────────────────────────────
 *
 * `purchase_mismatches` 本来就只回有问题的那几张（任务 149 写的理由：
 * 一份每次都印全部的清单没有人看）。所以**没有东西的时候一条带子都不画**，
 * 不是画一条写着「都对得上」的绿带。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * 两支都是 `sees_money`，师傅打回来是空的 —— 而**空的会画成「你不欠人家钱」**，
 * 对一个挂着三万应付的老板撒谎。所以这一页对他 404，跟「谁欠我钱」同一条。
 */

type Payable = {
  party_id: string;
  ordered_cents: number;
  paid_cents: number;
  owed_cents: number;
  open_docs: number;
  oldest_days: number;
};

type Mismatch = {
  record_id: string;
  doc_no: string | null;
  party: string | null;
  ordered_cents: number;
  paid_cents: number;
  arrived: boolean;
  problem: string;
};

export default async function PayablesPage({
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
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;

  const [{ data: owedRows }, { data: badRows }, { data: parties }] =
    await Promise.all([
      supabase.rpc("party_payables", { in_project_id: workspace.projectId }),
      supabase.rpc("purchase_mismatches", {
        in_project_id: workspace.projectId,
      }),
      supabase
        .from("directory_entries")
        .select("id, name, module_key")
        .eq("project_id", workspace.projectId)
        .is("archived_at", null),
    ]);

  const nameOf = new Map(
    (
      (parties ?? []) as {
        id: string;
        name: string | null;
        module_key: string;
      }[]
    ).map((p) => [p.id, { name: p.name ?? "", moduleKey: p.module_key }]),
  );

  /* 欠最多的排前面 —— 他第一眼要看的就是那一个。 */
  const owed = ((owedRows ?? []) as Payable[])
    .filter((r) => Number(r.owed_cents) > 0)
    .sort((a, b) => Number(b.owed_cents) - Number(a.owed_cents));
  const bad = (badRows ?? []) as Mismatch[];

  const total = owed.reduce((n, r) => n + Number(r.owed_cents), 0);
  const oldest = owed.reduce((n, r) => Math.max(n, Number(r.oldest_days)), 0);

  /* 三种问题各自的说法。
     ⚠️ **顺序不在这里排** —— `purchase_mismatches` 已经按「他会赔钱的顺序」
     排好了（付多了 · 钱付了货没到 · 货到了钱没付）。在这里再排一次，
     就是同一个问题两个答案。 */
  const problemWord: Record<string, string> = {
    overpaid: t("payables.overpaid"),
    paid_not_arrived: t("payables.paidNotArrived"),
    arrived_not_paid: t("payables.arrivedNotPaid"),
  };
  /* 前两种是他会赔钱的（红），第三种只是还没付（琥珀）。 */
  const costly = (p: string) => p === "overpaid" || p === "paid_not_arrived";

  /* 一排摘要药丸 ← `up-infrastructure`。
     ⚠️ **零的那几颗不画** —— 一颗写着「0 张对不上」的药丸是杂讯，
     而这一排存在的意义是让眼睛落在不是零的那一颗上（跟「谁欠我钱」
     那一条账龄带同一条规矩）。 */
  const pills: string[] = [];
  if (owed.length)
    pills.push(t("payables.pillOwed", { amount: ringgit(total) ?? "" }));
  if (owed.length) pills.push(t("payables.pillParties", { n: owed.length }));
  if (oldest > 0) pills.push(t("payables.pillOldest", { n: oldest }));
  if (bad.length) pills.push(t("payables.pillBad", { n: bad.length }));

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("payables.title")} subtitle={t("payables.lede")} />
      <PageBody>
        {pills.length > 0 && (
          <ul className="mb-5 flex flex-wrap gap-2">
            {pills.map((p) => (
              <li
                key={p}
                className={`inline-flex items-center gap-2 [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:999px] px-3 py-1.5 ${deskDim}`}
              >
                {p}
              </li>
            ))}
          </ul>
        )}

        {/* 🔴 警报带排在**上面** ← `up-patient`。
            欠多少是一个数字；对不上是一件他今天要去做的事，
            而一件要做的事该长成一条带着按钮的带子，不是清单里的一行。 */}
        {bad.length > 0 && (
          <div className="mb-5 flex flex-col gap-3" data-payables="alarms">
            {bad.map((r) => {
              const hot = costly(r.problem);
              const hue = hot
                ? "var(--color-clay-bright)"
                : "var(--color-brass-bright)";
              return (
                <div
                  key={r.record_id}
                  data-payables="alarm"
                  className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 [border-radius:var(--radius-md)] px-5 py-4"
                  style={{
                    /* 一层很淡的同色底 —— 参考那一条是整条填满的，
                       而他们那一页是深色底；在白纸上照抄会变成一块刺眼的色。
                       用 `color-mix` 而不是写死一个 hex：换一套风格
                       这条带子跟着那一套自己的红走。 */
                    backgroundColor: `color-mix(in oklab, ${hue} 9%, var(--color-ink-900))`,
                    boxShadow: `inset 3px 0 0 ${hue}`,
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)]"
                      style={{ color: hue }}
                    >
                      {problemWord[r.problem] ?? r.problem}
                    </p>
                    <p className={`mt-0.5 ${deskDim}`}>
                      {r.doc_no ?? t("payables.noDocNo")}
                      {r.party ? ` · ${r.party}` : ""}
                      {" · "}
                      {t("payables.orderedPaid", {
                        ordered: ringgit(Number(r.ordered_cents)) ?? "",
                        paid: ringgit(Number(r.paid_cents)) ?? "",
                      })}
                    </p>
                  </div>
                  {/* 参考那一条右边是「Acknowledge」。我们没有「知道了」这个动作 ——
                      对不上是从单据算出来的，按一下不会让它变成对得上。
                      所以那一颗是**去那张单**：他真正的下一步。 */}
                  <a
                    href={`/${locale}/portal/purchases/${r.record_id}`}
                    className="inline-flex min-h-11 shrink-0 items-center [border:var(--hairline)_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*1.2)]"
                  >
                    {t("payables.openIt")}
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* 只有一张卡的时候不给抬头 —— 横梁上已经写着它是什么。 */}
        <DeskCard>
          {owed.length === 0 ? (
            <p className={deskDim}>{t("payables.none")}</p>
          ) : (
            <div className="flex flex-col gap-6" data-payables="owed">
              <div>
                <div className={deskDim}>{t("payables.total")}</div>
                <div className="mt-0.5 tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)]">
                  {ringgit(total)}
                </div>
              </div>

              <ul className="flex flex-col">
                {owed.map((r) => {
                  const who = nameOf.get(r.party_id);
                  const old = Number(r.oldest_days);
                  return (
                    <li
                      key={r.party_id}
                      className="grid gap-1 border-t py-4 [border-color:var(--color-ink-800)]"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        {/* 点得进那一家 —— 他看完这一行下一件事就是付钱或者打电话。 */}
                        {who ? (
                          <a
                            href={`/${locale}/portal/${who.moduleKey}/${r.party_id}`}
                            className="[font-weight:var(--fw-medium)] underline"
                          >
                            {who.name}
                          </a>
                        ) : (
                          <span>{t("payables.unknown")}</span>
                        )}
                        <span className="tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                          {ringgit(Number(r.owed_cents))}
                        </span>
                      </div>
                      <div className={deskDim}>
                        {t("payables.rowNote", {
                          docs: Number(r.open_docs),
                          ordered: ringgit(Number(r.ordered_cents)) ?? "",
                          paid: ringgit(Number(r.paid_cents)) ?? "",
                        })}
                        {/* ⚠️ 天数从**开单那一天**算，不是从「几时要付」——
                            进货单的 `due_on` 是**预计到货**，拿它当账龄起点
                            算出来是「这批货晚到几天」（任务 209）。 */}
                        {old > 0
                          ? ` · ${t("payables.oldest", { n: old })}`
                          : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className={deskDim}>{t("payables.note")}</p>
            </div>
          )}
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}
