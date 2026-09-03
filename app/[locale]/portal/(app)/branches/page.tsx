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
  const { data } = await supabase
    .from("branches")
    .select("id, name, active")
    .eq("project_id", workspace.projectId)
    .order("sort_order");
  const rows = (data ?? []) as BranchRow[];

  return (
    <>
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
    </>
  );
}
