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
import { ServiceRound } from "./service-round";

/**
 * 一台冷气一年洗两次 —— 这个月要去哪几家，跟哪几份合约快到期了。
 *
 * ── 为什么这一页要存在（2026-09-06）──────────────────────────────────────
 *
 * `add_service_contract` · `update_service_contract` · `set_contract_archived`
 * · `due_visits` · `contracts_ending` · `log_service_visit` ·
 * `undo_service_visit`（20260905220000）**七支，画面上一个入口都没有** ——
 * 而[任务 152](../../../../../docs/founder-tasks.md#152) 的收尾自己写着
 * 「画面上没有那一页 —— 「这个月要去哪几家」那一屏是画面那一层」。
 *
 * 冷气 · 净水器 · 灭虫 · 电梯 —— 这几行的生意模型就是**同一个客户每隔
 * N 个月再来一次**，而那份名单今天记在一本簿子上。
 *
 * ── 两半，因为一天里只有两件事 ──────────────────────────────────────────
 *
 *   ① **要去哪几家** —— 有人要出门
 *   ② **快到期的** —— 没有人出门的时候，打给谁
 *
 * 🔴 **年金在第二半上。** 一份合约到期而没有人打电话，就是一个客户静静地
 * 走掉；冷气这一行的钱在这里，不在单张的保养费上（20260905220000）。
 *
 * ── ⚠️ 这一页一分钱都没有，而那是设计不是漏做 ──────────────────────────
 *
 * `service_contracts` 上**没有金额那一栏**（跟套票同一条）：
 * **师傅必须知道今天去哪几家**，而一份带着「一次收 RM 180」的清单，
 * 等於把价钱交给每一个师傅。所以这一页是 `works_here`，不是 `sees_money`
 * —— 而开单的价钱从「照上次那一张」来（[任务 150](#150)），他一个字都不用打。
 */

type Due = {
  contract_id: string;
  party_id: string | null;
  party: string;
  title: string;
  due_on: string;
  every_months: number;
  status: string | null;
  overdue: boolean;
  record_id: string | null;
  done_on: string | null;
};

type Ending = {
  contract_id: string;
  party_id: string | null;
  party: string;
  title: string;
  ends_on: string;
  days_left: number;
  visits_done: number;
};

export default async function ContractsPage({
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
  const [{ data: dueRows }, { data: endRows }, { data: partyRows }, { data: pageRows }] =
    await Promise.all([
      supabase.rpc("due_visits", { in_project_id: workspace.projectId }),
      supabase.rpc("contracts_ending", { in_project_id: workspace.projectId, in_within_days: 60 }),
      supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", workspace.projectId)
        .eq("module_key", "customers")
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("project_pages")
        /* 🔴 那一栏叫 `page_key`。写成 `key` 的时候 PostgREST 回 400，
           而 supabase-js 不抛 —— `data` 是 null，这一页就少了「顺手开一张单」
           那个下拉，而画面上完全看得过去。2026-09-06 被一张图抓到。 */
        .select("page_key, title, sort_order")
        .eq("project_id", workspace.projectId)
        .order("sort_order"),
    ]);

  const due = (dueRows ?? []) as Due[];
  const ending = (endRows ?? []) as Ending[];

  /* 「顺手开一张单」要开在哪 —— 只有走单那几页收得下一张单，
     而那是 `is_pipeline_module` 在挡的（`log_service_visit` 会抛）。
     所以这里先筛，不要画一颗按下去会抛的按钮。

     🔴 而那一页叫什么，跟**侧栏上那一行问同一支** ——
     我第一版退回 `page_key`，于是这个下拉写着小写的「quotations」
     而侧栏写着「Quotations」—— **同一页在同一屏上两个名字**。 */
  const { data: ctxRow } = await supabase.rpc("get_my_business_context");
  const ctx = (ctxRow as BusinessContext | null) ?? {};
  const refs = ((pageRows ?? []) as { page_key: string; title: string | null }[]).map((p) => ({
    key: p.page_key,
    title: p.title,
  }));
  const labels = tradeLabels(ctx, refs);
  const lang = systemLangOf(ctx);
  const jobPages = refs
    .filter((p) => MODULE_BY_KEY[p.key]?.shape === "pipeline")
    .map((p) => ({ key: p.key, label: pageLabel(p, labels, lang) }));

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
      <PageBar title={t("contracts.title")} subtitle={t("contracts.lede")} />
      <PageBody>
        <ServiceRound
          projectId={workspace.projectId}
          locale={locale}
          due={due}
          ending={ending}
          parties={((partyRows ?? []) as { id: string; name: string | null }[])
            .filter((r) => r.name)
            .map((r) => ({ id: r.id, name: r.name as string }))}
          jobPages={jobPages}
          words={{
            roundLabel: t("contracts.roundLabel"),
            roundLede: t("contracts.roundLede"),
            roundNone: t("contracts.roundNone"),
            endingLabel: t("contracts.endingLabel"),
            endingLede: t("contracts.endingLede"),
            endedAgo: t("contracts.endedAgo"),
            daysLeft: t("contracts.daysLeft"),
            visitsDone: t("contracts.visitsDone"),
            overdue: t("contracts.overdue"),
            done: t("contracts.done"),
            skip: t("contracts.skip"),
            wasDone: t("contracts.wasDone"),
            wasSkipped: t("contracts.wasSkipped"),
            undo: t("contracts.undo"),
            openJob: t("contracts.openJob"),
            makeJob: t("contracts.makeJob"),
            noJob: t("contracts.noJob"),
            newLabel: t("contracts.newLabel"),
            newLede: t("contracts.newLede"),
            who: t("contracts.who"),
            what: t("contracts.what"),
            whatPlaceholder: t("contracts.whatPlaceholder"),
            everyMonths: t("contracts.everyMonths"),
            startsOn: t("contracts.startsOn"),
            endsOn: t("contracts.endsOn"),
            endsOnHint: t("contracts.endsOnHint"),
            sign: t("contracts.sign"),
            signing: t("contracts.signing"),
            signed: t("contracts.signed"),
            pickWho: t("contracts.pickWho"),
            noCustomers: t("contracts.noCustomers"),
            failed: t("contracts.failed"),
            every: t("contracts.every"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
