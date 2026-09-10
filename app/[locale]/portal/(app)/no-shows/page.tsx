import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";
import { Avatar } from "@/design-system/components/avatar";

/**
 * 谁放过飞机，放过几次。
 *
 * ── 为什么这一页要存在（[任务 333/351/358]）───────────────────────────────
 *
 * `no_shows_of`（20260909320000）从做出来那天就答得出「谁没来过、来过几次」，
 * 而画面上零个呼叫端——[任务 358] 把「这一单要不要订金」接上了柜台正在看的
 * 那一张预约（`deposit_advice`，问的是**这一个人**），而「一份名单，柜台
 * 想到的时候翻得到」这一半没有落地。跟 `(app)/owing` 是同一条判断：
 * 一支函式答得出问题，不代表有人会想到去问它。
 *
 * ── 🔴 不挡师傅 ───────────────────────────────────────────────────────────
 *
 * `no_shows_of` 自己是 `works_here`，不是 `sees_money`——见它自己的注解：
 * 「柜台要知道明天来的那一个靠不靠得住，而这一支从头到尾一个金额都没有」。
 * 跟 `(app)/owing`（钱，只有老板）刻意不同：这一页答的是「她可不可靠」，
 * 不是「她欠多少」，站柜台的美发师自己就要知道。
 *
 * ── 分母跟分子一起给 ────────────────────────────────────────────────────────
 *
 * 来过四十次错过两次，跟来过两次错过两次，不是同一个客人——见 `no_shows_of`
 * 自己的档头。这一页两个数字一起印，不只印「missed」。
 */

type NoShow = {
  party_id: string;
  party: string;
  missed: number;
  came: number;
  last_missed_on: string | null;
};

export default async function NoShowsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;

  const { data: rows } = await supabase.rpc("no_shows_of", {
    in_project_id: workspace.projectId,
  });
  const missed = (rows ?? []) as NoShow[];

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("noShows.title")} subtitle={t("noShows.lede")} />
      <PageBody>
        <DeskCard>
          {missed.length === 0 ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {t("noShows.none")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {missed.map((r) => {
                /* 🔴 两个颜色，不是三个——跟 `(app)/owing` · 补习总览那张
                   「Owing / Overdue」同一条判断（[任务 357]）：颜色只答一句
                   「要不要多留意」，答案只有两个，不切三档。 放的次数
                   追上来过的次数（missed >= came），就是这一位真的该多留意的。 */
                const severe = r.missed >= r.came;
                const tone = severe
                  ? "var(--color-clay-bright)"
                  : "var(--color-on-canvas-dim)";
                return (
                  <li
                    key={r.party_id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-4 first:border-t-0 [border-color:var(--color-ink-800)]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={r.party} size={36} />
                      <div className="flex flex-col">
                        <a
                          href={`/${locale}/portal/customers/${r.party_id}`}
                          className="[font-weight:var(--fw-medium)] underline"
                        >
                          {r.party}
                        </a>
                        {r.last_missed_on ? (
                          <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                            {t("noShows.lastMissed", { date: r.last_missed_on })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 [border-radius:var(--radius-pill)] [padding-block:4px] [padding-inline:8px] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] tabular-nums"
                      style={{ color: tone, border: `1px solid ${tone}` }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tone }}
                      />
                      {t("noShows.missedOf", {
                        missed: r.missed,
                        total: r.missed + r.came,
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}
