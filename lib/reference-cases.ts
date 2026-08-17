import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ReferenceCase } from "@/types/database";

export async function getReferenceCases(industryId: string): Promise<ReferenceCase[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("reference_cases")
    .select("*")
    .eq("industry_id", industryId);

  if (error) throw error;
  return data as ReferenceCase[];
}
