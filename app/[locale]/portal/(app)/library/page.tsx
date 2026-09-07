import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { LibraryClient } from "./library-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { sortPages } from "@/lib/templates/industry-template";

/**
 * The component library.
 *
 * WHY IT NEEDED TO BE A PLACE. Until now the only way to see what this product
 * can build was to open the editor and read a drawer of fifteen names beside
 * grey miniatures. That is a tool's affordance, not a library — you cannot
 * browse it, you cannot show it to anyone, and you cannot answer "what do I
 * get" without already being mid-edit.
 *
 * 21st.dev's answer, which is the right one: render the real component at a
 * readable size and let people look. Every card on this page is a live
 * `<Render>` through the same `puckConfig` the editor uses, in the customer's
 * own chosen style — so it is not a picture of what they would get, it is the
 * thing itself.
 */
export default async function LibraryPage({
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
    .select("id, style, palette")
    .eq("account_id", user.id)
    .single();

  const { data: pageRows } = project
    ? await supabase
        .from("project_pages")
        .select("page_key, title, sort_order")
        .eq("project_id", project.id)
    : { data: [] };
  const ordered = sortPages(
    (pageRows ?? []).map(
      (r: {
        page_key: string;
        title: string | null;
        sort_order: number | null;
      }) => ({
        key: r.page_key,
        title: r.title,
        sortOrder: r.sort_order,
      }),
    ),
  );

  return (
    <LibraryClient
      initialQuery={typeof q === "string" ? q : undefined}
      locale={locale}
      style={(project?.style as StyleName) ?? "blueprint"}
      palette={(project?.palette as string | null) ?? null}
      firstPage={ordered[0]?.key ?? "dashboard"}
    />
  );
}
