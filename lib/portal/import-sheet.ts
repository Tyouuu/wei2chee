/**
 * 把他从 Excel 复製出来的那一块，变成一份看得懂的清单。
 *
 * ── 为什么是「贴上」而不是「选档案」 ──────────────────────────────────────
 *
 * 他的客户名单**在一个开着的 Excel 里**。选档案要他先另存成 CSV、
 * 记得存在哪、再找回来 —— 三步，每一步都可以出错。
 * 圈起来、Ctrl-C、贴进去，是一步。
 *
 * ⚠️ 而从 Excel 贴出来的是 **tab** 分隔的，不是逗号 —— 一支只认逗号的
 * 剖析器会把整行当成一栏，然后画面上一片空白而它不会讲为什么。
 * 所以分隔符是**数出来的**，不是问他的。
 *
 * ── 只进新的，不更新旧的 ──────────────────────────────────────────────────
 *
 * Frappe 的 Data Import 有 `Update Existing`。不抄 ——
 * 用一份贴上去的表更新既有的五百行，是把五百行静静盖掉的方法。
 *
 * ── 认栏位：他的字，不是我们的 ────────────────────────────────────────────
 *
 * 表头对上的是**那一页自己的栏名**（一个车厂的第一栏叫「车牌号」）。
 * 对不上的表头**不猜**，列出来告诉他哪几栏我们没认得 ——
 * 猜错一栏，五百行的电话会存进备注，而他要下个月才发现。
 */

export type SheetColumn = {
  /** 送进资料库的键：title · party · amount_cents · name · phone… */
  key: string;
  /** 画面上那一页自己的字。 */
  label: string;
};

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
  /** 数出来的那一个。印给他看，因为它错的时候整份都错。 */
  delimiter: "tab" | "comma" | "semicolon";
};

/**
 * 数出来，不要问他。
 *
 * 拿前几行数每一种分隔符出现几次，**取每行数量最一致的那一个** ——
 * 不是最多的：一段地址里的逗号可以比 tab 多，而它每一行的个数不一样。
 */
export function sniffDelimiter(text: string): ParsedSheet["delimiter"] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  if (lines.length === 0) return "comma";
  const score = (ch: string) => {
    const counts = lines.map((l) => l.split(ch).length - 1);
    if (counts.every((c) => c === 0)) return -1;
    const first = counts[0];
    /* 每一行都一样多才算数。一致才是分隔符，多不是。 */
    const consistent = counts.every((c) => c === first);
    return consistent ? first * 10 : first;
  };
  const t = score("\t");
  const c = score(",");
  const sc = score(";");
  if (t >= c && t >= sc && t > 0) return "tab";
  if (sc > c && sc > 0) return "semicolon";
  return "comma";
}

const CHAR: Record<ParsedSheet["delimiter"], string> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
};

/** 一行切开。引号里的分隔符不算 —— 「Lot 42, Jalan Kebun」是一栏。 */
function splitLine(line: string, ch: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      /* 引号里的两个引号是一个引号（CSV 的规矩）。 */
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === ch && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseSheet(text: string): ParsedSheet {
  const delimiter = sniffDelimiter(text);
  const ch = CHAR[delimiter];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], delimiter };
  const headers = splitLine(lines[0], ch);
  const rows = lines.slice(1).map((l) => splitLine(l, ch));
  return { headers, rows, delimiter };
}

export type Mapping = {
  /** 表头 → 那一栏的键。认不出来的不在这里。 */
  byIndex: (string | null)[];
  /** 认不出来的那几个表头，原样列给他看。 */
  unmatched: string[];
  /** 一栏都没认出来 —— 多半是他贴错了东西，或者第一行不是表头。 */
  nothingMatched: boolean;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_·:：()（）]/g, "");

export function mapHeaders(headers: readonly string[], columns: readonly SheetColumn[]): Mapping {
  const byLabel = new Map<string, string>();
  for (const c of columns) {
    byLabel.set(norm(c.label), c.key);
    /* 键本身也认，因为我们给他的范本表头就是他的字，
       但一份别人给他的 CSV 可能写的是英文键。 */
    byLabel.set(norm(c.key), c.key);
  }
  const byIndex = headers.map((h) => byLabel.get(norm(h)) ?? null);
  return {
    byIndex,
    unmatched: headers.filter((_, i) => byIndex[i] == null),
    nothingMatched: byIndex.every((x) => x == null),
  };
}

/** 「RM 48,500」「48500.50」→ sen。空的回 null，不是 0 —— 那两件事不一样。 */
export function senOfCell(text: string): number | null {
  const m = (text ?? "").replace(/[, ]/g, "").match(/-?\d+(\.\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** 「2026-09-04」「4/9/2026」「2026/9/4」→ ISO。认不出来回 null。 */
export function dateOfCell(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  /* 🔴 日/月/年，**不是**月/日/年。马来西亚写的是 4/9/2026 = 九月四号，
     而美式读法会把它读成四月九号 —— 一个读起来完全正常的错误日期。 */
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const MONEY_KEYS = new Set(["amount_cents"]);
const DATE_KEYS = new Set(["issued_on", "due_on", "entry_on"]);

/**
 * 一行变成送得进去的形状。
 *
 * @param ownKeys 这一页自己加的那几栏（车牌号…）。它们进 `extra`。
 */
export function rowToRecord(
  cells: readonly string[],
  mapping: Mapping,
  ownKeys: ReadonlySet<string>,
  idempotencyKey?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const extra: Record<string, string> = {};
  mapping.byIndex.forEach((key, i) => {
    if (!key) return;
    const raw = (cells[i] ?? "").trim();
    if (!raw) return;
    if (MONEY_KEYS.has(key)) {
      const sen = senOfCell(raw);
      if (sen != null) out[key] = String(sen);
      return;
    }
    if (DATE_KEYS.has(key)) {
      const iso = dateOfCell(raw);
      if (iso) out[key] = iso;
      return;
    }
    if (ownKeys.has(key)) {
      extra[key] = raw;
      return;
    }
    out[key] = raw;
  });
  if (Object.keys(extra).length) out.extra = extra;
  if (idempotencyKey) out.idempotency_key = idempotencyKey;
  return out;
}

/** 一行有没有东西。整行都空的不送 —— 从 Excel 贴出来常常带几行空的。 */
export function rowHasSomething(cells: readonly string[]): boolean {
  return cells.some((c) => (c ?? "").trim() !== "");
}

/**
 * 每一行自己的防重复钥匙。
 *
 * ── 🔴 为什么它必须从**贴上去的那份内容**算出来 ──────────────────────────
 *
 * 手机上网路慢，他会按两次「汇入」。要让第二次一行都不重复，那把钥匙
 * 就要**两次算出来一样** —— 所以它不可以是随机的。
 *
 * 而它也不可以只从「这一行的内容」算：同一份表里两笔一模一样的单
 * （同一个客户、同一个金额，真的会发生）会变成同一把钥匙，第二笔就进不去了。
 *
 * 所以是**整份内容 ＋ 行号**：
 *   · 同一份贴上去按两次 → 一样的钥匙 → 第二次一行都不进（对）
 *   · 同一份里两笔一模一样的行 → 行号不同 → 两笔都进（对）
 *   · 另一份表 → 另一个雜凑 → 不会撞到上一份（对）
 *
 * ⚠️ 我第一版是 `randomUUID().slice(0,24) + "-" + 行号`，而那**不是一个
 * 合法的 uuid** —— 资料库整批拒绝，四行一行都没进去。
 * 抓到它的是那张「哪几行没进去、为什么」的清单，它一行一行印着
 * `invalid input syntax for type uuid`。**那张清单第一次派上用场，
 * 是用来指出写它的人自己的错。**
 */
export function keyForRow(sheetText: string, index: number): string {
  /* 四个不同种子的 FNV-1a，凑成 128 bit。够不够：两份不同的表要在
     128 bit 上撞在一起，才会让第二份的某一行被当成已经进过。 */
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < sheetText.length; i++) {
      h ^= sheetText.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  const a = hex(fnv(0x811c9dc5));
  const b = hex(fnv(0x1000193));
  const c = hex(fnv(sheetText.length + 7));
  /* 尾巴那 12 位放行号，所以同一份表的每一行都不一样。
     超过 2^48 行的表不存在。 */
  const tail = index.toString(16).padStart(12, "0").slice(-12);
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${tail}`;
}
