import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { TaxDesk } from "./tax-desk";

/**
 * 税 —— 这门生意是谁，这一季收了多少税，还有一张单还差什么。
 *
 * ── 为什么这一页要存在（2026-09-06）──────────────────────────────────────
 *
 * `set_tax_profile` · `set_record_tax` · `einvoice_readiness` ·
 * `einvoice_payload` · `sst_return`（20260905610000）从做出来那天起
 * **画面上一个入口都没有**，而[任务 167](../../../../../docs/founder-tasks.md#167)
 * 的收尾自己写着「画面上没有那一页」。
 *
 * ── 🔴 范围：做到送出去的前一步，而且不假装接了 ────────────────────────
 *
 * 真的送去税局要三样今天一样都没有：**注册好的公司** · **LHDN 发的凭证**
 * · **一把数位签章**。所以这一页**不送、不签**，而且画面上讲出来 ——
 * 一段猜出来的对接会一路看起来像已经好了，直到真的接上那天才发现全错。
 *
 * ── 急迫性要讲准，不要吓他 ──────────────────────────────────────────────
 *
 * 2026-01-01 起免除门槛从 RM50 万升到 **RM100 万**，第五阶段取消了
 * （[任务 136](#136)）—— **他大部分的客户现在是免除的**。
 * 所以这一页的理由不是「法律逼他」，是[重点 18](#)：**少了它这一套完不完整**。
 *
 * ── 三段 ────────────────────────────────────────────────────────────────
 *
 *   ① **这门生意是谁** —— 纳税人编号 · 注册号 · 行业代号 · 地址
 *   ② **SST** —— 登记了没有，跟这一季收了多少
 *   ③ **拿一张单试一次** —— 还差什么，逐条讲
 *
 * 只有老板：`tax_profile` 是 `sees_money`。
 */

type SstRow = {
  registered: boolean;
  sst_no: string;
  taxable_cents: number;
  tax_cents: number;
  documents: number;
};

/** 这一季 —— 服务税是按两个月一期报的，而绝大多数老板脑子里是「这一季」。
 *  给他一个窗口当起点，不是替他决定报哪一期。 */
function thisQuarter() {
  const now = new Date();
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fromM = q * 3 + 1;
  const toM = fromM + 2;
  return {
    from: `${y}-${pad(fromM)}-01`,
    to: `${y}-${pad(toM)}-${pad(new Date(y, toM, 0).getDate())}`,
  };
}

export default async function TaxPage() {
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.role !== "owner") notFound();

  const supabase = await createSessionSupabaseClient();
  /* 他自己那一套配色 —— 跟记录页同一个来源。 */
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;
  const q = thisQuarter();

  const [{ data: profRows }, { data: sstRows }, { data: pageRows }] = await Promise.all([
    supabase.from("tax_profile").select("*").eq("project_id", workspace.projectId).maybeSingle(),
    supabase.rpc("sst_return", {
      in_project_id: workspace.projectId,
      in_from: q.from,
      in_to: q.to,
    }),
    supabase
      .from("project_pages")
      /* 🔴 `page_key`，不是 `key` —— 见 contracts/page.tsx 的同一条。 */
      .select("page_key, sort_order")
      .eq("project_id", workspace.projectId)
      .order("sort_order"),
  ]);

  /* 拿来试的那几张单，只从走单那几页拿 —— `einvoice_readiness` 收的是
     一张 `pipeline_records`，而名册跟收款上没有那种东西。 */
  const jobKeys = ((pageRows ?? []) as { page_key: string }[])
    .map((p) => p.page_key)
    .filter((k) => MODULE_BY_KEY[k]?.shape === "pipeline");

  const { data: docRows } = jobKeys.length
    ? await supabase
        .from("pipeline_records")
        .select("id, doc_no, title, party, module_key, tax_rate")
        .eq("project_id", workspace.projectId)
        .in("module_key", jobKeys)
        .is("archived_at", null)
        .order("issued_on", { ascending: false })
        .limit(20)
    : { data: [] };

  const prof = (profRows ?? null) as Record<string, unknown> | null;
  const str = (k: string) => (typeof prof?.[k] === "string" ? (prof[k] as string) : "");
  const sst = ((sstRows ?? []) as SstRow[])[0] ?? null;

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
      <PageBar title={t("tax.title")} subtitle={t("tax.lede")} />
      <PageBody>
        <TaxDesk
          projectId={workspace.projectId}
          period={q}
          profile={{
            tin: str("tin"),
            reg_no: str("reg_no"),
            msic_code: str("msic_code"),
            msic_name: str("msic_name"),
            address_line: str("address_line"),
            postcode: str("postcode"),
            city: str("city"),
            state: str("state"),
            phone: str("phone"),
            email: str("email"),
            sst_no: str("sst_no"),
            sst_from: str("sst_from"),
            sst_rate:
              typeof prof?.sst_rate === "number"
                ? String(prof.sst_rate)
                : typeof prof?.sst_rate === "string"
                  ? (prof.sst_rate as string)
                  : "8",
          }}
          sst={
            sst
              ? {
                  registered: sst.registered,
                  sstNo: sst.sst_no,
                  taxable: Number(sst.taxable_cents),
                  tax: Number(sst.tax_cents),
                  documents: sst.documents,
                }
              : null
          }
          docs={((docRows ?? []) as {
            id: string;
            doc_no: string | null;
            title: string | null;
            party: string | null;
            tax_rate: number | string | null;
          }[]).map((d) => ({
            id: d.id,
            label: [d.doc_no, d.title || d.party].filter(Boolean).join(" · ") || d.id.slice(0, 8),
            rate: d.tax_rate == null ? "" : String(d.tax_rate),
          }))}
          words={{
            whoLabel: t("tax.whoLabel"),
            whoLede: t("tax.whoLede"),
            tin: t("tax.tin"),
            regNo: t("tax.regNo"),
            msicCode: t("tax.msicCode"),
            msicName: t("tax.msicName"),
            addressLine: t("tax.addressLine"),
            postcode: t("tax.postcode"),
            city: t("tax.city"),
            state: t("tax.state"),
            phone: t("tax.phone"),
            email: t("tax.email"),
            save: t("tax.save"),
            saving: t("tax.saving"),
            saved: t("tax.saved"),
            failed: t("tax.failed"),
            sstLabel: t("tax.sstLabel"),
            sstLede: t("tax.sstLede"),
            sstNo: t("tax.sstNo"),
            sstFrom: t("tax.sstFrom"),
            sstRate: t("tax.sstRate"),
            notRegistered: t("tax.notRegistered"),
            thisPeriod: t("tax.thisPeriod"),
            taxable: t("tax.taxable"),
            taxCollected: t("tax.taxCollected"),
            documents: t("tax.documents"),
            checkLabel: t("tax.checkLabel"),
            checkLede: t("tax.checkLede"),
            pickDoc: t("tax.pickDoc"),
            noDocs: t("tax.noDocs"),
            check: t("tax.check"),
            checking: t("tax.checking"),
            ready: t("tax.ready"),
            stillMissing: t("tax.stillMissing"),
            rateOnDoc: t("tax.rateOnDoc"),
            applyRate: t("tax.applyRate"),
            clearRate: t("tax.clearRate"),
            notSent: t("tax.notSent"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
