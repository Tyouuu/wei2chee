import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { PayDesk } from "./pay-desk";

/**
 * 这个月发多少 —— 底薪 · 公积金 · 社险 · 所得税预扣。
 *
 * ── 为什么这一页要存在（2026-09-06）──────────────────────────────────────
 *
 * `open_pay_run` · `set_payslip_earnings` · `pay_pay_run` · `discard_pay_run`
 * · `set_staff_pay_terms`（20260904220000 · 230000）从做出来那天起
 * **画面上一个入口都没有**。
 *
 * ── 三段，而顺序就是他一个月做那件事的顺序 ──────────────────────────────
 *
 *   ① **这一次的薪水** —— 开着的那一张，每个人一行，改得动
 *   ② **发出去**（或者丢掉）—— 发出去之后整张锁住
 *   ③ **每个人的底薪** —— 一年动一两次的东西，所以排最后
 *
 * 🔴 **他一个字都不用算。** 公积金 · 社险 · 就业保险是
 * `recompute_payslip_statutory` 照那几张**法律表**算的，而那几张表是
 * **资料不是代码**（20260904210000）—— 没有人核对过的表发不出薪水。
 *
 * ── ⚠️ 两支故意不给他 ───────────────────────────────────────────────────
 *
 * `upsert_statutory_schedule` · `confirm_statutory_schedule` 是
 * **`is_founder()`** —— 那是我们维护那几张法律表的地方，不是他的。
 * 它们的家在 `/console`，不在这一页。
 *
 * ── 只有老板 ────────────────────────────────────────────────────────────
 *
 * 薪水是这家公司最敏感的一张表：一个师傅从这一页读得到每一个同事拿多少。
 * `pay_runs` · `payslips` · `staff_pay_terms` 三张都是 `sees_money`，
 * 所以这一页对师傅 404 —— 一条通往错误页的连结比没有连结糟。
 */

type Slip = {
  id: string;
  staff_id: string;
  gross_cents: number;
  deduction_cents: number;
  employer_cents: number;
  net_cents: number;
};

type Run = {
  id: string;
  period_from: string;
  period_to: string;
  paid_at: string | null;
};

/** 这个月的第一天到最后一天 —— 他开薪水的窗口十次有九次就是它。 */
function thisMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`,
  };
}

export default async function PayrollPage() {
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

  /* 开着的那一张（还没发出去的），最近一张。⚠️ 已经发出去的不拉进来 ——
     这一页是「这个月要发多少」，不是一本薪水的历史。 */
  const { data: runRows } = await supabase
    .from("pay_runs")
    .select("id, period_from, period_to, paid_at")
    .eq("project_id", workspace.projectId)
    .is("paid_at", null)
    .order("period_from", { ascending: false })
    .limit(1);
  const run = ((runRows ?? []) as Run[])[0] ?? null;

  /* 🔴 **那几张法律表是资料，不是代码**（20260904210000）。
     没有人核对过就算不出公积金跟社险 —— 而一张没有法定扣款的
     薪资单，跟一张算出来刚好是零的薪资单，**在画面上长得一模一样**。
     所以这一页要讲出来，而且讲清楚那是**我们**要去做的一件事。

     ⚠️ 而那几个「类别」（EPF Part A/C/E · SOCSO 第一/二类）
     **从表里读，不在这里再手写一份** ——
     第二份手写名单是这个仓库栽过八次的那件事。 */
  const { data: lawRows } = await supabase
    .from("statutory_schedules")
    .select("scheme, part, effective_from, effective_to, confirmed_at")
    .not("confirmed_at", "is", null)
    .order("scheme");

  const [{ data: slipRows }, { data: staffRows }, { data: termRows }] =
    await Promise.all([
      run
        ? supabase
            .from("payslips")
            .select(
              "id, staff_id, gross_cents, deduction_cents, employer_cents, net_cents",
            )
            .eq("run_id", run.id)
        : Promise.resolve({ data: [] as Slip[] }),
      supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", workspace.projectId)
        .eq("module_key", "staff")
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("staff_pay_terms")
        .select("staff_id, basis, rate_cents, epf_part, socso_part, eis_part")
        .eq("project_id", workspace.projectId),
    ]);

  /* 今天还在生效的那几份，按计划分好。 */
  const today = new Date().toISOString().slice(0, 10);
  const law: Record<string, string[]> = {};
  for (const r of (lawRows ?? []) as {
    scheme: string;
    part: string;
    effective_from: string;
    effective_to: string | null;
  }[]) {
    if (r.effective_from > today) continue;
    if (r.effective_to && r.effective_to < today) continue;
    (law[r.scheme] ??= []).push(r.part);
  }
  const lawReady = Object.keys(law).length > 0;

  /* 一张开着的薪水单上，每一行是「哪一个人 × 他这次的几笔收入」。
     行的顺序跟着人走，所以这里先把名字接上去 —— 一张只有编号的薪水表
     读不出是谁。 */
  const nameById = new Map(
    ((staffRows ?? []) as { id: string; name: string | null }[]).map((s) => [
      s.id,
      s.name ?? "",
    ]),
  );

  const slips = ((slipRows ?? []) as Slip[]).map((s) => ({
    ...s,
    name: nameById.get(s.staff_id) ?? "",
  }));

  /* 每一张单自己那几笔收入 —— 只拿人打的那几笔（`schedule_id is null`），
     法定那几笔是算出来的，不给改。 */
  const slipIds = slips.map((s) => s.id);
  const { data: lineRows } = slipIds.length
    ? await supabase
        .from("payslip_lines")
        .select(
          "payslip_id, kind, label, amount_cents, schedule_id, sort_order",
        )
        .in("payslip_id", slipIds)
        .order("sort_order")
    : { data: [] };

  type Line = {
    payslip_id: string;
    kind: string;
    label: string;
    amount_cents: number;
    schedule_id: string | null;
  };
  const lines = (lineRows ?? []) as Line[];

  const month = thisMonth();

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
      <PageBar title={t("payroll.title")} subtitle={t("payroll.lede")} />
      <PageBody>
        <PayDesk
          projectId={workspace.projectId}
          run={run}
          suggested={month}
          slips={slips.map((s) => ({
            id: s.id,
            name: s.name,
            gross: Number(s.gross_cents),
            deduction: Number(s.deduction_cents),
            employer: Number(s.employer_cents),
            net: Number(s.net_cents),
            earnings: lines
              .filter(
                (l) =>
                  l.payslip_id === s.id &&
                  l.kind === "earning" &&
                  !l.schedule_id,
              )
              .map((l) => ({ label: l.label, amount: Number(l.amount_cents) })),
            taken: lines
              .filter((l) => l.payslip_id === s.id && l.kind === "deduction")
              .map((l) => ({ label: l.label, amount: Number(l.amount_cents) })),
          }))}
          staff={((staffRows ?? []) as { id: string; name: string | null }[])
            .filter((s) => s.name)
            .map((s) => {
              const term = (
                (termRows ?? []) as {
                  staff_id: string;
                  basis: string;
                  rate_cents: number;
                  epf_part: string | null;
                  socso_part: string | null;
                  eis_part: string | null;
                }[]
              ).find((x) => x.staff_id === s.id);
              const full = term as
                | {
                    epf_part: string | null;
                    socso_part: string | null;
                    eis_part: string | null;
                  }
                | undefined;
              return {
                id: s.id,
                name: s.name as string,
                basis: term?.basis ?? "monthly",
                rate: term ? Number(term.rate_cents) : 0,
                hasTerms: !!term,
                epfPart: full?.epf_part ?? "",
                socsoPart: full?.socso_part ?? "",
                eisPart: full?.eis_part ?? "",
              };
            })}
          law={law}
          lawReady={lawReady}
          words={{
            runLabel: t("payroll.runLabel"),
            slipLabel: t("payroll.slipLabel"),
            runLede: t("payroll.runLede"),
            noRun: t("payroll.noRun"),
            noStaff: t("payroll.noStaff"),
            noTerms: t("payroll.noTerms"),
            open: t("payroll.open"),
            opening: t("payroll.opening"),
            from: t("payroll.from"),
            to: t("payroll.to"),
            person: t("payroll.person"),
            earns: t("payroll.earns"),
            takenAway: t("payroll.takenAway"),
            takesHome: t("payroll.takesHome"),
            youAlsoPay: t("payroll.youAlsoPay"),
            addLine: t("payroll.addLine"),
            lineLabel: t("payroll.lineLabel"),
            lineAmount: t("payroll.lineAmount"),
            save: t("payroll.save"),
            saving: t("payroll.saving"),
            saved: t("payroll.saved"),
            failed: t("payroll.failed"),
            totalNet: t("payroll.totalNet"),
            totalCost: t("payroll.totalCost"),
            payIt: t("payroll.payIt"),
            paying: t("payroll.paying"),
            payHint: t("payroll.payHint"),
            discard: t("payroll.discard"),
            discardHint: t("payroll.discardHint"),
            paid: t("payroll.paid"),
            termsLabel: t("payroll.termsLabel"),
            termsLede: t("payroll.termsLede"),
            basis: t("payroll.basis"),
            monthly: t("payroll.monthly"),
            daily: t("payroll.daily"),
            hourly: t("payroll.hourly"),
            rate: t("payroll.rate"),
            byLaw: t("payroll.byLaw"),
            noLaw: t("payroll.noLaw"),
            epf: t("payroll.epf"),
            socso: t("payroll.socso"),
            eis: t("payroll.eis"),
            notApplicable: t("payroll.notApplicable"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
