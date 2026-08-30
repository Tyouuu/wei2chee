/**
 * Where a photograph comes from when the owner has not taken one.
 *
 * ── THE DECISION THIS FILE ENCODES ────────────────────────────────────────
 *
 * The founder, 2026-08-26: 「不要自己養吧 我prefer就是如果那個圖庫好用 我們就用 然後
 * 用可以不滿意 可以再去圖庫推薦 也可以用ai 生成」.
 *
 * So: a library, with a way to say 「not this one」, and generation as a third
 * option. Not a library of our own.
 *
 * ── WHY PIXABAY AND NOT UNSPLASH ──────────────────────────────────────────
 *
 * The two have opposite rules and only one of them is safe for a page a real
 * business publishes. Read from their own documentation on 2026-08-26:
 *
 *   Unsplash  「we require the image URLs returned by the API to be directly
 *              used or embedded」 -- hotlinking is MANDATORY, self-hosting is
 *              not allowed.
 *   Pixabay   「permanent hotlinking of images (using Pixabay URLs in your app)
 *              is not allowed. If you intend to use the images, please
 *              download them to your server first.」
 *
 * Unsplash's rule means every customer's live website loads its hero from
 * Unsplash's CDN. One outage or one policy change there takes down the first
 * screen of every site we have ever published. Pixabay's rule is the one that
 * leaves us holding our own file.
 *
 * Openverse was checked too, because it needs no key and could therefore be
 * queried directly. The top five results for 「home renovation」 were
 * renovation-themed CUPCAKES and three photographs of a military exercise in
 * Bulgaria, licensed by-2.0 and by-sa-2.0 -- attribution required, share-alike
 * on one of them. A contractor's commercial site would have to carry a CC
 * notice. Ruled out on evidence.
 *
 * ── WHY A PROVIDER INTERFACE FOR ONE PROVIDER ─────────────────────────────
 *
 * Because the third option is AI generation, which answers the same question
 * with a different mechanism, and because the market's four approaches
 * (third-party stock, an own library, generation, resale) are all one
 * substitution away from each other. The seam is worth one type.
 */

import { isNotAPhotographOfABusiness } from "./photo-words";

export type StockPhoto = {
  /** Stable id from the provider, so 「show me more」 can exclude what was seen. */
  id: string;
  /** Small, for the picker grid. */
  thumb: string;
  /** The one that gets downloaded onto our own storage when chosen. */
  full: string;
  width: number;
  height: number;
  /** Who took it. Shown in the PICKER, which is where both libraries ask to be
   *  named. Pixabay: 「show your users where the images are from, whenever
   *  search results are displayed」. Pexels: 「whenever you are doing an API
   *  request make sure to show a prominent link to Pexels」. */
  credit: string;
  /**
   * The photo's own page on the provider.
   *
   * Only Pexels needs it, and it is the one obligation the two libraries do NOT
   * share: 「always credit our photographers when possible (e.g. "Photo by John
   * Doe on Pexels" with a link to the photo page on Pexels)」. Pixabay's licence
   * asks for nothing on the published page.
   *
   * So the provider has to travel WITH the photograph, not be assumed: a page
   * carrying one photo from each must credit one of them and not the other, and
   * guessing wrong is either a licence breach or a credit line on a
   * contractor's website that nobody asked for.
   */
  link?: string;
  provider: "pixabay" | "pexels";
  /**
   * What the library says this photograph is — Pixabay's `tags`, Pexels' `alt`.
   *
   * Carried through to the browser because it is the handle for 「像这张」: the
   * photograph the owner points at becomes the next search. See
   * lib/images/photo-words.ts, and 2026-08-28's measurements for why this beats
   * a blocklist at the question he actually asked.
   */
  tags: string;
};

export type StockResult =
  | { ok: true; photos: StockPhoto[] }
  /** No key configured. Not an error: the product works without one, the hero
   *  simply falls back to the figure it already draws. */
  | { ok: false; reason: "no-key" }
  | { ok: false; reason: "failed"; detail: string };

/**
 * What a trade should search for -- FOUR CANDIDATES, not one.
 *
 * ── WHY IT IS A LIST NOW ──────────────────────────────────────────────────
 *
 * It was one string per trade, written from a desk. On 2026-08-27, with a real
 * key, they were finally run and photographed (.screenshots/queries/):
 *
 *   renovation "renovation construction worker"  →  LEGO men and plastic
 *                                                   figurines, four of the
 *                                                   first six
 *   services   "plumber pipe repair"             →  a model posing in
 *                                                   dungarees beside a valve
 *   fnb        "restaurant kitchen chef"         →  a French chef in whites
 *
 * The old comment even states the mistake out loud: 「both lead with a person
 * at work, not with a finished room」. That is true of the two SITES and false
 * of the LIBRARY -- searching for a person at work is what returns figurines,
 * and what a homeowner is actually shopping for is the finished kitchen.
 *
 * ── WHY FOUR AND NOT A BETTER ONE ─────────────────────────────────────────
 *
 * No single string is right for a trade. 「services」 covers the aircond man and
 * the electrician, and their photographs share nothing. So the picker offers
 * these as chips the owner presses, first one first, and the search box stays.
 * The owner knows which of the four is their business; we do not.
 *
 * Ordered so the FIRST one is the one that came back best for this market --
 * 「asian food plate」 returns dim sum, curry and noodles where 「restaurant
 * kitchen chef」 returns a French kitchen.
 */
export const TRADE_QUERIES: Record<string, string[]> = {
  /* ── THE FIRST WORD IS THE WHOLE GAME, MEASURED 2026-08-28 ───────────────

     The founder asked whether the picker offers enough of the right kind of
     photograph. It was pulled and photographed: 1,278 results, 32 queries, the
     merged grid exactly as he sees it. Usable in the opening twelve:

         retail 12 · beauty 11 · fnb 11 · education 11 · other 9
         services 7 · wholesale 7 · renovation 5

     The four below were re-cut after looking at six candidate words each. The
     failures were never the LIBRARY, they were the WORD:

       tiles floor installation  → four fluorescent mosaic SWATCHES and a
                                   laundromat. 「floor tile」 is a materials
                                   photography subject.
       interior renovation work  → six of six: painters, dust sheets, rooms
                                   being skimmed. ← now first

       air conditioner technician → aircond units cut out on white, a car
                                    dashboard
       technician fixing appliance → six of six, and the most Asian faces
                                     anything here has returned ← now first

       warehouse shelves stock   → a share-price chart. 「stock」 is inventory
                                   AND the stock market, and the library cannot
                                   tell which one a wholesaler meant.
       distribution warehouse interior → six of six real warehouses ← now first

       small business shop       → a miniature model village
       shop owner counter        → six of six people behind their own counters
                                   ← now first

     The other four trades were looked at and left alone; 「asian food plate」
     is still the only word here that returns Malay curry instead of a French
     kitchen.

     WHAT WAS TRIED AND DID NOT WORK, so nobody spends the afternoon again:
     Pixabay's own `category` parameter (「industry」 gives motorbikes and boots
     for a tiler) and `editors_choice` (hot air balloons and aircraft for an
     aircond search). Both narrow the pool without improving it. */
  /* ⚠️ 装修这一行卖的是「做完长什么样」，不是「做的时候长什么样」。

     老板 2026-08-30，看着 台账 对 Newel 的对照图：「还是不能完整的复刻」。
     骨架已经对上了，而两页看起来还是两回事 —— 因为**照片是两种东西**：
     Newel 摆的是完工的厨房、浴室、卧室、客厅；我们摆的是钉在板上的工具、
     一面白砖墙、一间毛胚房。那不是版面，是**词**。

     实拍六个词各六张（任务 38b 的做法，只能用眼睛挑）：

       interior renovation work  → 油漆桶 · 刷子 · 壁虎 · 电锯 · 屋顶工人   ← 原本第一个
       renovated home interior   → 油漆盘 · 色卡 · 图纸                     ← 也是材料
       modern kitchen interior   → 六张全是完工的厨房                        ✓
       interior design living room → 六张全是完工的客厅                      ✓
       bathroom interior modern  → 六张全是完工的浴室                        ✓
       bedroom interior design   → 六张全是完工的卧室                        ✓

     四个完工的房间领头，正好也是他们那面作品墙的组成。施工中的照片留给
     客户自己打字 —— 一个装修承包商的作品墙上，屋主要看的是他家将来长什么样。 */
  renovation: ["modern kitchen interior", "interior design living room", "bathroom interior modern", "bedroom interior design"],
  services: ["technician fixing appliance", "air conditioner technician", "electrician working", "mechanic workshop"],
  retail: ["shop interior retail store", "shopfront street", "small shop counter", "product shelf display"],
  fnb: ["asian food plate", "coffee shop counter", "cafe interior table", "restaurant kitchen"],
  beauty: ["hair salon interior", "hairdresser cutting hair", "manicure nails", "spa massage room"],
  education: ["classroom tutor", "tuition teacher whiteboard", "student desk study", "books notebook study"],
  wholesale: ["distribution warehouse interior", "warehouse worker boxes", "forklift warehouse", "cartons pallet delivery"],
  other: ["shop owner counter", "local business storefront", "workshop craftsman", "small business shop"],
};

/** The opening guess -- the first candidate. Kept as its own export because
 *  the route wants one string and the picker wants the list. */
export const TRADE_QUERY: Record<string, string> = Object.fromEntries(
  Object.entries(TRADE_QUERIES).map(([k, v]) => [k, v[0]]),
);

const PIXABAY = "https://pixabay.com/api/";
const PEXELS = "https://api.pexels.com/v1/search";

/* A landing page hero is wide and large. Anything under this scales up badly on
   a retina phone, which is where most of these pages are read. */
const MIN_WIDTH = 1600;

async function searchPixabay(query: string, page: number): Promise<StockPhoto[] | null> {
  const key = process.env.PIXABAY_KEY;
  if (!key) return null;
  const url = new URL(PIXABAY);
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("min_width", String(MIN_WIDTH));
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  // Pixabay asks that responses be cached for 24 hours. Next's fetch cache does
  // it for us, keyed by the URL -- which includes the query and page, so two
  // businesses in the same trade share one upstream call.
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`pixabay HTTP ${res.status}`);
  const body = (await res.json()) as {
    hits?: { id: number; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number; user: string; tags?: string }[];
  };
  return (body.hits ?? []).map((h) => ({
    id: `pixabay:${h.id}`,
    thumb: h.webformatURL,
    full: h.largeImageURL,
    width: h.imageWidth,
    height: h.imageHeight,
    credit: h.user,
    provider: "pixabay" as const,
    tags: h.tags ?? "",
  }));
}

async function searchPexels(query: string, page: number): Promise<StockPhoto[] | null> {
  const key = process.env.PEXELS_KEY;
  if (!key) return null;
  const url = new URL(PEXELS);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));
  const res = await fetch(url, { headers: { Authorization: key }, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`pexels HTTP ${res.status}`);
  const body = (await res.json()) as {
    photos?: {
      id: number;
      width: number;
      height: number;
      url: string;
      photographer: string;
      alt?: string;
      src: { large: string; large2x: string; original: string };
    }[];
  };
  return (body.photos ?? [])
    /* Pixabay is filtered server-side by min_width; Pexels has no such
       parameter, so the same floor is applied here rather than left to differ
       between the two halves of one result grid. */
    .filter((p) => p.width >= MIN_WIDTH)
    .map((p) => ({
      id: `pexels:${p.id}`,
      thumb: p.src.large,
      full: p.src.original,
      width: p.width,
      height: p.height,
      credit: p.photographer,
      link: p.url,
      provider: "pexels" as const,
      tags: p.alt ?? "",
    }));
}

/**
 * Search the libraries — BOTH OF THEM, INTERLEAVED, ONE GRID.
 *
 * ── WHY MERGED AND NOT A SOURCE PICKER ────────────────────────────────────
 *
 * The founder, 2026-08-28: 「我可以不可以就是再另外接多几个免费的图库 这样就有很多
 * 图库 就增加找到心仪照片的机率」. The value he named is 「a better chance of
 * finding the one I want」, and that is a property of ONE grid with more in it.
 * A dropdown labelled 「source」 gives him the same photographs behind an extra
 * click and one more decision that is not his to make: nobody wants a photo
 * BECAUSE it is from Pexels.
 *
 * Interleaved rather than concatenated, so the second library is visible in the
 * first row rather than after twenty scrolls.
 *
 * One library failing is not a failure. Both are optional and either can be
 * down; what would be a failure is showing an error over a grid that has
 * twenty usable photographs in it.
 */
export async function searchStock(
  query: string,
  { page = 1, exclude = [] }: { page?: number; exclude?: string[] } = {},
): Promise<StockResult> {
  const [pix, pex] = await Promise.allSettled([searchPixabay(query, page), searchPexels(query, page)]);
  const got = (r: PromiseSettledResult<StockPhoto[] | null>) =>
    r.status === "fulfilled" ? r.value : null;
  const a = got(pix);
  const b = got(pex);

  if (a === null && b === null) {
    const why = [pix, pex]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason))
      .join(" · ");
    return why ? { ok: false, reason: "failed", detail: why } : { ok: false, reason: "no-key" };
  }

  const left = a ?? [];
  const right = b ?? [];
  const merged: StockPhoto[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (right[i]) merged.push(right[i]);
    if (left[i]) merged.push(left[i]);
  }

  /* ── ONE NARROW RULE, AND IT IS NOT A BLOCKLIST ──────────────────────────
     Renders, swatches, toys, cut-outs on white, and images the uploader
     declared were generated. 2.1% of 1,278 measured results, and the comment
     at the top of photo-words.ts records why the list stops there: widening it
     to catch the green mosaic swatches would have taken a mechanic lifting an
     engine and two women in a coffee shop with them. */
  const seen = new Set(exclude);
  return {
    ok: true,
    photos: merged.filter((p) => !seen.has(p.id) && !isNotAPhotographOfABusiness(p.tags)),
  };
}
