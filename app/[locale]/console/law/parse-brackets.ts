/**
 * 把一份官方的费率表，从他贴进来的那几行变成 `upsert_statutory_schedule`
 * 吃的那个阵列。
 *
 * ── 为什么是「贴一张表」不是「一格一格填」───────────────────────────────
 *
 * EPF 的第三附表实测 **Part A 397 格 · Part C 372 格 · Part E 379 格**
 * （20260904210000 的档头量的）。一个要人手打三百九十七格的画面
 * 不是一扇门，是一种惩罚（[重点 29](../../../../../docs/founder-points.md)）。
 * 他手上那份是 KWSP 的表格，所以这里吃的就是**那张表的形状**：
 * 四栏 —— 从 · 到 · 员工 · 雇主。
 *
 * ── 🔴 钱不碰浮点数 ─────────────────────────────────────────────────────
 *
 * `4,900.01` 不是 `parseFloat` 之后乘一百 —— 那会在某几格差一分，
 * 而这是一张法定的表。整数运算：小数点切开，右边补到两位。
 *
 * ── 一格是**金额**或者**千分比**，刚好一种 ───────────────────────────────
 *
 * 法律自己就是这个形状：RM20,000 以下是一张查找表（KWSP 明写
 * `not allowed to calculate ... based on exact percentage`），
 * 再上去才切回比例。所以表尾那一行在官方文件上长这样：
 *
 *     20,000.01                11%      12%
 *
 * —— 「到」那一格是空的（没有上限），后面两格带一个百分号。
 * **同一张贴上去的表就装得下它**，不用第二个表单。
 * `11%` → 千分比 110；`11.5%` → 115（资料库那一栏是整数千分比，
 * 理由写在 20260904210000：钱不准用浮点数算）。
 *
 * ── 🔴 一行读不懂就整份拒绝，不是跳过那一行 ──────────────────────────────
 *
 * 一份少了三格的法定表，`statutory_lookup` 到**算薪水那一刻**才会拒绝
 * （「the loaded table is incomplete」）—— 而那时候他已经在发薪的那一天了。
 * 在贴上去的这一刻拒绝，而且讲得出是**第几行**，便宜得多。
 *
 * ⚠️ 唯一一个例外是**开头那一行标题**：官方那张表上面就有一行
 * 「Wage from / to / Employee / Employer」，而它一个数字都没有。
 * 那一行会被跳过，**而且回传里会讲出来** —— 静静吃掉一行不行，
 * 那正是这一整支在防的东西。
 */

export type Bracket = {
  wage_from_cents: number;
  wage_to_cents: number | null;
  employee_cents?: number;
  employer_cents?: number;
  employee_permille?: number;
  employer_permille?: number;
};

export type ParseFail =
  /** 那一行不是四格。 */
  | { ok: false; why: "columns"; line: number; text: string; got: number }
  /** 有一格不是一个数字。 */
  | { ok: false; why: "number"; line: number; text: string; cell: string }
  /** 员工那一格是百分比而雇主那一格不是（或者反过来）。 */
  | { ok: false; why: "mixed"; line: number; text: string }
  /** 「到」比「从」小。 */
  | { ok: false; why: "span"; line: number; text: string }
  /** 一行都没有。 */
  | { ok: false; why: "empty"; line: 0; text: "" };

export type ParseOk = {
  ok: true;
  rows: Bracket[];
  /** 跳过了开头那一行标题。**讲出来**，不要静静吃掉。 */
  skippedHeading: string | null;
};

export type ParseResult = ParseOk | ParseFail;

/** 千分比那几行有几行 —— 画面上要讲，因为它跟其余的算法不一样。 */
export function permilleRows(rows: Bracket[]): number {
  return rows.filter((r) => r.employee_permille !== undefined).length;
}

/** `4,900.01` → 490001。整数运算，`decimals` 是右边留几位。 */
function toMinor(raw: string, decimals: number): number | null {
  const cleaned = raw
    .replace(/^RM/i, "")
    .replace(/[\s,]/g, "")
    .replace(/%$/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  /* 右边补到位数。多出来的位数**直接切掉**，不四舍五入 ——
     一张官方的表不会有第三位小数，而真的有的时候，
     一个被我们悄悄进位过的法定数字比一个拒绝糟。 */
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const n = Number(whole + padded);
  return Number.isSafeInteger(n) ? n : null;
}

const isRate = (cell: string) => cell.trim().endsWith("%");

export function parseBrackets(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l, i) => ({ n: i + 1, raw: l.trim() }))
    .filter((l) => l.raw.length > 0);

  if (lines.length === 0) return { ok: false, why: "empty", line: 0, text: "" };

  let skippedHeading: string | null = null;
  let body = lines;
  /* 一行数字都没有的第一行 = 官方那张表的标题。一个真的费率行永远有数字。 */
  if (!/\d/.test(lines[0].raw)) {
    skippedHeading = lines[0].raw;
    body = lines.slice(1);
    if (body.length === 0)
      return { ok: false, why: "empty", line: 0, text: "" };
  }

  const rows: Bracket[] = [];

  for (const { n, raw } of body) {
    /* 「RM」先整行拿掉 —— 从 PDF 复制出来常常是 `RM 550.00`，
       而那个空白会把一格切成两格。 */
    const line = raw.replace(/\bRM\s*/gi, "");

    /* 三种切法，由紧到松。逗号既是千分位也是栏位分隔，所以它排第二 ——
       `4,900.01<tab>5,000.00` 先中制表符那一条，切不出四格才退回逗号；
       都不成才照单一空白切（从 PDF 复制出来的那一种）。 */
    let cells = line.split(/\t|\s{2,}/).map((c) => c.trim());
    for (const by of [/,/, /\s+/]) {
      if (cells.length === 4) break;
      const tried = line
        .split(by)
        .map((c) => c.trim())
        .filter((c) => c !== "");
      if (tried.length === 4) cells = tried;
    }
    if (cells.length !== 4) {
      return {
        ok: false,
        why: "columns",
        line: n,
        text: raw,
        got: cells.length,
      };
    }

    const [fromCell, toCell, eeCell, erCell] = cells;

    const from = toMinor(fromCell, 2);
    if (from === null) {
      return { ok: false, why: "number", line: n, text: raw, cell: fromCell };
    }

    /* 空的 = 没有上限（表尾那一格）。 */
    const to = toCell === "" || toCell === "-" ? null : toMinor(toCell, 2);
    if (toCell !== "" && toCell !== "-" && to === null) {
      return { ok: false, why: "number", line: n, text: raw, cell: toCell };
    }
    if (to !== null && to < from) {
      return { ok: false, why: "span", line: n, text: raw };
    }

    /* 🔴 两格要嘛都是百分比，要嘛都不是。资料库那条约束
       （`statutory_brackets_one_kind`）本来就会拒绝，而在这里拒绝
       讲得出**第几行** —— 那是他要去改的那一行。 */
    if (isRate(eeCell) !== isRate(erCell)) {
      return { ok: false, why: "mixed", line: n, text: raw };
    }

    if (isRate(eeCell)) {
      /* 百分比 → 千分比。11% = 110，11.5% = 115。 */
      const ee = toMinor(eeCell, 1);
      const er = toMinor(erCell, 1);
      if (ee === null)
        return { ok: false, why: "number", line: n, text: raw, cell: eeCell };
      if (er === null)
        return { ok: false, why: "number", line: n, text: raw, cell: erCell };
      rows.push({
        wage_from_cents: from,
        wage_to_cents: to,
        employee_permille: ee,
        employer_permille: er,
      });
    } else {
      const ee = toMinor(eeCell, 2);
      const er = toMinor(erCell, 2);
      if (ee === null)
        return { ok: false, why: "number", line: n, text: raw, cell: eeCell };
      if (er === null)
        return { ok: false, why: "number", line: n, text: raw, cell: erCell };
      rows.push({
        wage_from_cents: from,
        wage_to_cents: to,
        employee_cents: ee,
        employer_cents: er,
      });
    }
  }

  return { ok: true, rows, skippedHeading };
}
