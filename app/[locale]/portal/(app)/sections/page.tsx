import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { SectionsClient } from "./sections-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * 版段库 — whole website sections, browsed the same way 组件库 browses parts.
 *
 * Reads only the register and the palette, because that is all the page needs
 * to render honestly: what is on screen must be the customer's own style, not
 * a screenshot of somebody else's.
 */
export default async function SectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  /** `?q=` —— 「找东西」那个面板落地就已经筛好。在服务端接，
   *  所以不用 Suspense，也不会服务端跟浏览器各画一个值。 */
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("style, palette")
    .eq("account_id", user.id)
    .single();

  return (
    <SectionsClient
      initialQuery={typeof q === "string" ? q : undefined}
      locale={locale}
      style={(project?.style as StyleName) ?? "blueprint"}
      palette={(project?.palette as string | null) ?? null}
    />
  );
}
