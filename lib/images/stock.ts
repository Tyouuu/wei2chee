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

export type StockPhoto = {
  /** Stable id from the provider, so 「show me more」 can exclude what was seen. */
  id: string;
  /** Small, for the picker grid. */
  thumb: string;
  /** The one that gets downloaded onto our own storage when chosen. */
  full: string;
  width: number;
  height: number;
  /** Who took it. Shown in the PICKER -- Pixabay asks for it there ("show your
   *  users where the images are from, whenever search results are displayed")
   *  -- and not on the published page, which their licence does not require. */
  credit: string;
  provider: "pixabay";
};

export type StockResult =
  | { ok: true; photos: StockPhoto[] }
  /** No key configured. Not an error: the product works without one, the hero
   *  simply falls back to the figure it already draws. */
  | { ok: false; reason: "no-key" }
  | { ok: false; reason: "failed"; detail: string };

/** What a trade should search for, when the owner has not typed anything.
 *
 *  Written per industry rather than passing the trade name straight through:
 *  「装修/承包商」 is not an image search, and the English name of a trade is
 *  not always what photographers tag. Measured against the two Malaysian trade
 *  sites this was designed from -- both lead with a person at work, not with a
 *  finished room. */
export const TRADE_QUERY: Record<string, string> = {
  renovation: "renovation construction worker",
  services: "technician repair service",
  retail: "small shop counter",
  fnb: "restaurant kitchen chef",
  beauty: "hair salon interior",
  education: "classroom tutor",
  wholesale: "warehouse boxes logistics",
};

const ENDPOINT = "https://pixabay.com/api/";

/**
 * Search the library.
 *
 * `exclude` carries the ids already shown, which is how 「不滿意 可以再去圖庫推薦」
 * works without a cursor: the caller keeps asking for the next page and drops
 * what it has seen. Pixabay pages are 20 wide and stable for a query, so this
 * is cheaper and more predictable than re-randomising.
 */
export async function searchStock(
  query: string,
  { page = 1, exclude = [] }: { page?: number; exclude?: string[] } = {},
): Promise<StockResult> {
  const key = process.env.PIXABAY_KEY;
  if (!key) return { ok: false, reason: "no-key" };

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  // A landing page hero is wide and large. Anything under this scales up badly
  // on a retina phone, which is where most of these pages are read.
  url.searchParams.set("min_width", "1600");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", String(page));

  try {
    // Pixabay asks that responses be cached for 24 hours. Next's fetch cache
    // does it for us, keyed by the URL -- which includes the query and page, so
    // two businesses in the same trade share one upstream call.
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return { ok: false, reason: "failed", detail: `HTTP ${res.status}` };
    const body = (await res.json()) as {
      hits?: {
        id: number;
        webformatURL: string;
        largeImageURL: string;
        imageWidth: number;
        imageHeight: number;
        user: string;
      }[];
    };
    const seen = new Set(exclude);
    const photos = (body.hits ?? [])
      .map((h) => ({
        id: String(h.id),
        thumb: h.webformatURL,
        full: h.largeImageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        credit: h.user,
        provider: "pixabay" as const,
      }))
      .filter((p) => !seen.has(p.id));
    return { ok: true, photos };
  } catch (e) {
    return { ok: false, reason: "failed", detail: e instanceof Error ? e.message : "unknown" };
  }
}
