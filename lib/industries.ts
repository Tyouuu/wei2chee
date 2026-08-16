import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Industry } from "@/types/database";

export async function getIndustries(): Promise<Industry[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .order("has_verified_discovery", { ascending: false });

  if (error) throw error;
  return data as Industry[];
}
