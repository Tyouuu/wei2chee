import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { StylesClient } from "./styles-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The style library.
 *
 * WHY IT IS ITS OWN ROUTE. It used to be the third section of a scrolling home
 * page, which meant the control that changes how the customer's entire system
 * looks was something you found by scrolling past your own pages. It is one of
 * the three or four decisions a customer makes about their system; it deserves
 * a destination in the rail, and the rail is what gives it one.
 */
export default async function StylesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, palette")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  return (
    <StylesClient
      locale={locale}
      style={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
    />
  );
}
