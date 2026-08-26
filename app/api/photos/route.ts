import { NextResponse } from "next/server";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { searchStock, TRADE_QUERY } from "@/lib/images/stock";

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
  const query = q || TRADE_QUERY[trade] || "small business";
  const result = await searchStock(query, { page, exclude });
  return NextResponse.json({ ...result, query });
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
  const allowedHost = host === "pixabay.com" || host.endsWith(".pixabay.com");
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

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/avif" ? "avif" : "jpg";
  const path = `${project.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("site-photos")
    .upload(path, bytes, { contentType: type, upsert: false });
  if (error) return NextResponse.json({ ok: false, reason: "store-failed", detail: error.message }, { status: 500 });

  const { data } = supabase.storage.from("site-photos").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
