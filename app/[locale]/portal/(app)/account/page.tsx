import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { AccountClient } from "./account-client";
import {
  displayBusinessName,
  sortPages,
  type BusinessContext,
} from "@/lib/templates/industry-template";

/**
 * The account page.
 *
 * WHAT WAS THERE BEFORE: a dialog with two fields — company name and owner
 * name. Everything a person actually comes to an account screen for was
 * missing, and each absence is its own kind of broken:
 *
 *   - no way to CHANGE A PASSWORD (you could only reset one you had forgotten)
 *   - no way to change the email a whole account is keyed on
 *   - no way to EXPORT YOUR OWN DATA, which this business explicitly promises
 *     ("data export is free") — promising it and not shipping it is worse than
 *     not promising it
 *   - no way to delete the account, which PDPA and every comparable product
 *     both expect
 *
 * The two-field dialog stays where it is (it is reached from the rail and it is
 * about the BUSINESS, not the person). This page is about the person and their
 * data.
 */
export default async function AccountPage({
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
    .select("id, paid, stage, style, business_name, created_at")
    .eq("account_id", user.id)
    .single();

  const { data: pageRows } = project
    ? await supabase.from("project_pages").select("page_key, title, sort_order").eq("project_id", project.id)
    : { data: [] };

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  // `getSessionUser` returns only id and email, so the identity list comes from
  // the auth client directly. It tells the person HOW they sign in: someone who
  // created their account with Google has no password to change, and offering
  // them that form is offering a control that cannot work.
  const { data: authUser } = await supabase.auth.getUser();
  const providers = (authUser.user?.identities ?? []).map((i) => i.provider);
  const hasPassword = providers.length === 0 || providers.includes("email");

  return (
    <AccountClient
      locale={locale}
      email={user.email ?? ""}
      providers={providers}
      hasPassword={hasPassword}
      createdAt={authUser.user?.created_at ?? null}
      businessName={displayBusinessName(businessContext)}
      paid={Boolean(project?.paid)}
      stage={(project?.stage as string) ?? "designing"}
      pageCount={sortPages(
        (pageRows ?? []).map((r: { page_key: string; title: string | null }) => ({
          key: r.page_key,
          title: r.title,
        })),
      ).length}
    />
  );
}
