import { todayMYT } from "@/lib/portal/record-validity";

/**
 * 一张收据的照片，读成一笔开销的几格字。
 *
 * ── 这个档案是「意思」，不是「呼叫」 ──────────────────────────────────────
 *
 * 呼叫模型那一段在 `app/api/receipt/route.ts`。**读出来之后信不信它，
 * 在这里** —— 因为那是可以在没有模型、没有网路、每次结果一样的情况下
 * 测得出来的部分，而模型那一端不是。
 *
 * ── 🔴 它永远不会替他写进帐 ──────────────────────────────────────────────
 *
 * 这条线到「几格填好的字」为止。按下保存的还是他，走的还是
 * `add_ledger_entry` —— 人按的那一支（[重点 23] AI 平权：不准有 AI 专用的
 * 写入路径）。
 *
 * 理由不是洁癖：**一个没有人读过的数字进了他的帐，是他月底才会发现的错**，
 * 而这本帐会被拿去报税。模型读错一个小数点，跟一个自动写入的路径加在一起，
 * 就是一笔他从来没看过的钱。
 *
 * ── 🔴 三条「宁可空着」，每一条都有一个具体的错在后面 ──────────────────
 *
 * 1. **金额读不到就是 null**，不是 0。一笔 RM 0 的开销看起来像一笔真的
 *    开销，而一个空格看起来像一个空格。
 * 2. **日期不准是未来**。一张未来的收据不存在 —— 那是把 `03/09` 读成
 *    `09/03` 或者把年份看错。未来的日期一律丢掉并且讲出来。
 * 3. **类别只能从他自己用过的词里挑**。20260904200000 立过这一条：
 *    下拉里只有他打过的词，因为「没有量过的行业就不建议」。
 *    模型发明一个「Office Supplies」出来，等於我们替他开了一个
 *    他从来没有同意过的科目表。
 */

/** 他的系统在讲哪一种话。跟 `system_language` 同一个值。 */
export type ReceiptLang = "zh" | "en";

/** 模型被允许回的形状。null 的意思一律是「读不到」，never「没有」。 */
export type ReceiptRaw = {
  vendor: string | null;
  entry_on: string | null;
  total_sen: number | null;
  category: string | null;
  note: string | null;
  /** 模型自己讲的那一句「我为什么读不到」。空字串＝没话讲。 */
  trouble: string;
};

/** 我们不信它的那几种理由。UI 只印，不判。 */
export type ReceiptTrouble =
  | "no-total"
  | "bad-date"
  | "future-date"
  | "unknown-category"
  | "no-vendor";

export type ReceiptDraft = {
  /** 供应商，落在 `party`。 */
  party: string;
  /** 买了什么，落在 `note`。 */
  note: string;
  /** 收据上那个日期，`YYYY-MM-DD`。读不到就是空字串。 */
  entryOn: string;
  /** 令吉，给输入框用的字串（`12.50`）。读不到就是空字串。 */
  amount: string;
  /** 他自己用过的那个词，或者空字串。 */
  category: string;
  /** 我们丢掉了什么，为什么。**空阵列不等於读得完美** —— 见 `trouble`。 */
  troubles: ReceiptTrouble[];
  /** 模型自己那一句。可能是空的。 */
  said: string;
};

/**
 * ⚠️ 这几句是**给老板看的**，所以两种语言都要有，而且不准跨语言凑合
 * （[重点 13]）。写成一张表而不是在 UI 那边拼，理由跟 `record-copy.ts`
 * 一样：意思属於这一层，画面只负责印。
 */
export const RECEIPT_TROUBLE_COPY: Record<ReceiptLang, Record<ReceiptTrouble, string>> = {
  zh: {
    "no-total": "这张照片上的金额看不清楚，要你自己填。",
    "bad-date": "日期看不清楚，要你自己填。",
    "future-date": "读到的日期在今天之后，多半是看错了 —— 要你自己填。",
    "unknown-category": "看不出这算你哪一类开销，要你自己挑。",
    "no-vendor": "看不出是哪一家店，要你自己填。",
  },
  en: {
    "no-total": "The amount is not readable on this photo — type it in.",
    "bad-date": "The date is not readable — type it in.",
    "future-date": "The date read as later than today, which is almost certainly a misread — type it in.",
    "unknown-category": "It is not clear which of your expense words this is — pick one.",
    "no-vendor": "It is not clear which shop this is from — type it in.",
  },
};

/** 一张收据上的字。太长的一律截短，而不是拒绝 —— 截短的还看得懂。 */
const MAX_PARTY = 120;
const MAX_NOTE = 120;
const MAX_SAID = 160;

/**
 * 模型只准回这个形状。
 *
 * ⚠️ `strict` 要求每一格都是 required，所以「读不到」是用 `null` 表达的，
 * 不是用「不回那一格」。这一点跟 `analysis-schema` 同一个做法。
 */
export const receiptJsonSchema = {
  name: "receipt",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["vendor", "entry_on", "total_sen", "category", "note", "trouble"],
    properties: {
      vendor: {
        type: ["string", "null"],
        description: "The shop or supplier name exactly as printed. null if it cannot be read.",
      },
      entry_on: {
        type: ["string", "null"],
        description: "The date on the receipt as YYYY-MM-DD. null if it cannot be read.",
      },
      total_sen: {
        type: ["integer", "null"],
        description:
          "The final amount payable, in SEN (cents). RM 12.50 is 1250. null if it cannot be read.",
      },
      category: {
        type: ["string", "null"],
        description:
          "One of the owner's own expense words, copied exactly. null if none of them fits.",
      },
      note: {
        type: ["string", "null"],
        description: "A short line saying what was bought, in the system's language.",
      },
      trouble: {
        type: "string",
        description:
          "One short sentence about what could not be read, or an empty string when everything was legible.",
      },
    },
  },
} as const;

/**
 * 给模型的那一段话。
 *
 * ⚠️ **他自己用过的类别是传进去的，不是写死的**。所以第一次用的时候那份
 * 清单是空的，而模型会正确地回 null —— 那是诚实的，不是坏掉的。
 */
export function buildReceiptPrompt(opts: {
  categories: string[];
  language: ReceiptLang;
  today?: string;
}): string {
  const today = opts.today ?? todayMYT();
  const cats = opts.categories.map((c) => c.trim()).filter(Boolean);
  return [
    "You read one photograph of a receipt or a bank transfer slip from a small business in Malaysia, and return the few fields its owner would otherwise type by hand.",
    "",
    "NEVER INVENT. Every field you cannot actually read on the image is null. A guessed figure entering this man's books is worse than an empty box, because he will not know it was guessed.",
    "",
    "THE AMOUNT is the final amount payable — the line printed as TOTAL, JUMLAH, GRAND TOTAL, AMOUNT DUE or 合计. Not the subtotal, not the cash tendered, not the change. Return it in SEN: RM 12.50 is 1250, RM 1,204.00 is 120400. If several totals are printed and you cannot tell which is final, return null.",
    "",
    "THE DATE. This market writes the day first: 03/09/2026 is 3 September 2026, and 12/11/2026 is 12 November 2026. Use day-first even when the number could be read either way — that is the convention here, not a guess. Return YYYY-MM-DD.",
    `Today is ${today}. A receipt cannot be dated later than today; if what you read comes out later than that, you have misread it — return null.`,
    "",
    "THE SHOP is the name printed at the top, as printed. Do not tidy it, do not expand it, do not translate it.",
    "",
    cats.length
      ? [
          "THE CATEGORY must be copied EXACTLY from this list, which is the owner's own vocabulary:",
          ...cats.map((c) => `  - ${c}`),
          "If none of them fits what was bought, return null. Never write a word that is not on that list.",
        ].join("\n")
      : "THE CATEGORY: this owner has not used any expense words yet, so return null.",
    "",
    opts.language === "zh"
      ? "THE NOTE is one short line in Chinese saying what was bought (e.g. 「水泥 5 包」). Keep it under 20 characters."
      : "THE NOTE is one short line in English saying what was bought (e.g. \"Cement, 5 bags\"). Keep it under 40 characters.",
    "",
    "TROUBLE is one short sentence naming what defeated you — a blurred total, a torn corner, a language you cannot read. An empty string when the whole receipt was legible. Do not apologise and do not explain what you did read.",
  ].join("\n");
}

/** `1250` → `"12.50"`。给输入框，所以是字串不是数字。 */
function senToRinggit(sen: number): string {
  const neg = sen < 0;
  const abs = Math.abs(Math.trunc(sen));
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` 而且是真的一天。**不经过 `new Date()`** —— 伺服器跑 UTC，
 *  而一个用 UTC 解出来的日子在马来西亚是前一天。 */
function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= days;
}

/**
 * 模型回的那一坨 → 他要确认的那几格。
 *
 * **这一支是这个档案存在的理由**：它是「我们信它多少」写成的代码，
 * 而且每一条都测得出来。
 */
export function toReceiptDraft(
  raw: ReceiptRaw,
  opts: { categories: string[]; today?: string },
): ReceiptDraft {
  const today = opts.today ?? todayMYT();
  const troubles: ReceiptTrouble[] = [];

  const party = (raw.vendor ?? "").trim().slice(0, MAX_PARTY);
  if (!party) troubles.push("no-vendor");

  const note = (raw.note ?? "").trim().slice(0, MAX_NOTE);

  /* 金额：**大於零的整数才算**。0 跟负数都不是一张收据上会有的东西，
     而 0 特别危险 —— 它看起来像一笔真的、金额为零的开销。 */
  let amount = "";
  const sen = raw.total_sen;
  if (typeof sen === "number" && Number.isFinite(sen) && Number.isInteger(sen) && sen > 0) {
    amount = senToRinggit(sen);
  } else {
    troubles.push("no-total");
  }

  /* 日期：读得出来、是真的一天、而且不在今天之后。 */
  let entryOn = "";
  const dateText = (raw.entry_on ?? "").trim();
  if (!dateText || !isRealDate(dateText)) {
    troubles.push("bad-date");
  } else if (dateText > today) {
    /* 字串比字串就够了 —— `YYYY-MM-DD` 的字典序就是时间序，
       而这样不用碰任何时区。 */
    troubles.push("future-date");
  } else {
    entryOn = dateText;
  }

  /* 类别：**只能是他自己用过的词**。比对的时候两边都收头尾空白、
     不分大小写 —— 模型把「材料」抄成「材料 」是抄对了，
     而把「Materials」写成「Material」是发明。 */
  let category = "";
  const guess = (raw.category ?? "").trim();
  if (guess) {
    const hit = opts.categories.find(
      (c) => c.trim().toLowerCase() === guess.toLowerCase(),
    );
    if (hit) category = hit.trim();
    else troubles.push("unknown-category");
  }

  return {
    party,
    note,
    entryOn,
    amount,
    category,
    troubles,
    said: (raw.trouble ?? "").trim().slice(0, MAX_SAID),
  };
}

/** 把 `troubles` 变成他读得懂的几句话。UI 只印这个。 */
export function receiptTroubleLines(
  draft: ReceiptDraft,
  language: ReceiptLang,
): string[] {
  const copy = RECEIPT_TROUBLE_COPY[language];
  return draft.troubles.map((t) => copy[t]);
}
