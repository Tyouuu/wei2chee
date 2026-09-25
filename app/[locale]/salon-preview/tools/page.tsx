import Link from "next/link";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { displayBusinessName, type BusinessContext } from "@/lib/templates/industry-template";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * More Tools —— 通往「只有平台那一边有」的东西，跟平台本身。
 *
 * ── 为什么有这一页（任务 421，2026-09-25）─────────────────────────────────
 *
 * 老板讲：`你要去接好我们平台跟产品的通道`。
 *
 * 产品这 14 页是沙龙每天开的那一边。但旧系统里有 32 个页面夹，其中
 * **同意书 · 疗程记录 · 放飞机名单 · 走单轮位 · 评价 · 谁欠钱 · 询价**
 * 在产品的侧栏里一个入口都没有 —— 而同意书跟疗程正是主推 medi spa 的卖点。
 * 一个 medi spa 老板登入后如果落进产品，会找不到同意书。
 *
 * 不给它们各开一行（侧栏会从 12 行长到 20 行，任务 414 就是为了砍这个），
 * 而是**一行「More Tools」，一页卡片**：每一张卡一个入口，一句话讲它是什么。
 *
 * ── 每一张卡什么时候出现 ───────────────────────────────────────────────────
 *
 * 跟旧侧栏（portal-shell.tsx 的 `tools`）同一条规矩：这一页依赖的那几页他开着才画。
 * ⚠️ 这是照那份规矩**写第二份**，而这个仓库栽在第二份手写拷贝上至少七次。
 *    所以每一条都写明了「对应旧侧栏哪一条」，改一边要看另一边；
 *    真要收成一份，是把旧侧栏的 `tools` 抽到 lib —— 那是动旧系统的壳，另一件事。
 *
 * ── 它们打开在哪 ───────────────────────────────────────────────────────────
 *
 * 平台那一边的版面（深色侧栏）。**这一页讲清楚这一点，不假装它们是新界面**：
 * 每一页的侧栏顶上有一行「Open your system」回到这里。
 */

type Tool = {
  key: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  show: boolean;
};

export default async function SalonToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);
  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);

  const supabase = await createSessionSupabaseClient();
  const [{ data: context }, { data: pageRows }] = await Promise.all([
    supabase.rpc("get_my_business_context"),
    supabase.from("project_pages").select("page_key").eq("project_id", workspace.projectId),
  ]);
  const businessName = displayBusinessName((context as BusinessContext | null) ?? {});
  const pages = new Set(((pageRows ?? []) as { page_key: string }[]).map((r) => r.page_key));
  const hasBookings = pages.has("bookings");
  const hasStaff = pages.has("staff");
  const hasWebsite = pages.has("website");
  const isOwner = workspace.isOwner;

  const P = "/en/portal";
  const groups: { label: string; tools: Tool[] }[] = [
    {
      label: "Around the client",
      tools: [
        {
          key: "treatments", icon: "clinical_notes", title: "Treatment records",
          body: "What was done to each client, by whom, with the batch used. A note is signed the moment it is written and can only be added to.",
          href: `${P}/treatments`, show: hasBookings && hasStaff, // = portal-shell `treatments`
        },
        {
          key: "consent", icon: "draw", title: "Consent forms",
          body: "Write a form once, send it to a client to sign on her phone, and see who has signed and who has not.",
          href: `${P}/consent`, show: hasBookings && hasStaff, // portal-shell shows it once a form exists; a new medi spa has none yet, so here it shows with treatments
        },
        {
          key: "no-shows", icon: "person_off", title: "No-show list",
          body: "Who has missed appointments, out of how many visits, and whether a deposit is now due.",
          href: `${P}/no-shows`, show: hasBookings, // = portal-shell `no-shows`
        },
        {
          key: "reviews", icon: "star", title: "Client reviews",
          body: "What clients said after their visit, and which of it you allow to be shown.",
          href: `${P}/reviews`, show: hasBookings, // = portal-shell `reviews`
        },
        {
          key: "owing", icon: "request_quote", title: "Who owes you",
          body: "Clients with an unpaid balance, oldest first.",
          href: `${P}/owing`, show: isOwner, // = portal-shell `owing`
        },
      ],
    },
    {
      label: "Front desk",
      tools: [
        {
          key: "today", icon: "notifications_active", title: "Today's follow-ups",
          body: "What the system noticed for you today: an expiring quote, a client who has not been back, a pass with one session left.",
          href: `${P}/today`, show: true, // = portal-shell `today`
        },
        {
          key: "walkin", icon: "directions_walk", title: "Walk-in queue",
          body: "Whose turn it is for the next client who walks in.",
          href: `${P}/walkin`, show: hasBookings && hasStaff, // = portal-shell `walkin`
        },
      ],
    },
    {
      label: "Website and platform",
      tools: [
        {
          key: "enquiries", icon: "mark_email_unread", title: "Website enquiries",
          body: "Messages people left on your website.",
          href: `${P}/enquiries`, show: hasWebsite && isOwner,
        },
        {
          key: "website", icon: "language", title: "Your website",
          body: "Edit and publish the page your clients find when they search for you.",
          href: `${P}/website`, show: hasWebsite && isOwner,
        },
        {
          key: "platform", icon: "dashboard_customize", title: "Setup & delivery",
          body: "Where your system is in the build, your website and your specification.",
          href: "/en/salon-preview/setup", show: isOwner,
        },
      ],
    },
  ]
    .map((g) => ({ ...g, tools: g.tools.filter((t) => t.show) }))
    .filter((g) => g.tools.length > 0);

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="more-tools" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
          <main className="flex-1 w-full p-8">
            <div className="flex flex-col w-full gap-7">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase">
                  <span>Operations</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span className="text-[#1a1c1f]">More Tools</span>
                </div>
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f]">More Tools</h1>
                <p className="text-[13.5px] leading-5 text-[#5e5e67] max-w-2xl">
                  Everything else your system does. These open in the platform&apos;s classic layout; the first row of its
                  sidebar brings you back to your system.
                </p>
              </div>

              {groups.map((g) => (
                <section key={g.label} className="flex flex-col gap-3">
                  <h2 className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase">{g.label}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {g.tools.map((t) => (
                      <Link
                        key={t.key}
                        href={t.href}
                        prefetch={false}
                        data-testid={`tool-${t.key}`}
                        className="group bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-5 flex flex-col gap-3 hover:border-[#1a1c1f]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="material-symbols-outlined text-[22px] text-[#1a1c1f]">{t.icon}</span>
                          <span className="material-symbols-outlined text-[18px] text-[#77767b] group-hover:text-[#1a1c1f] transition-colors">arrow_forward</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[15px] leading-6 font-semibold text-[#1a1c1f]">{t.title}</div>
                          <p className="text-[13px] leading-5 text-[#5e5e67]">{t.body}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
