import { NextResponse } from "next/server";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { searchStock, TRADE_QUERY, TRADE_QUERIES } from "@/lib/images/stock";

/**
 * The three ways a photograph gets onto a customer's page.
 *
 * GET   — ask the library for candidates. 「不滿意 可以再去圖庫推薦」 is `page`
 *         plus `exclude`: keep asking, keep dropping what was already seen.
 * POST  — adopt one. The file is fetched HERE and written to our own storage,
 *         never linked. That is Pixabay's own requirement (「please download
 *         them to your server first」) and it is also the only way a published
 *         site survives an outage at a company we do not control.
 *
 * THE KEY NEVER LEAVES THE SERVER. A stock API key in client JavaScript is a
 * key anyone can lift and burn through the rate limit with, and the limit is
 * shared across every customer we have.
 *
 * WITHOUT A KEY THIS IS NOT AN ERROR. `no-key` comes back as a 200 with an
 * empty list and a reason, so the picker can say 「图库还没接上」 and still offer
 * the upload, which is the path that matters anyway: the owner's own photo of
 * his own job is the thing a homeowner is actually looking for.
 */

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const trade = (url.searchParams.get("trade") ?? "").trim();
  const page = Math.max(1, Math.min(20, Number(url.searchParams.get("page") ?? "1") || 1));
  const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean);

  // The typed words win; the trade is only the opening guess. See TRADE_QUERY
  // for why a trade name is not itself an image search.
  const query = q || TRADE_QUERY[trade] || TRADE_QUERY.other;
  const result = await searchStock(query, { page, exclude });
  /* The other three candidates travel with the answer so the picker can offer
     them as chips. One string per trade was never enough -- 「services」 covers
     the aircond man and the electrician, whose photographs share nothing --
     and the owner is the only one who knows which of the four is theirs. */
  return NextResponse.json({
    ...result,
    query,
    suggestions: TRADE_QUERIES[trade] ?? TRADE_QUERIES.other,
  });
}

/** Bytes we will accept from the library. Well under the bucket's own 8MB, and
 *  a landing-page hero has no business being larger. */
const MAX_BYTES = 6_000_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });

  const { src } = (await req.json().catch(() => ({}))) as { src?: string };
  if (!src) return NextResponse.json({ ok: false, reason: "no-src" }, { status: 400 });

  /*
    ONLY FROM THE LIBRARY WE ASKED.

    This endpoint fetches a URL the caller supplies and stores the bytes under
    the customer's own folder. Without a host check that is a request forger's
    tool: an attacker could aim it at an internal address and read the response
    out of storage. The allowlist is the boundary, and it is a hostname match
    rather than a prefix -- 「pixabay.com.evil.test」 starts with the right
    letters and is not Pixabay.
  */
  let host: string;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") throw new Error("http");
    host = u.hostname.toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-src" }, { status: 400 });
  }
  /* ── WHICH HOSTS WE WILL FETCH BYTES FROM ────────────────────────────────
     An allow-list rather than a check on the URL's shape: this endpoint takes a
     URL from the browser and fetches it server-side, which is a request made
     from inside our network with our credentials available. Anything not on
     this list is somebody else's server.

     Pexels was added 2026-08-28 with the founder's key. Without it the merged
     picker would show Pexels results and then refuse every one of them with
     「bad-host」 — the search half of the wire connected and the storing half
     not, which is the failure this repo keeps finding. */
  const allowedHost =
    host === "pixabay.com" ||
    host.endsWith(".pixabay.com") ||
    host === "pexels.com" ||
    host.endsWith(".pexels.com");
  if (!allowedHost) return NextResponse.json({ ok: false, reason: "bad-host" }, { status: 400 });

  // The user's own session, not the service role: storage RLS (migration
  // 20260826050000) is what stops one customer writing into another's folder,
  // and it can only do that if the write carries a real identity.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("account_id", user.id)
    .single();
  if (!project) return NextResponse.json({ ok: false, reason: "no-project" }, { status: 400 });

  const res = await fetch(src);
  if (!res.ok) return NextResponse.json({ ok: false, reason: "fetch-failed" }, { status: 502 });
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ALLOWED.has(type)) return NextResponse.json({ ok: false, reason: "bad-type" }, { status: 400 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "too-large" }, { status: 400 });
  }

  /* ── RE-ENCODED ON THE WAY IN ────────────────────────────────────────────
     Measured 2026-08-28 on a real published site: four photographs on the
     first screen came to 1,282 KB, about 320 KB each. They are Pixabay's
     `largeImageURL` — a 1280px JPEG — stored exactly as it arrived, and a
     stranger on a Malaysian mobile connection pays for all of it before the
     page has said anything.

     WHY HERE AND NOT AT DELIVERY. Supabase can transform images on the render
     endpoint, and that is the obvious answer — it is also a PAID feature, and
     this account is on the free plan with both of its projects used. Doing it
     once at upload costs nothing per view, works on any plan, and the stored
     file is the small one, so nothing has to remember to ask for a size.

     WHY 1600 AND NOT SMALLER. It is a hero photograph on a desktop as well as
     a phone; 1600 covers a 2x phone and a 1440 laptop without upscaling, and
     Pixabay's 1280 is already under it, so this only ever shrinks the ones
     that arrive larger.

     WHY IT FALLS BACK RATHER THAN FAILING. sharp is native, and a picture that
     stores as a slightly larger JPEG is a working page; a picture that refuses
     to store is an owner who cannot put a photograph on their website. If the
     re-encode throws, the original bytes go in unchanged. */
  let stored: Uint8Array = bytes;
  let storedType = type;
  try {
    const sharp = (await import("sharp")).default;
    const webp = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    if (webp.byteLength < bytes.byteLength) {
      stored = new Uint8Array(webp);
      storedType = "image/webp";
    }
  } catch {
    // Keep the original. See the note above.
  }

  const ext =
    storedType === "image/webp"
      ? "webp"
      : type === "image/png"
        ? "png"
        : type === "image/avif"
          ? "avif"
          : "jpg";
  /* ── PROVENANCE IN THE FILE NAME ─────────────────────────────────────────
     The two libraries ask for different things on the published page — Pixabay
     for nothing, Pexels for 「always credit our photographers when possible」 —
     so which one a photograph came from has to survive the download. It is
     recorded here rather than in a column because the block only stores a URL,
     and a name is the one piece of a stored file that always travels with it.

     `pexels-36035072-<uuid>.jpg` can be read back into a credit line at any
     time. Losing it would mean re-picking every photograph to find out. */
  const from = host.endsWith("pexels.com") ? "pexels" : "pixabay";
  /* Pixabay's delivery URLs carry no plain numeric id (they look like
     `/get/g1a2b3…_1280.jpg`), so there is nothing to record and nothing to
     record it FOR — their licence asks for no credit on the page. Writing a
     「0」 there would read as an id we failed to parse. */
  const originId = (src.match(/\/(?:photos\/)?(\d{4,})/) ?? [])[1];
  const stamp = originId ? `${from}-${originId}` : from;
  const path = `${project.id}/${stamp}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("site-photos")
    .upload(path, stored, { contentType: storedType, upsert: false });
  if (error) return NextResponse.json({ ok: false, reason: "store-failed", detail: error.message }, { status: 500 });

  const { data } = supabase.storage.from("site-photos").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
