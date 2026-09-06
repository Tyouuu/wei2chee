import { ImageResponse } from "next/og";

/**
 * The card a WhatsApp/Telegram/LinkedIn link unfurls into.
 *
 * Generated rather than designed as a static file, for one practical reason:
 * it has to say the same thing in two languages, and keeping two hand-made
 * PNGs in sync with copy that is still moving is how they end up contradicting
 * the page. This renders from the same words, at request time.
 *
 * THE FONT IS THE WHOLE DIFFICULTY. Satori (what `ImageResponse` runs on) has
 * no CJK glyphs built in, so a Chinese headline renders as a row of tofu boxes
 * — which is worse than no card at all. A full Noto Sans SC is multiple
 * megabytes and cannot be shipped to an edge renderer. The fix is Google's own
 * `text=` parameter, which returns a font subset containing ONLY the glyphs
 * asked for: the request below is a few kilobytes. The archaic User-Agent is
 * deliberate too — Google serves WOFF2 to modern clients and Satori cannot
 * read WOFF2, so the request pretends to be an old Safari to be handed WOFF.
 */

export const alt = "Formae";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COPY = {
  zh: {
    eyebrow: "FORMAE / SYS.DESIGN",
    headline: "先看到你的系统，再决定要不要做。",
    sub: "回答几个问题，当场看到一套照你流程做的系统。",
    /* ⚠️ 2026-09-06 换成**建置 RM 1,500 ＋ 年费 RM 1,500** ——
       老板看着需求书上那张按模块算的表：`都不要了 跟著新概念`
       （[任务 109](../../docs/founder-tasks.md#109) 9-03 就换了概念，
       而这张卡跟官网印了三天上一套）。
       作废掉的那几个数字**故意不写在这里** —— `pricing-consistency.test.ts`
       会在每一个客户看得到的档案里搜它们，注解也算，写了这条就红。
       **这张卡是别人把连结贴进 WhatsApp 时跳出来的那张图** ——
       在这个市场 WhatsApp 就是通路，所以它比官网还早被看到。
       改一个价钱要改四个地方（官网 · 登入页 · 需求书 · 这张卡），
       2026-08-25 那次前三个改了、这一个没有 —— 因为它不是「一页」，
       没有人会走到它。`pricing-consistency.test.ts` 现在盯着它。 */
    facts: ["建置 RM 1,500", "之后每年 RM 1,500", "设计阶段免费"],
  },
  en: {
    eyebrow: "FORMAE / SYS.DESIGN",
    headline: "See your system before you decide to build it.",
    sub: "Answer a few questions and watch a system built around your own workflow appear.",
    facts: ["Build RM 1,500", "RM 1,500 a year after", "Designing is free"],
  },
} as const;

/** Fetches a subset of Noto Sans SC covering exactly `text`. Returns null on
 *  any failure — a card in the fallback Latin face is a degraded card; a
 *  thrown error is no card, and the route is on the critical path for every
 *  link the founder sends. */
async function cjkSubset(text: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const url =
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@${weight}` +
      `&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30",
      },
    }).then((r) => r.text());
    const src = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
    if (!src) return null;
    return await fetch(src).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = locale === "en" ? COPY.en : COPY.zh;

  const heavy = c.headline;
  const light = c.sub + c.facts.join("");
  const [bold, regular] = await Promise.all([cjkSubset(heavy, 700), cjkSubset(light, 400)]);

  const fonts = [
    bold && { name: "NotoSC", data: bold, weight: 700 as const, style: "normal" as const },
    regular && { name: "NotoSC", data: regular, weight: 400 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#0a1020",
          // One lit corner rather than a flat ground — the same atmospheric
          // move the Hero makes, reduced to what a 1200x630 still can carry.
          backgroundImage:
            "radial-gradient(900px 520px at 78% 8%, rgba(34,97,221,0.42), rgba(10,16,32,0) 70%)",
          fontFamily: "NotoSC, sans-serif",
          color: "#e8eef9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              backgroundColor: "#7fa8f7",
              color: "#0a1020",
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 19, letterSpacing: 4, color: "#7fa8f7" }}>{c.eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: locale === "en" ? 68 : 76,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: locale === "en" ? -1.5 : 0,
              maxWidth: 1000,
            }}
          >
            {c.headline}
          </div>
          <div style={{ marginTop: 26, fontSize: 30, lineHeight: 1.45, color: "#9cabc4", maxWidth: 880 }}>
            {c.sub}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {c.facts.map((f, i) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {i > 0 && <div style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: "#3a4a66" }} />}
              <div style={{ fontSize: 25, color: i === 2 ? "#7fa8f7" : "#c3cede" }}>{f}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
