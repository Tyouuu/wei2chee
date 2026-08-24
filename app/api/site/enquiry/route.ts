import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 官网表格 → 系统出单, the HTTP half.
 *
 * WHY IT IS ITS OWN ROUTE AND NOT PART OF /api/site. That one carries a
 * SESSION: it is the owner claiming an address and publishing. This one is the
 * opposite in every way that matters -- the caller is a stranger with no
 * account, standing on a published page, and the only thing they legitimately
 * know is the slug in their address bar. Sharing a route would mean one file
 * where half the requests must be authenticated and half must not, which is the
 * shape of an accident.
 *
 * WHY AN ANON CLIENT AND NOT THE SERVICE KEY. Everything this endpoint is
 * allowed to do lives inside `submit_site_enquiry` (migration 20260825040000):
 * it resolves the project from the slug itself, refuses unpublished sites,
 * caps lengths, rate-limits per project, and returns a STRING rather than
 * raising. There is nothing for a service key to add except the ability to
 * write anywhere, which is exactly what must not be reachable from a public
 * endpoint.
 *
 * WHY THE RESULT IS A CODE AND NOT AN HTTP STATUS. Every outcome here is
 * something a person on a phone has to read: 「今天已经收到很多了，等一下再试」 is
 * an answer, not an error. The form renders the sentence; this returns the
 * word.
 */

const RESULTS = new Set(["ok", "incomplete", "too_long", "not_found", "too_many"]);

export async function POST(request: Request) {
  let body: {
    slug?: unknown;
    name?: unknown;
    contact?: unknown;
    answers?: unknown;
    // A field no human sees and no human fills. Bots fill every input they
    // find, so anything in here is a bot -- and it is answered with "ok" rather
    // than an error, because telling a script it was caught teaches it to try
    // again differently.
    website?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ result: "bad_request" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ result: "ok" });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const name = typeof body.name === "string" ? body.name : "";
  const contact = typeof body.contact === "string" ? body.contact : "";
  const answers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {};

  if (!slug) return NextResponse.json({ result: "not_found" }, { status: 404 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("submit_site_enquiry", {
    p_slug: slug,
    p_name: name,
    p_contact: contact,
    p_answers: answers,
  });

  if (error || !RESULTS.has(String(data))) {
    console.error("submit_site_enquiry failed", error);
    return NextResponse.json({ result: "failed" }, { status: 500 });
  }

  return NextResponse.json({ result: String(data) });
}
