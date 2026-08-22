import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { forPublication } from "@/lib/portal/publish-projection";
import type { PuckLayout } from "@/lib/portal/layout-ops";
import { toSystemLang } from "@/lib/system-lang";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { PublicSite } from "./public-site";

/**
 * The only anonymous page in this product: a customer's own website.
 *
 * ── WHY IT LIVES OUTSIDE app/[locale]/ ────────────────────────────────────
 *
 * Everything else here is Formae talking to a business owner, in his language,
 * behind a login. This is that business talking to ITS customers. A Malaysian
 * contractor printing a URL on a name card should not be printing our locale
 * prefix, and there is no locale to choose anyway -- the page speaks whatever
 * language that business's system speaks. `proxy.ts` excludes `/s/` from
 * next-intl for exactly this reason.
 *
 * ── WHY THE READ GOES THROUGH ONE RPC ─────────────────────────────────────
 *
 * `get_public_site` (migration 20260823010000) is security definer and returns
 * five columns: the business name, the paint, the language, and the website
 * page's layout. Nothing else -- not the email, not the other pages, not the
 * analysis. That function IS the anonymous surface of this database, so it is
 * the one place to audit, rather than a query here that a later edit could
 * widen without anyone noticing.
 *
 * An unpublished slug and a slug that was never claimed both return zero rows
 * and both become the same 404. Distinguishing them would turn this route into
 * a way to ask whether a given name is a Formae customer.
 */

type Site = {
  business_name: string | null;
  style: string | null;
  palette: string | null;
  system_language: string | null;
  layout_json: Record<string, unknown> | null;
};

async function loadSite(slug: string): Promise<Site | null> {
  const supabase = createAnonSupabaseClient();
  const { data } = await supabase.rpc("get_public_site", { slug });
  const row = (data as Site[] | null)?.[0];
  return row ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) return { title: "Not found", robots: { index: false } };
  // The business's own name and nothing appended. A generated site whose tab
  // says 「兴发装修工程 | Formae」 is advertising us on their page.
  return { title: site.business_name || slug };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await loadSite(slug);

  // A published page always has a saved layout -- `set_my_site_published`
  // refuses to turn a never-saved page on, and `get_public_site` filters for a
  // `content` key besides. Both checks are the same rule stated twice on
  // purpose: what a stranger reads must be something the owner pressed save on,
  // not a draft the product generated for them to look at.
  if (!site?.layout_json || !site.style) notFound();

  return (
    <PublicSite
      // Projected, not raw: the saved page carries notes the product wrote to
      // the OWNER, and this page's reader is somebody else. See
      // lib/portal/publish-projection.ts for the one that was found by reading
      // the first published site out loud.
      data={forPublication(site.layout_json as unknown as PuckLayout) as unknown as Data}
      style={site.style as StyleName}
      palette={site.palette}
      lang={toSystemLang(site.system_language)}
    />
  );
}
