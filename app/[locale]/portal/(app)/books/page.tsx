import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";
import { OpeningBook } from "./opening-book";

/**
 * 试算表，跟这一天的位置。
 *
 * ── 为什么这一页要存在（2026-09-05）──────────────────────────────────────
 *
 * `trial_balance` · `financial_position` · `set_opening_balance` ·
 * `set_ledger_account_name` · `ensure_ledger_accounts`（20260905570000 ·
 * 580000）从做出来那天起 **画面上一个入口都没有** ——
 * 而它们的收尾自己就写着「画面上没有那一页」。
 *
 * ── 这一页的排法从哪里来 ────────────────────────────────────────────────
 *
 * 老板 2026-09-05 发了一套 Finexus 的后台素材（Ant Design ＋ Tokens Studio，
 * 105 个版面），讲的是「**满屏数据却没有报表感**」。
 * 拿的是**那一句**，不是它的东西：它是加密货币那一行的，而且是付费素材。
 *
 * 落在这一页上就是三条：
 *   ① **先给答案，再给格子** —— 位置那五个数字在最上面，试算表在底下
 *   ② **平不平是一句话，不是一行** —— 那是他看这一页唯一要确认的事
 *   ③ **零留空** —— 一张八行都写着 RM 0 的表是杂讯，而这一页存在的
 *      全部意义就是让眼睛落在不是零的那几格上（`owing` 那一页学到的同一条）
 *
 * ── 🔴 它是**收付实现制**的，而这一句一定要印在画面上 ─────────────────
 *
 * 权责发生制要回答一个我们**故意不替他决定**的问题：一张单什么时候算收入。
 * 那叫收入认列，是一个会计政策不是一条公式（20260905570000 的档头）。
 * 所以应收跟应付是**两个备忘**，摆在试算表外面 ——
 * 混进去就变成一份**看起来像、其实不是**的东西。
 *
 * ── 只有老板 ────────────────────────────────────────────────────────────
 *
 * 那几支自己就是 `sees_money`，师傅打回来是**抛错**不是空的。
 * 所以这一页对他 404 —— 一条通往错误页的连结比没有连结糟。
 */

type Row = {
  code: string;
  name: string;
  kind: string;
  debit_cents: number;
  credit_cents: number;
};

type Position = {
  as_of: string;
  cash_cents: number;
  receivable_cents: number;
  payable_cents: number;
  deposits_cents: number;
  inventory_cents: number;
  inventory_known: boolean;
  items_without_cost: number;
};

export default async function BooksPage() {
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
  /* 八个科目要先在，不然第一次打开这一页是空的 —— 而它是幂等的。 */
  await supabase.rpc("ensure_ledger_accounts", { in_project_id: workspace.projectId });

  const [{ data: tbRows }, { data: posRows }, { data: accRows }, { data: openRows }] =
    await Promise.all([
      supabase.rpc("trial_balance", { in_project_id: workspace.projectId }),
      supabase.rpc("financial_position", { in_project_id: workspace.projectId }),
      supabase
        .from("ledger_accounts")
        .select("code, name, kind, sort_order")
        .eq("project_id", workspace.projectId)
        .order("sort_order"),
      supabase
        .from("opening_balances")
        .select("code, amount_cents, as_on")
        .eq("project_id", workspace.projectId),
    ]);

  const rows = (tbRows ?? []) as Row[];
  const pos = ((posRows ?? []) as Position[])[0] ?? null;

  const debit = rows.reduce((n, r) => n + Number(r.debit_cents), 0);
  const credit = rows.reduce((n, r) => n + Number(r.credit_cents), 0);
  const gap = debit - credit;

  const openingBy = new Map(
    ((openRows ?? []) as { code: string; amount_cents: number; as_on: string }[]).map((o) => [
      o.code,
      o,
    ]),
  );
  /* 🔴 **只有这五个开得了帐**（`opening_balances.code` 那条约束）——
     收入 · 费用 · 开帐权益不开帐：收入费用是一段期间发生的事，
     权益是另外四个算出来的结果。

     而我第一版把八个都画了出去 —— 于是「Opening」「Money in」「Money out」
     三行各带一颗**永远存不进去的 Save**。尺子全绿，一张图就看到了。 */
  const OPENABLE = new Set(["cash", "receivable", "inventory", "payable", "deposits"]);
  const accounts = ((accRows ?? []) as { code: string; name: string; kind: string }[])
    .filter((a) => OPENABLE.has(a.code))
    .map((a) => ({
    code: a.code,
    name: a.name,
    kind: a.kind,
    opening_cents: openingBy.get(a.code)?.amount_cents ?? null,
    opening_as_on: openingBy.get(a.code)?.as_on ?? null,
  }));

  /* `ringgit` 拿不到数字的时候回 undefined —— 而这一页每一格都要有字。 */
  const rm = (cents: number) => ringgit(cents) ?? "RM 0";
  /* 🔴 零就留空 —— 见档头 ③。 */
  const money = (cents: number) => (cents > 0 ? rm(cents) : "");
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
      <PageBar title={t("books.title")} subtitle={t("books.lede")} />
      <PageBody>
        {pos && (
          /* 🔴 **一个矩形切成格，不是五个数字浮在留白上。**

             老板：「我不要一直都是相同的组件」。而这五个数字是**一组**
             （它们加起来就是这一天的位置），所以它们该住在同一个框里 ——
             骨架抄的是他挑的那一套的 `finance`（[任务 193] 拿过同一个）。 */
          <DeskCard title={t("books.positionLabel")}>
            <div className="grid divide-y [border-radius:var(--radius-md)] [border:var(--hairline)_solid_var(--color-ink-800)] [divide-color:var(--color-ink-800)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
              <Cell label={t("books.cash")} value={rm(Number(pos.cash_cents))} lead />
              <Cell label={t("books.receivable")} value={rm(Number(pos.receivable_cents))} />
              <Cell label={t("books.payable")} value={rm(Number(pos.payable_cents))} />
              <Cell label={t("books.deposits")} value={rm(Number(pos.deposits_cents))} />
              {/* 🔴 少一件货的成本，整个存货就算不出来 —— 而**偷偷当成 0**
                  就是一份看起来没问题的资产负债表。讲出来差几件。 */}
              <Cell
                label={t("books.inventory")}
                value={
                  pos.inventory_known
                    ? rm(Number(pos.inventory_cents))
                    : t("books.inventoryUnknown", { n: pos.items_without_cost })
                }
                muted={!pos.inventory_known}
              />
            </div>
            <p className={`mt-4 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]`}>
              {t("books.asOf", { date: pos.as_of })} · {t("books.cashBasis")}
            </p>
          </DeskCard>
        )}

        <div className="h-5" />

        <DeskCard title={t("books.trialLabel")}>
          {/* ② 平不平是一句话。他看这一页唯一要确认的就是它，
              而一行「合计」要他自己去比两个数字。 */}
          <p
            className={`mb-5 [font-size:var(--text-base)] ${
              gap === 0 ? "" : "text-[color:var(--color-clay-bright)]"
            }`}
          >
            {gap === 0
              ? t("books.balances", { total: rm(debit) })
              : t("books.outBy", { amount: rm(Math.abs(gap)) })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full [font-size:var(--text-sm)]">
              <thead>
                <tr className="text-left text-[color:var(--color-on-canvas-dim)]">
                  <th className="py-2 pr-3 [font-weight:var(--fw-medium)]">{t("books.account")}</th>
                  <th className={head}>{t("books.debit")}</th>
                  <th className={head}>{t("books.credit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-t [border-color:var(--color-ink-800)]">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className={cell}>{money(Number(r.debit_cents))}</td>
                    <td className={cell}>{money(Number(r.credit_cents))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 [border-color:var(--color-ink-700)]">
                  <td className="py-2 pr-3 [font-weight:var(--fw-semibold)]">{t("books.total")}</td>
                  <td className={`${cell} [font-weight:var(--fw-semibold)]`}>{rm(debit)}</td>
                  <td className={`${cell} [font-weight:var(--fw-semibold)]`}>{rm(credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-5 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {t("books.notAccrual")}
          </p>
        </DeskCard>

        <div className="h-5" />

        <DeskCard title={t("books.openingLabel")}>
          <p className="mb-5 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {t("books.openingLede")}
          </p>
          <OpeningBook
            projectId={workspace.projectId}
            accounts={accounts}
            words={{
              name: t("books.accountName"),
              amount: t("books.openingAmount"),
              asOn: t("books.openingAsOn"),
              save: t("books.save"),
              saving: t("books.saving"),
              saved: t("books.saved"),
              failed: t("books.failed"),
              future: t("books.future"),
              negative: t("books.negative"),
              noDate: t("books.noDate"),
            }}
          />
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}

/** 那个矩形里的一格。
 *
 *  ⚠️ **不要用 `--text-hero`** —— 在这个壳里它解析成官网第一屏那个
 *  `clamp(2.75rem, 7.4vw, 5rem)`（44–80px），不是风格档里那个 38px。
 *  一个数字在工作台上长到 80px，那不是层次，那是一张海报。
 *
 *  ⚠️ 而三种大小是**挑出来的一个 class**，不是接起来的三段 ——
 *  同一个元素上两个 arbitrary 字级，赢的是**档案里后面那一条**，
 *  不是字串里后面那一个（`w-full` 赢 `w-[110px]` 那次学的）。 */
function Cell({
  label,
  value,
  lead,
  muted,
}: {
  label: string;
  value: string;
  lead?: boolean;
  muted?: boolean;
}) {
  const size = muted
    ? "[font-size:var(--text-base)] [font-weight:var(--fw-regular)] text-[color:var(--color-on-canvas-dim)]"
    : lead
      ? "[font-size:var(--text-stat)] [font-weight:var(--fw-semibold)]"
      : "[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]";
  return (
    <div className="p-4">
      <div className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {label}
      </div>
      <div className={`mt-0.5 tabular-nums ${size}`}>{value}</div>
    </div>
  );
}
