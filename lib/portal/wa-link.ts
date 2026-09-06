/**
 * 他打进去的那串号码，变成一条打得开的 WhatsApp 连结。
 *
 * ── 为什么这一支要存在（2026-09-07）─────────────────────────────────────
 *
 * 两个地方各自在建 wa.me 连结，而两个都是 `replace(/[^\d]/g, "")` ——
 * 把「012-345 6789」变成 `0123456789`，**而 wa.me 打不开一个没有国码的号码**。
 * 一颗按下去开一张错误页的按钮，跟一颗按不动的按钮是同一件事。
 *
 * 一次是个案，两次才升级成一支（[任务 41](../../docs/founder-tasks.md#41)）——
 * 这是第二次。
 *
 * ── 🔴 认不出来就回 null，不猜 ─────────────────────────────────────────
 *
 * `123456789` 很可能是他漏打了开头那个 0，也可能是一个外国号码。
 * **猜错的代价是那句话发给另一个人**，而这个仓库为「靠猜省他的字」
 * 付过一次学费（[任务 89](../../docs/founder-tasks.md#89)：靠名字认人
 * 会把钱记到另一个人头上）。分不出来的时候不给按钮，然后讲出来。
 */

/** 马来西亚本地写法：`012-345 6789` · `+60 12-345 6789` · `60123456789`。 */
export function waNumber(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  /* `+` 只在最前面才算国码 —— 中间那些是分隔符。 */
  const plus = text.startsWith("+");
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;

  const full = plus
    ? digits
    : digits.startsWith("60")
      ? digits
      : digits.startsWith("0")
        ? `60${digits.slice(1)}`
        : /* 🔴 没有 0、没有 60、也没有 + —— 认不出来。见档头。 */
          null;
  if (!full) return null;

  /* 一支马来西亚手机是 60 ＋ 9 或 10 码。短到不可能是一支号码的，
     多半是他填了一半（「012」）——那种给按钮就是给一颗会失败的按钮。 */
  if (full.length < 10 || full.length > 15) return null;
  return full;
}

/** 那条连结。号码认不出来就是 null —— 呼叫端**不准**画那颗按钮。 */
export function waLink(
  raw: string | null | undefined,
  text?: string,
): string | null {
  const n = waNumber(raw);
  if (!n) return null;
  return text?.trim()
    ? `https://wa.me/${n}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${n}`;
}
