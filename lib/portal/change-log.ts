/**
 * 把「谁改了什么」翻成他读得懂的一句话。
 *
 * ── 为什么翻译在这里，不在资料库里 ────────────────────────────────────────
 *
 * `record_changes` 存的是**栏位名**（`amount_cents`）跟**原始值**（`4800000`）。
 * 存一份翻好的字，等於把两种语言冻进一张只会变长、而且永远不准改的表 ——
 * 他哪天把系统语言从中文换成英文，去年那几行还是中文的。
 *
 * ── 🔴 一栏一句话，而且是那一页自己的词 ──────────────────────────────────
 *
 * 「金额」在报价单上是金额，在收款上是收了多少 —— 而那一页的栏名本来就
 * 挂在那张表上（`table-model`）。所以这里收一份 `labels`，讲不出来的
 * 才退回通用的那几个字。
 *
 * ── 时间不写「三分钟前」 ──────────────────────────────────────────────────
 *
 * 相对时间要每一秒重算，而这一段是伺服器画出来的 —— 「三分钟前」会在
 * 页面开着的时候慢慢变成一句假话。写日期跟时分，马来西亚时间。
 */

export type ChangeRow = {
  id: string;
  entity: "pipeline" | "directory" | "ledger" | "appointment";
  entityId: string;
  label: string;
  field: string;
  was: string | null;
  nowIs: string | null;
  changedBy: string | null;
  createdAt: string;
};

/** 通用的那几个字。那一页自己的栏名讲得出来的，优先用它的。 */
const FIELD_WORDS: Record<"zh" | "en", Record<string, string>> = {
  zh: {
    title: "名称",
    party: "对方",
    amount_cents: "金额",
    stage: "进度",
    due_on: "日期",
    site_address_id: "工地",
    name: "名字",
    phone: "电话",
    whatsapp: "WhatsApp",
    email: "Email",
    status: "状态",
    entry_on: "日期",
    note: "备注",
    deleted: "删掉了",
    starts_at: "预约时间",
    staff_id: "谁做",
  },
  en: {
    title: "Name",
    party: "Who it is with",
    amount_cents: "Amount",
    stage: "Stage",
    due_on: "Date",
    site_address_id: "Site",
    name: "Name",
    phone: "Phone",
    whatsapp: "WhatsApp",
    email: "Email",
    status: "Status",
    entry_on: "Date",
    note: "Note",
    deleted: "Deleted",
    starts_at: "Appointment time",
    staff_id: "Who's doing it",
  },
};

/** sen 的那几栏。存的是 `4800000`，而他读的是 RM 48,000。 */
const MONEY_FIELDS = new Set(["amount_cents"]);

function ringgitFromSen(text: string): string {
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  const whole = n / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * 一个值画出来长什么样。
 *
 * ⚠️ null 跟空字串**分开讲**：「本来没有」跟「本来是空白」在他眼里
 * 不是同一件事，而这本帐存在就是为了答这一类问题。
 */
export function showValue(field: string, raw: string | null, blank: string): string {
  if (raw == null || raw === "") return blank;
  if (MONEY_FIELDS.has(field)) return ringgitFromSen(raw);
  /* 工地跟师傅存的是别的表的 id。翻不成人话 —— 而印一串 uuid 给他看
     比印「换了一个工地／师傅」糟得多。谁改成谁,要那一页自己查得到
     名字才印(见 showChanges 的 names 参数),这里没有 DB 可查。 */
  if (field === "site_address_id" || field === "staff_id") return "—";
  /* 预约时间存的是完整的 ISO 时间戳,这里能直接解出人看得懂的样子,
     不用像 staff_id 那样退回「—」。 */
  if (field === "starts_at") return whenInMalaysia(raw);
  return raw;
}

export function fieldWord(
  field: string,
  lang: "zh" | "en",
  labels?: Readonly<Record<string, string>>,
): string {
  return labels?.[field] ?? FIELD_WORDS[lang][field] ?? field;
}

/** 2026-09-04 14:32，马来西亚时间。见档头：不写「三分钟前」。 */
export function whenInMalaysia(iso: string): string {
  const got = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const at = (t: string) => got.find((x) => x.type === t)?.value ?? "";
  const hour = at("hour") === "24" ? "00" : at("hour");
  return `${at("year")}-${at("month")}-${at("day")} ${hour}:${at("minute")}`;
}

export type ShownChange = {
  id: string;
  when: string;
  /** 「金额」「进度」，或者那一页自己的词。 */
  what: string;
  was: string;
  nowIs: string;
  /** 删掉那一行是一句完整的话，没有「从 A 变成 B」。 */
  isDelete: boolean;
  /** 谁。讲不出名字的时候是空的 —— 印一串 uuid 比留白糟。 */
  who: string;
};

export function showChanges(
  rows: readonly ChangeRow[],
  opts: {
    lang: "zh" | "en";
    blank: string;
    /** 那一页自己的栏名。 */
    labels?: Readonly<Record<string, string>>;
    /** user id → 他叫什么。查不到就留白。 */
    names?: Readonly<Record<string, string>>;
  },
): ShownChange[] {
  return rows.map((r) => ({
    id: r.id,
    when: whenInMalaysia(r.createdAt),
    what: fieldWord(r.field, opts.lang, opts.labels),
    was: showValue(r.field, r.was, opts.blank),
    nowIs: showValue(r.field, r.nowIs, opts.blank),
    isDelete: r.field === "deleted",
    who: (r.changedBy && opts.names?.[r.changedBy]) || "",
  }));
}
