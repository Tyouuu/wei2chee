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
export default async function SectionsPage() {
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
      style={(project?.style as StyleName) ?? "blueprint"}
      palette={(project?.palette as string | null) ?? null}
    />
  );
}
