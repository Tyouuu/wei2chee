import { NextResponse } from "next/server";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";

/**
 * The two writes behind 发布 — claiming an address and turning it on.
 *
 * Both go through security-definer RPCs (migration 20260823010000) that resolve
 * the project from `auth.uid()` and accept no project id, so there is nothing a
 * caller can send that reaches someone else's site. This route's whole job is
 * to carry the session and to translate the RPC's status STRING into a status
 * CODE the form can read.
 *
 * WHY THE RPCS RETURN STRINGS RATHER THAN RAISING. Every failure here is
 * something a person has to read and fix in a text field: 「已经有人用了」 is an
 * answer, not an error. A raised exception would arrive as a Postgres message,
 * and a raw database string in front of a customer is the one thing this
 * product does not do.
 */

const SLUG_RESULTS = new Set([
  "ok",
  "empty",
  "shape",
  "taken",
  "reserved",
  "no_project",
]);
const PUBLISH_RESULTS = new Set([
  "ok",
  "no_slug",
  "not_saved",
  "no_project",
]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ result: "unauthenticated" }, { status: 401 });
  }

  let body: { slug?: unknown; published?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ result: "bad_request" }, { status: 400 });
  }

  const supabase = await createSessionSupabaseClient();

  // The address first when both arrive together: publishing checks that a slug
  // exists, so the other order would refuse a first publish that carries its
  // own address -- which is exactly the shape of the first publish.
  if (typeof body.slug === "string") {
    const { data, error } = await supabase.rpc("set_my_site_slug", {
      new_slug: body.slug,
    });
    if (error || !SLUG_RESULTS.has(String(data))) {
      return NextResponse.json({ result: "failed" }, { status: 500 });
    }
    if (data !== "ok") {
      return NextResponse.json({ result: data });
    }
  }

  if (typeof body.published === "boolean") {
    const { data, error } = await supabase.rpc("set_my_site_published", {
      publish: body.published,
    });
    if (error || !PUBLISH_RESULTS.has(String(data))) {
      return NextResponse.json({ result: "failed" }, { status: 500 });
    }
    return NextResponse.json({ result: data });
  }

  return NextResponse.json({ result: "ok" });
}
