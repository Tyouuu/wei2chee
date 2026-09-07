import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { todayMYT } from "@/lib/portal/record-validity";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";
import { NudgeList, type Nudge } from "./nudge-list";
import { SaidList, type Said } from "./said-list";
import { formatDay, formatTime } from "@/lib/format-date";

/**
 * 要跟的事。
 *
 * ── 🔴 逾期的排最前面 ─────────────────────────────────────────────────────
 *
 * 一个承包商打开系统那一秒要看到的不是「今天有三件」，
 * 是**「有一件昨天就该做而你没做」**。那一排在最上面，而且是红的。
 *
 * ── 师傅也看得到 ──────────────────────────────────────────────────────────
 *
 * 「明天去工地量尺寸」是他一天的工作，所以 `follow_ups_due` 是
 * `works_here` 不是 `sees_money`。跟谁欠我钱那一页正好相反 ——
 * 那一页对师傅是 404，因为空的会画成「没有人欠你钱」。
 *
 * ── ⚠️ 它还不是什么 ──────────────────────────────────────────────────────
 *
 * **不会自己提醒他。** 到了那一天没有任何东西会响 ——
 * 那要一条发得出去的讯息，而那卡在真的 WhatsApp 号码（任务 11）。
 * 今天它只在他打开的时候讲话。
 */

/** 马来西亚的今天往后七天。 */
function weekFromMYT(): string {
  const d = new Date(`${todayMYT()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

type Due = {
  id: string;
  record_id: string;
  module_key: string;
  doc_no: string | null;
  title: string | null;
  party: string | null;
  amount_cents: number | null;
  what: string;
  due_on: string;
  days_late: number;
};

export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ until?: string }>;
}) {
  const { locale } = await params;
  const { until } = await searchParams;
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
  const { data } = await supabase.rpc("follow_ups_due", {
    in_project_id: workspace.projectId,
    /* 「这个礼拜」是网址上的一个字，不是一个要他记住的设定。
       🔴 **马来西亚的今天，不是伺服器的。** `toISOString()` 是 UTC，
       所以半夜到早上八点算出来是前一天 —— 而那正好是他补记昨天工地的
       那个时段（`today_myt()` 存在的同一个八小时）。 */
    in_until: until === "week" ? weekFromMYT() : null,
  });
  const rows = (data ?? []) as Due[];
  const late = rows.filter((r) => Number(r.days_late) > 0).length;

  /* 🔴 系统自己看出来的那几件（`nudges_due`，[任务 212](../../../../../docs/founder-tasks.md#212)）。
     六个信号从做出来那天就算得出来，而**画面上一个入口都没有**。
     它跟他自己写的那一份**同一页** —— 他只会开一个地方。 */
  const { data: nudgeRows } = await supabase.rpc("nudges_due", {
    in_project_id: workspace.projectId,
    in_until: until === "week" ? weekFromMYT() : null,
  });
  const nudges = (nudgeRows ?? []) as Nudge[];

  /* 哪一张单在哪一页 —— 只有伺服器这一边知道。
     ⚠️ 查不到的那一行**不画连结**，不是画一条连不过去的 —— 那跟一颗
     按不动的按钮是同一件事。 */
  const recordIds = [
    ...new Set(nudges.map((n) => n.record_id).filter(Boolean)),
  ] as string[];
  const { data: whereRows } = recordIds.length
    ? await supabase
        .from("pipeline_records")
        .select("id, module_key")
        .in("id", recordIds)
    : { data: [] };
  const moduleOf = Object.fromEntries(
    ((whereRows ?? []) as { id: string; module_key: string }[]).map((r) => [
      r.id,
      r.module_key,
    ]),
  );

  /* 🔴 **那句话要发给谁的哪一个号码。**
     `nudges_due` 回的是 `party_id`，而号码在名册上 —— 只有伺服器这一边
     问得到。**问不到号码的那一行不画那颗按钮**，不是画一颗按下去打给
     空气的（[任务 11](../../../../../docs/founder-tasks.md#11) 那颗官网上的
     WhatsApp 就是那样活了十几天）。

     ⚠️ 优先 `whatsapp` 才是 `phone` —— 他自己 vibe-dealer 那张表 0030
     写下的理由：**店里那支号码常常不是 WhatsApp 那一支**。 */
  const partyIds = [
    ...new Set(nudges.map((n) => n.party_id).filter(Boolean)),
  ] as string[];
  const { data: partyRows } = partyIds.length
    ? await supabase
        .from("directory_entries")
        .select("id, whatsapp, phone")
        .in("id", partyIds)
    : { data: [] };
  const phoneOf = Object.fromEntries(
    (
      (partyRows ?? []) as {
        id: string;
        whatsapp: string | null;
        phone: string | null;
      }[]
    )
      .map((r) => [r.id, (r.whatsapp || r.phone || "").trim()])
      .filter(([, v]) => v),
  ) as Record<string, string>;

  /* 🔴 这个系统替他讲过的每一句话，跟那两个开关（[任务 219](#219) 他自己要的）。
     **只有老板** —— `messages` 那张表是 `sees_money`，理由写在
     20260906380000 的档头上：`body` 是一段自由文字，而这一行的自由文字里
     常常有钱（「你还欠我 RM 45,500」），**而一段文字里的金额遮不掉**。
     所以师傅这一段问都不问 —— 问了拿回来是空的，而空的会画成
     「系统从来没有替你讲过话」，那是一句假话。 */
  let said: Said[] = [];
  let toOwner = true;
  let toCustomer = true;
  if (workspace.isOwner) {
    const [{ data: saidRows }, { data: setRow }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, audience, kind, body, party_id, status, created_at")
        .eq("project_id", workspace.projectId)
        .order("created_at", { ascending: false })
        /* 二十行。他打开这一页是要看「最近讲过什么」，
           而一份从头列到底的帐读起来是一份报告。 */
        .limit(20),
      supabase
        .from("message_settings")
        .select("to_owner, to_customer")
        .eq("project_id", workspace.projectId)
        .maybeSingle(),
    ]);
    /* ⚠️ **一行都还没有的时候，两个都是开的** —— 那张表的预设就是 true
       （他 2026-09-06 拍板 `兩個都開放`），而这里补上同一个预设，
       不是画一个「关着」的勾。一个跟资料库讲反了的开关，
       他按一下才会发现。 */
    toOwner = setRow?.to_owner ?? true;
    toCustomer = setRow?.to_customer ?? true;
    const rowsSaid = (saidRows ?? []) as {
      id: string;
      audience: string;
      kind: string;
      body: string;
      party_id: string | null;
      status: string;
      created_at: string;
    }[];
    /* 讲给谁 —— 名字在名册上。⚠️ 那个人被删掉了（`on delete set null`）
       的时候这一行照旧要画：**那句话真的讲过**，只是不知道讲给谁了。 */
    const saidParties = [
      ...new Set(rowsSaid.map((r) => r.party_id).filter(Boolean)),
    ] as string[];
    const { data: nameRows } = saidParties.length
      ? await supabase
          .from("directory_entries")
          .select("id, name")
          .in("id", saidParties)
      : { data: [] };
    const nameOf = Object.fromEntries(
      ((nameRows ?? []) as { id: string; name: string | null }[]).map((r) => [
        r.id,
        r.name ?? "",
      ]),
    );
    said = rowsSaid.map((r) => ({
      id: r.id,
      audience: r.audience,
      kind: r.kind,
      body: r.body,
      party: r.party_id ? (nameOf[r.party_id] ?? null) : null,
      status: r.status,
      /* 🔴 时间在**伺服器这一边**照马来西亚时间排好。
         浏览器那一边算，会拿到那台机自己的时区 —— 而这个产品卖的是
         马来西亚的生意，「下午 2:32」对每一个读它的人要是同一刻
         （`lib/format-date.ts` 的档头）。 */
      at: formatTime(r.created_at, locale),
      on: formatDay(r.created_at, locale),
    }));
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

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
      <PageBar title={t("today.title")} subtitle={t("today.lede")} />
      <PageBody>
        {/* 🔴 系统看到的排在**他自己写的上面** —— 底下那一份是他已经
            知道的（他自己写的承诺），这一份是他**还不知道的**。
            一件都没有的时候整张卡不画：一张永远写着「现在没有要看的」的卡，
            读起来是这一页没做完。 */}
        {nudges.length > 0 ? (
          <div className="mb-5">
            <NudgeList
              projectId={workspace.projectId}
              locale={locale}
              rows={nudges}
              isOwner={workspace.isOwner}
              moduleOf={moduleOf}
              phoneOf={phoneOf}
            />
          </div>
        ) : null}

        {/* 🔴 「今天 / 这个星期」是一个**筛子**，不是页脚两条连结。
            它原本是最底下两句底线字，而他要换的时候得先滚到底 ——
            一个筛子的家在它筛的那份清单的**上面**。
            参考那一套每一张卡就是这样：抬头在左，这一张自己的控件在右。 */}
        <DeskCard
          action={
            <div className="flex [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] overflow-hidden">
              {(
                [
                  {
                    on: until !== "week",
                    href: `/${locale}/portal/today`,
                    label: t("today.todayOnly"),
                  },
                  {
                    on: until === "week",
                    href: `/${locale}/portal/today?until=week`,
                    label: t("today.week"),
                  },
                ] as const
              ).map((x) => (
                <a
                  key={x.href}
                  href={x.href}
                  aria-current={x.on ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center px-3 [font-size:var(--text-sm)] " +
                    (x.on
                      ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                      : "[color:var(--color-paper)] hover:[background-color:var(--color-ink-950)]")
                  }
                >
                  {x.label}
                </a>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className={dim}>
              {until === "week" ? t("today.noneWeek") : t("today.none")}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* 🔴 逾期几件 —— 那才是他要先看的数字。一件都没有就不画。 */}
              {late > 0 ? (
                <div>
                  <div className={dim}>{t("today.late")}</div>
                  <div className="mt-0.5 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-clay-bright)]">
                    {late}
                  </div>
                </div>
              ) : null}

              <ul className="flex flex-col">
                {rows.map((r) => {
                  const isLate = Number(r.days_late) > 0;
                  return (
                    <li
                      key={r.id}
                      /* 🔴 逾期的那几件用**一条边**认，不是靠读第二行的颜色。
                         他扫这一页的时候读的是左缘，不是每一行的第二句。 */
                      className={
                        "grid gap-1 border-t py-4 pl-3 [border-color:var(--color-ink-800)] " +
                        (isLate
                          ? "[box-shadow:inset_2px_0_0_var(--color-clay-bright)]"
                          : "[box-shadow:inset_2px_0_0_var(--color-ink-800)]")
                      }
                    >
                      {/* 要做的那件事排第一，而且比它的日期跟单号大一档 ——
                          这一页的答案就是这一句。 */}
                      <p className="[font-size:var(--text-base)] [color:var(--color-paper)]">
                        {r.what}
                      </p>
                      <p
                        className={
                          isLate
                            ? "[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
                            : dim
                        }
                      >
                        {isLate
                          ? t("today.lateBy", {
                              n: r.days_late,
                              date: r.due_on,
                            })
                          : t("today.on", { date: r.due_on })}
                      </p>
                      {/* 点得进那张单 —— 他读完这一行下一件事就是打开它。 */}
                      <p className={dim}>
                        <a
                          href={`/${locale}/portal/${r.module_key}/${r.record_id}`}
                          className="underline"
                        >
                          {r.doc_no ?? ""}
                          {r.doc_no && r.title ? " · " : ""}
                          {r.title ?? ""}
                        </a>
                        {r.party ? ` · ${r.party}` : ""}
                        {r.amount_cents != null
                          ? ` · ${ringgit(Number(r.amount_cents))}`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DeskCard>

        {/* 🔴 讲过什么 —— 排在他自己那一份底下。
            上面两张是**要做的**，这一张是**做过的**：
            一份做过的帐排在待办上面，会把他今天要做的事推下去。
            ⚠️ 一句都没讲过的时候**照样画** —— 见 said-list.tsx 的档头：
            那句话是一个答案，而且那两个开关要有一个家。 */}
        {workspace.isOwner ? (
          <div className="mt-5">
            <DeskCard title={t("today.saidLabel")}>
              <SaidList
                projectId={workspace.projectId}
                rows={said}
                toOwner={toOwner}
                toCustomer={toCustomer}
              />
            </DeskCard>
          </div>
        ) : null}
      </PageBody>
    </StyleScope>
  );
}
