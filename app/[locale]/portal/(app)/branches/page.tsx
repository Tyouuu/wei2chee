import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody, Section } from "../section";
import { BranchesClient, type BranchRow } from "./branches-client";

/**
 * 他的分店。
 *
 * ── 为什么这一页要存在，而不是塞进帐号那一页 ────────────────────────────
 *
 * 帐号那一页是另一个 session 手上的（[重点 20](docs/founder-points.md)），
 * 而分店没有一个自己的地方就等於**开不了店** —— 那正好是这个仓库最常犯的
 * 那个错：东西建好了，线没接。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * 多一间店在这个市场是多一份月费（[任务 67]：Tunai · Aoikumo · StoreHub
 * 三家都按店收），所以那是老板的决定，资料库那边也是 `sees_money`。
 * 师傅打开这一页会 404 —— 不是画一个空的清单给他看。
 *
 * ⚠️ 用 `PageBar` / `PageBody` / `Section`，那是 portal 自己的段落语言
 * （询价那一页 9-01 第一个改成用它的，理由写在那里）。
 */

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  void locale;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");
  /* 🔴 师傅打不开。一个他打得开、而每一颗按钮都会被资料库拒绝的页面，
     比 404 糟 —— 他会以为是坏了。 */
  if (workspace.role !== "owner") notFound();

  const supabase = await createSessionSupabaseClient();
  /* 他自己那一套配色 —— 跟记录页同一个来源。 */
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;
  const { data } = await supabase
    .from("branches")
    .select("id, name, active")
    .eq("project_id", workspace.projectId)
    .order("sort_order");
  const rows = (data ?? []) as BranchRow[];

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
      <PageBar title={t("branches.title")} subtitle={t("branches.lede")} />
      <PageBody>
        <Section label={t("branches.label")} count={rows.filter((r) => r.active).length}>
          <BranchesClient
            projectId={workspace.projectId}
            rows={rows}
            copy={{
              add: t("branches.add"),
              adding: t("branches.adding"),
              name: t("branches.name"),
              off: t("branches.off"),
              on: t("branches.on"),
              offLabel: t("branches.offLabel"),
              none: t("branches.none"),
            }}
          />
        </Section>
      </PageBody>
    </StyleScope>
  );
}
