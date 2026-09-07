import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { ConsoleHome } from "./console-home";

/**
 * The founder's console.
 *
 * WHY IT EXISTS. Until now this product had twelve routes and none of them were
 * for the person who runs it. The consequence was never written down anywhere
 * he could see: ten questionnaire leads and five AI analyses sat in the database
 * that he had no way to look at, marking a customer paid meant editing a cell in
 * Supabase Studio, and — the one that is not a convenience gap — when a customer
 * asked for their system to be BUILT, he could not see what they had designed,
 * because /portal/spec resolves from auth.uid() and RLS restricts project_pages
 * to its owner.
 *
 * EVERY READ HERE GOES THROUGH A `security definer` RPC THAT CHECKS
 * `is_founder()` ITSELF. The `notFound()` below is a UI decision, not the
 * security boundary — a customer who guesses this URL gets a 404 instead of an
 * error page, and would get "not permitted" from the database even if this
 * check were deleted.
 */
export default async function ConsolePage({
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

  const [
    { data: overview },
    { data: customers },
    { data: handoffs },
    { data: quiet },
  ] = await Promise.all([
    supabase.rpc("console_overview"),
    supabase.rpc("console_customers"),
    // 🔴 「交给我去建」按下去写的那一行（20260905410000）。
    // 写下来没有人读，就是这个仓库犯过十九次的那件事 —— 而这一行
    // 是广告进来那一群唯一的线索：讯息送不送得出去，他都看得到。
    supabase.rpc("console_handoffs"),
    // 🔴 谁三十天没有打开过（20260906520000 · 任务 227）。
    // 续约那一天太晚了 —— 能提早看的是「他还在不在开」。
    // ⚠️ 三十天是那一支自己的预设，这里不再写一次：
    // 同一个数字两个地方，迟早会分家。
    supabase.rpc("console_quiet_customers"),
  ]);

  return (
    <ConsoleHome
      locale={locale}
      overview={(overview as Record<string, number | Record<string, number>>) ?? {}}
      customers={(customers as never[]) ?? []}
      handoffs={(handoffs as never[]) ?? []}
      quiet={(quiet as never[]) ?? []}
    />
  );
}
