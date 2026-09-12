import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";
import { ReviewsList } from "./reviews-list";

/**
 * 完工请她给一句评价 —— 老板看得到那份清单了。
 *
 * ── 为什么这一页要存在（[任务 371]）────────────────────────────────────────
 *
 * `reviews_of`（20260911010000）从做出来那天起零个呼叫端。[重点 30]
 * 那张「更方便人们」的表 2026-09-05 就写着「完工请他给评价 · 老带新——
 * 这四件本地一家都没有」；[任务 368] 把「取消」接上了那个门牌，
 * [任务 371] 接了「留评价」那一半，而老板自己看得到这份清单这一半
 * 从来没有落地——跟这个仓库数到第二十次的那个形状一样：能力有，线没接。
 *
 * ── 🔴 不挡师傅 ───────────────────────────────────────────────────────────
 *
 * `reviews_of` 自己是 `works_here`，不是 `sees_money`——她收到一句好评，
 * 做那件事的人自己该看得到，跟「谁欠我钱」（钱，只有老板）刻意不同。
 *
 * ── 🔴 给不给公开，是一个要按的决定，不是默认 ──────────────────────────────
 *
 * `may_show` 预设 false（照片那一页同一条纪律）。这一页把「要不要拿去
 * 官网/宣传上用」变成一颗按钮，不是替他决定。
 *
 * ── 🔴 找人／筛星等（[重点 36]，2026-09-12 他讲的）─────────────────────────
 *
 * 一年下来评价会累积到几十上百句，找一句差评或者找某一个客人写过的话
 * 会变成从头扫到尾。搜寻／筛选跟这一页一起画，不是等清单长了才回来补——
 * 见 `reviews-list.tsx`，而且只在超过一屏（六句）才画那两格，
 * 少的时候一个筛不出东西的框只是杂讯。
 *
 * ⚠️ **每一句要给客户端看的字，都在这里（伺服器端）先拼好**——
 * `t()` 要在伺服器上拿到参数才解析得出 ICU 的 `{date}`／`{n}`
 * （[重点 26] 那次 `{time}` 的教训），而且伺服器元件本来就不能把
 * 一个函式当 prop 传给客户端元件。两个理由都指向同一个做法：
 * 字在这里就变成成品，`reviews-list.tsx` 只负责显示跟筛选。
 */
export default async function ReviewsPage() {
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

  const { data: rows } = await supabase.rpc("reviews_of", {
    in_project_id: workspace.projectId,
  });
  const raw = (rows ?? []) as {
    id: string;
    party: string;
    service: string;
    rating: number;
    review_text: string;
    submitted_at: string;
    may_show: boolean;
  }[];

  const reviews = raw.map((r) => ({
    id: r.id,
    party: r.party,
    service: r.service ?? "",
    rating: r.rating,
    review_text: r.review_text ?? "",
    may_show: r.may_show,
    submittedLabel: t("reviews.submittedOn", {
      date: r.submitted_at?.slice(0, 10) ?? "",
    }),
  }));

  const starOptions = [5, 4, 3, 2, 1].map((n) => ({
    value: n,
    label: t("reviews.starsOnly", { n }),
  }));

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("reviews.title")} subtitle={t("reviews.lede")} />
      <PageBody>
        <DeskCard>
          <ReviewsList
            reviews={reviews}
            starOptions={starOptions}
            copy={{
              find: t("reviews.find"),
              allRatings: t("reviews.allRatings"),
              none: t("reviews.none"),
              noneFound: t("reviews.noneFound"),
              mayShow: t("reviews.mayShow"),
              mayNotShow: t("reviews.mayNotShow"),
              makePublic: t("reviews.makePublic"),
              makePrivate: t("reviews.makePrivate"),
              saving: t("reviews.saving"),
            }}
          />
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}
