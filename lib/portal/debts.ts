import type { SupabaseClient } from "@supabase/supabase-js";
import { ringgit } from "./live-rows";
import type { WorkspaceRole } from "./workspace";

/**
 * 谁欠他钱，欠了多久。
 *
 * ── 为什么这一件排在这里 ──────────────────────────────────────────────────
 *
 * 它是八个行业里**八个都要**的那一种。装修的屋主、五金店的月结客、
 * 沙龙卖出去的套票、补习班的学费 —— 每一门生意都有一笔别人还没给的钱，
 * 而 [任务 67] 实查 SQL Account 的时候，它 `Customer` 那一栏自己列的卖点
 * 就是**「账龄 · 信用额度 · CTOS」**。
 *
 * 数字从 20260904060000 起就算得出来了（`party_debts`），而它到今天只被
 * **开单那一页**用来讲一句「他已经欠你 RM X」。整家的那一份 ——
 * **「谁欠我钱、谁欠最久」** —— 没有任何地方问得出来。
 *
 * ── 🔴 三种答案，不是两种 ─────────────────────────────────────────────────
 *
 * `party_debts` 是 security definer，而它自己 `where sees_money(...)`。
 * 所以一个师傅打这一支拿回来的是**零行** —— 跟「每一张单都收齐了」
 * 长得一模一样。
 *
 * 把两个混成一个，画面上就会对一个师傅讲「没有人欠你钱」，
 * 而他老板的帐上挂着三万。所以这一支回三种东西：
 *
 *   null   没有问（不是老板），或者这一次读失败了  -> 一个字都不要讲
 *   []     问了，没有人欠                          -> 可以讲「都收齐了」
 *   [...]  问了，这几个人欠                         -> 讲这几个
 *
 * ⚠️ 这跟 `live-answers` 的 `unread` 是同一条规矩的第二次：
 * **「读不到」跟「是零」永远不可以长得一样。**
 *
 * ── 🔴 截断不可以把最久的那一笔藏起来 ─────────────────────────────────────
 *
 * 清单按**欠得最多**排（那是他第一眼要看的），而这一层真正卖的是
 * **欠得最久**。一个欠 RM 300、欠了两年的客户，会掉在第九名之后被切掉 ——
 * 而他正是那个要打电话的人。
 *
 * 所以「最久的那一个」是在**截断之前**从全部行里算的，单独一行。
 * 总数也一样：一个截断过的总数，比没有总数糟。
 */

/** 一个人欠多少。除了额度，全部是算出来的，一栏都没有存。 */
export type PartyOwing = {
  partyId: string;
  /** 他自己写下的那个名字。读不到就是空的 —— 见 `UNNAMED`。 */
  name: string;
  owedCents: number;
  /** 最老的那一笔还没收齐的单，欠了几天。null = 那几张单都没写日期。 */
  oldestDays: number | null;
  /** 他自己写的额度。null 是常态，意思是没有上限。 */
  limitCents: number | null;
};

/** `null` = 没有问 / 读不到。`[]` = 问了，没有人欠。 */
export type OwingRead = PartyOwing[] | null;

/**
 * 最多列几个。
 *
 * 八，不是全部：一个批发商可能有三百个赊帐的客人，而一段聊天里的三百行
 * 不是答案，是一份报告。八个够他认出前几名，而总数跟最久的那一个
 * 是分开算的，所以截断不会让任何一句变成假的。
 */
export const OWING_CAP = 8;

/** 名字读不到的时候印这个。**不是把那一行丢掉** ——
 *  丢掉一笔债只因为读不到名字，会让总数少一块，而那比一个占位的名字糟得多。 */
const UNNAMED = { zh: "（读不到名字）", en: "(name unreadable)" } as const;

/**
 * 读这一家的欠款，**走呼叫者自己的连线**。
 *
 * ⚠️ `role` 是传进来的，不是猜出来的。写成「零行就是没有人欠」在测试里
 * 会全绿，而在一个师傅面前会说谎 —— 见档头。
 *
 * ⚠️ 金额那两栏是 bigint。PostgREST 送过来是 JSON 数字，而一个 bigint
 * 在某些版本会变成字串，所以两种都收（`Number(...)`）。sen 不会大到
 * 掉精度，但**型别会**。
 */
export async function fetchPartyOwing(
  supabase: SupabaseClient,
  projectId: string,
  /* 🔴 `WorkspaceRole`，不是 `string`。第一版写 string，而这一支的呼叫端
     参数排在语言前面 —— 一个 "zh" 传进 role 会**编译得过**，然后一个师傅
     就拿到了他老板的欠款清单。型别是这里唯一挡得住位置写错的东西。 */
  role: WorkspaceRole,
  lang: "zh" | "en" = "en",
): Promise<OwingRead> {
  if (role !== "owner") return null;
  try {
    const { data, error } = await supabase.rpc("party_debts", { in_project_id: projectId });
    if (error) return null;

    const rows = (data ?? []) as {
      party_id: string;
      owed_cents: number | string | null;
      oldest_days: number | null;
      limit_cents: number | string | null;
    }[];
    if (!rows.length) return [];

    /* 名字是另一张表的事。`party_debts` 只回 id —— 它算的是钱，
       而钱那一层不该顺手把一整张名册也变成 security definer 的输出。 */
    const { data: nameRows } = await supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", projectId)
      .in(
        "id",
        rows.map((r) => r.party_id),
      );
    const byId = new Map(
      ((nameRows ?? []) as { id: string; name: string | null }[]).map((n) => [
        n.id,
        (n.name ?? "").trim(),
      ]),
    );

    return rows
      .map((r) => ({
        partyId: r.party_id,
        name: byId.get(r.party_id) || UNNAMED[lang],
        owedCents: Number(r.owed_cents ?? 0),
        oldestDays:
          typeof r.oldest_days === "number" && Number.isFinite(r.oldest_days)
            ? r.oldest_days
            : null,
        limitCents:
          r.limit_cents == null || r.limit_cents === "" ? null : Number(r.limit_cents),
      }))
      .filter((r) => Number.isFinite(r.owedCents) && r.owedCents > 0)
      .sort((a, b) => b.owedCents - a.owedCents);
  } catch {
    return null;
  }
}

/** 全部人加起来欠多少。**在截断之前算** —— 一个截断过的总数是错的。 */
export function owingTotalCents(rows: PartyOwing[]): number {
  return rows.reduce((sum, r) => sum + r.owedCents, 0);
}

/** 欠最久的那一个。同样在截断之前算 —— 见档头。 */
export function oldestOwing(rows: PartyOwing[]): PartyOwing | null {
  let worst: PartyOwing | null = null;
  for (const r of rows) {
    if (r.oldestDays == null) continue;
    if (!worst || r.oldestDays > (worst.oldestDays ?? -1)) worst = r;
  }
  return worst;
}

/** 超过他自己写的额度多少。没写额度、或者没超过，都是 null。 */
export function overLimitCents(row: PartyOwing): number | null {
  if (row.limitCents == null || !Number.isFinite(row.limitCents)) return null;
  const over = row.owedCents - row.limitCents;
  return over > 0 ? over : null;
}

const WORDS = {
  zh: {
    heading: "谁欠他钱（<n> 个，一共 <total>）",
    days: (n: number) => `欠了 ${n} 天`,
    over: (s: string) => `超过他写的额度 ${s}`,
    more: (n: number) => `还有 ${n} 个没列出来（上面只列欠最多的几个）`,
    oldest: "欠最久的",
    none: "没有人欠他钱 —— 每一张单都收齐了。",
  },
  en: {
    heading: "Who owes him money (<n> of them, <total> in total)",
    days: (n: number) => `${n} days outstanding`,
    over: (s: string) => `${s} over the limit he set`,
    more: (n: number) => `${n} more not listed (only the largest are above)`,
    oldest: "Owing longest",
    none: "Nobody owes him money — every document is settled.",
  },
} as const;

/**
 * 变成给模型看的那几行。
 *
 * ⚠️ 回的是**完整的行**，画面/提示词只负责印。意思属於这一层，
 * 跟 `record-copy` 同一条 —— 不然「欠了几天」会在两个地方各写一次，
 * 而这个仓库栽在「第二份手写拷贝」上至少五次。
 */
export function describeOwing(
  rows: OwingRead,
  lang: "zh" | "en",
  cap: number = OWING_CAP,
): string[] {
  if (rows == null) return [];
  const w = WORDS[lang];
  if (!rows.length) return [w.none];

  const total = ringgit(owingTotalCents(rows)) ?? "";
  const lines = [w.heading.replace("<n>", String(rows.length)).replace("<total>", total) + ":"];

  for (const r of rows.slice(0, cap)) {
    const bits = [r.name, ringgit(r.owedCents) ?? ""];
    if (r.oldestDays != null) bits.push(w.days(r.oldestDays));
    const over = overLimitCents(r);
    if (over != null) bits.push(w.over(ringgit(over) ?? ""));
    lines.push(`- ${bits.filter(Boolean).join(" · ")}`);
  }

  if (rows.length > cap) lines.push(`- ${w.more(rows.length - cap)}`);

  /* 🔴 从**全部**行里算，不是从上面印出来的那几行。
     欠 RM 300 欠了两年的那一个，正是他该打电话的人，而他排在第九。 */
  const old = oldestOwing(rows);
  if (old?.oldestDays != null) {
    lines.push(
      `- ${w.oldest}: ${old.name} ${ringgit(old.owedCents) ?? ""} · ${w.days(old.oldestDays)}`,
    );
  }

  return lines;
}
