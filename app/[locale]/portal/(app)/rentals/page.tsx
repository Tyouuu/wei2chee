import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";
import {
  pageLabel,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
} from "@/lib/templates/industry-template";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { OutOnLoan } from "./out-on-loan";

/**
 * 这个东西现在在谁那里。
 *
 * ── 为什么这一页要存在（2026-09-06）──────────────────────────────────────
 *
 * `lend_item` · `return_rental` · `rentals_out`（20260905540000）
 * 从做出来那天起 **画面上一个入口都没有**，而
 * [任务 168](../../../../../docs/founder-tasks.md#168) 的收尾自己写着
 * 「画面上没有那一页」。
 *
 * 器材租借 · 婚纱 · 桌椅帐篷 —— 这几行每天在问的就是这一句。
 *
 * ── ⚠️ 这一页上一分钱都没有，而那是设计 ────────────────────────────────
 *
 * 押金**不存在这张表上** —— 一笔收进来还没分摊的钱就是押金
 * （[任务 131](#131)），所以钱永远只有一个答案。
 * 而那条边界自己会守：金额住在帐上（只有老板看得到），
 * 这一页是 `works_here` —— **师傅在柜台交货收货看得到东西，看不到押金多少**。
 */

type Out = {
  id: string;
  record_id: string;
  doc_no: string | null;
  party: string | null;
  descr: string;
  qty: number;
  out_on: string;
  due_back_on: string | null;
  days_over: number;
};

export default async function RentalsPage() {
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
  const [{ data: outRows }, { data: pageRows }, { data: ctxRow }] =
    await Promise.all([
      supabase.rpc("rentals_out", { in_project_id: workspace.projectId }),
      supabase
        .from("project_pages")
        /* 🔴 `page_key`，不是 `key` —— 2026-09-06 这个错让两页静静地空掉过。 */
        .select("page_key, title, sort_order")
        .eq("project_id", workspace.projectId)
        .order("sort_order"),
      supabase.rpc("get_my_business_context"),
    ]);

  const ctx = (ctxRow as BusinessContext | null) ?? {};
  const refs = (
    (pageRows ?? []) as { page_key: string; title: string | null }[]
  ).map((p) => ({
    key: p.page_key,
    title: p.title,
  }));
  const labels = tradeLabels(ctx, refs);
  const lang = systemLangOf(ctx);
  /* 🔴 **只有订单跟工程借得出东西。**
     `lend_item` 自己挡着（`module_key not in ('orders','projects')` 就抛）——
     而我第一版把**每一个走单的页**都放进了那个下拉，
     于是挑一张报价单按下去必抛。
     **一颗在某些选项下根本按不动的按钮，跟一颗死按钮是同一件事。** */
  const LENDABLE = new Set(["orders", "projects"]);
  const jobKeys = refs.filter((p) => LENDABLE.has(p.key)).map((p) => p.key);

  /* 借出去的东西挂在**一张单**上 —— 那张单答得出「借给谁」，
     而这一页不另外记一次客户的名字（同一件事两个答案是这个仓库的老毛病）。 */
  const { data: jobRows } = jobKeys.length
    ? await supabase
        .from("pipeline_records")
        .select("id, doc_no, title, party, module_key, issued_on")
        .eq("project_id", workspace.projectId)
        .in("module_key", jobKeys)
        .is("archived_at", null)
        .order("issued_on", { ascending: false })
        .limit(30)
    : { data: [] };

  const labelOf = (k: string) =>
    pageLabel(
      { key: k, title: refs.find((r) => r.key === k)?.title ?? null },
      labels,
      lang,
    );

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
      <PageBar title={t("rentals.title")} subtitle={t("rentals.lede")} />
      <PageBody>
        <OutOnLoan
          out={(outRows ?? []) as Out[]}
          jobs={(
            (jobRows ?? []) as {
              id: string;
              doc_no: string | null;
              title: string | null;
              party: string | null;
              module_key: string;
            }[]
          ).map((j) => ({
            id: j.id,
            label:
              [j.doc_no, j.party || j.title].filter(Boolean).join(" · ") ||
              `${labelOf(j.module_key)} ${j.id.slice(0, 6)}`,
          }))}
          words={{
            outLabel: t("rentals.outLabel"),
            pieces: t("rentals.pieces"),
            lateCount: t("rentals.lateCount"),
            people: t("rentals.people"),
            someone: t("rentals.someone"),
            outLede: t("rentals.outLede"),
            outNone: t("rentals.outNone"),
            overdue: t("rentals.overdue"),
            dueBack: t("rentals.dueBack"),
            noDueDate: t("rentals.noDueDate"),
            back: t("rentals.back"),
            returning: t("rentals.returning"),
            lendLabel: t("rentals.lendLabel"),
            lendLede: t("rentals.lendLede"),
            noJobs: t("rentals.noJobs"),
            onJob: t("rentals.onJob"),
            what: t("rentals.what"),
            whatPlaceholder: t("rentals.whatPlaceholder"),
            howMany: t("rentals.howMany"),
            dueOn: t("rentals.dueOn"),
            lend: t("rentals.lend"),
            lending: t("rentals.lending"),
            lent: t("rentals.lent"),
            failed: t("rentals.failed"),
            needWhat: t("rentals.needWhat"),
            depositNote: t("rentals.depositNote"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
