import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { ConsentDesk, type FormRow } from "./consent-desk";

/**
 * 她要客人签的那几份表单。
 *
 * ── 为什么这一页要存在（2026-09-09）─────────────────────────────────────
 *
 * 八支函式（20260909130000）全部用真的登入身分验过 —— 47 条断言全绿 ——
 * 而 [任务 313] 自己的收尾写着：**「画面上一格都没有 …… 她今天点不到。」**
 * 一个建好了没有人到得了的东西，跟一个不存在的东西，
 * 在报告里长得一模一样（这个仓库量过 33 次）。
 *
 * ── 🔴 不挡师傅 ───────────────────────────────────────────────────────────
 *
 * `add_consent_form` · `update_consent_form` · `consent_forms_of`
 * **三支都是 `works_here`，不是 `sees_money`** —— 而那是对的：
 * 一份同意书上**一个金额都没有**，而写那一份字的人常常就是美疗师自己。
 * 所以这一页不加角色闸 —— 一个页面挡得比它底下那几支函式还严，
 * 就是在替资料库发明一条它没有的规矩。
 * （对照：房间那一页整页只有老板，因为 `add_room` 是 `sees_money`。）
 *
 * ── 只有范本，没有「发给谁」 ───────────────────────────────────────────────
 *
 * 发一份给她 · 她签了没有 —— 那两件住在**那个人自己那一页**上
 * （客户详情页），不在这里。理由跟侧栏那一条规矩一样：
 * **一份同意书属於一个人**，而她想到那件事的时候，正在看那个人。
 */

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const [{ data: paletteRow }, formRes] = await Promise.all([
    supabase
      .from("projects")
      .select("palette")
      .eq("id", workspace.projectId)
      .maybeSingle(),
    supabase.rpc("consent_forms_of", { in_project_id: workspace.projectId }),
  ]);

  const palette = (paletteRow?.palette as string | null) ?? null;
  const rows = (formRes?.data ?? []) as FormRow[];

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("consent.title")} subtitle={t("consent.lede")} />
      <PageBody>
        <ConsentDesk
          projectId={workspace.projectId}
          rows={rows}
          copy={{
            title: t("consent.label"),
            lede: t("consent.note"),
            snapshot: t("consent.snapshot"),
            add: t("consent.add"),
            adding: t("consent.adding"),
            name: t("consent.name"),
            body: t("consent.body"),
            save: t("consent.save"),
            saving: t("consent.saving"),
            edit: t("consent.edit"),
            cancel: t("consent.cancel"),
            off: t("consent.off"),
            on: t("consent.on"),
            offLabel: t("consent.offLabel"),
            none: t("consent.none"),
            // Templates with a {n} the desk fills in (consent-desk.tsx does
            // .replace("{n}", count)). t() would try to format them here without
            // the number and log a FORMATTING_ERROR, so they are read raw.
            signed: t.raw("consent.signed") as string,
            waiting: t.raw("consent.waiting") as string,
            needName: t("consent.needName"),
            needBody: t("consent.needBody"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}
