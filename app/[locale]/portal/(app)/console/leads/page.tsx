import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { LeadsClient } from "./leads-client";

/**
 * The questionnaire leads.
 *
 * There are ten of these in the database and five carry a full AI analysis. The
 * founder has never seen one inside his own product — the only view was
 * Supabase Studio. A lead who answered every question about their business and
 * then did not sign up is the most actionable row this company owns, and it was
 * invisible.
 */
export default async function ConsoleLeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: founder } = await supabase.rpc("is_founder");
  if (!founder) notFound();

  const { data: leads } = await supabase.rpc("console_leads");

  return <LeadsClient locale={locale} leads={(leads as never[]) ?? []} />;
}
