import Link from "next/link";
import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { displayBusinessName, type BusinessContext } from "@/lib/templates/industry-template";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Setup & Delivery —— 平台首页，沙龙帐号的新版（任务 425，2026-09-25）。
 *
 * 老板：`平台方还是用着旧版的设计 …… 平台也是要换成新的设计`、`旧版的不要`。
 *
 * 旧的平台首页（深色的 Formae 首页）画的是：交付到哪一步 ＋ 一格格「旧页面的缩略图」
 * （Generated draft · Open and edit）＋「加一页」。后两样对沙龙**不成立了**：
 * 新版是固定的十四页，没有「编辑草稿页」这回事，缩略图画的全是旧版的样子，
 * 而「加一页」给的是旧模块库（订单 · 采购单 · 报价单 …）。
 *
 * 所以沙龙帐号的平台首页只留还成立的三件，用新版自己的外壳跟样子：
 *   ① 交付到哪一步（设计中 → 已报价 → 已付款 → 建造中 → 已上线）—— 客户看得到交付状态，
 *      这是[任务 40]要的，而这一件跟 UI 版本无关
 *   ② 进新系统的入口
 *   ③ 官网 / 需求书 —— 这两样的页面还在旧版（官网编辑器、需求书），这里只给入口，
 *      并且讲清楚它们开在旧版的版面里，不假装
 *
 * 只有老板看得到；师傅（员工）一律回总览。
 * `app/[locale]/portal/(app)/page.tsx` 对沙龙帐号直接转到这里。
 */

const STAGES = [
  { key: "designing", label: "Designing", note: "You are shaping the pages and picking the style." },
  { key: "quoted", label: "Quoted", note: "We have sent what it costs and what it includes." },
  { key: "paid", label: "Paid", note: "Paid. Your build is in the queue." },
  { key: "building", label: "Building", note: "We are building it for real — your data, your pages." },
  { key: "live", label: "Live", note: "It is running. This is the one you use every day." },
] as const;

function since(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
}

export default async function SalonSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);
  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);
  // 这一页讲的是「这套系统建到哪了」—— 员工没有这件事，回他每天开的那一页。
  if (!workspace.isOwner) redirect(`/${locale}/salon-preview/overview`);

  const supabase = await createSessionSupabaseClient();
  const [{ data: context }, { data: project }, { data: pageRows }] = await Promise.all([
    supabase.rpc("get_my_business_context"),
    supabase
      .from("projects")
      .select("stage, stage_changed_at, site_slug, site_published")
      .eq("id", workspace.projectId)
      .single(),
    supabase.from("project_pages").select("page_key").eq("project_id", workspace.projectId),
  ]);
  const businessName = displayBusinessName((context as BusinessContext | null) ?? {});
  const stage = (project?.stage as string | null) ?? "designing";
  const stageSince = since((project?.stage_changed_at as string | null) ?? null);
  const at = STAGES.findIndex((s) => s.key === stage);
  const current = STAGES[at] ?? STAGES[0];
  const hasWebsite = ((pageRows ?? []) as { page_key: string }[]).some((r) => r.page_key === "website");
  const slug = (project?.site_slug as string | null) ?? null;
  const published = Boolean(project?.site_published) && Boolean(slug);

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="tenant-settings" businessName={businessName} subtitle="Operations" />
        <div className="pl-64 min-h-screen flex flex-col bg-[#f9f9fd]">
          <main className="flex-1 w-full p-8">
            <div className="flex flex-col w-full gap-7">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase">
                  <Link href="/en/salon-preview/settings" className="hover:text-[#1a1c1f] transition-colors">
                    Settings
                  </Link>
                  <span className="text-[#c8c5cb]">/</span>
                  <span className="text-[#1a1c1f]">Setup</span>
                </div>
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f]">Setup &amp; Delivery</h1>
                <p className="text-[13.5px] leading-5 text-[#5e5e67] max-w-2xl">
                  Where your system is in the build, and the pages that sit outside the system you use every day.
                </p>
              </div>

              <section className="flex flex-col gap-3" aria-label="Where your system is">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold text-[#5e5e67] uppercase">
                    Where your system is
                  </h2>
                  {stageSince && (
                    <span className="text-[12px] leading-4 text-[#5e5e67]">In this step since {stageSince}</span>
                  )}
                </div>
                <ol
                  data-testid="setup-stages"
                  className="grid grid-cols-1 sm:grid-cols-5 gap-px overflow-hidden rounded-xl border border-[#c8c5cb]/30 bg-[#c8c5cb]/30 shadow-sm"
                >
                  {STAGES.map((s, i) => {
                    const here = s.key === current.key;
                    const done = at > -1 && i < at;
                    return (
                      <li
                        key={s.key}
                        aria-current={here ? "step" : undefined}
                        className={`px-4 py-3.5 flex flex-col gap-1 ${here ? "bg-[#1a1c1f] text-white" : "bg-white"}`}
                      >
                        <span
                          className={`flex items-center gap-1.5 text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase ${
                            here ? "text-white" : done ? "text-[#1a1c1f]" : "text-[#77767b]"
                          }`}
                        >
                          {done && <span className="material-symbols-outlined text-[15px]">check</span>}
                          {i + 1} · {s.label}
                        </span>
                        {here && <span className="text-[12.5px] leading-[18px] text-white/80">{s.note}</span>}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-[#c8c5cb]/30 shadow-sm p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px]">space_dashboard</span>
                    <div className="text-[15px] leading-6 font-semibold">Your system</div>
                  </div>
                  <p className="text-[13px] leading-5 text-[#5e5e67]">
                    Appointments, clients, the register, stock and reports: the part you open every day.
                  </p>
                  <Link
                    href="/en/salon-preview/overview"
                    data-testid="home-open-product"
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a1c1f] text-white text-[13.5px] font-semibold px-4 h-10 hover:bg-black transition-colors"
                  >
                    Open your system
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </div>

                {hasWebsite && (
                  <div className="bg-white rounded-xl border border-[#c8c5cb]/30 shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[22px]">language</span>
                      <div className="text-[15px] leading-6 font-semibold">Your website</div>
                    </div>
                    <p className="text-[13px] leading-5 text-[#5e5e67]">
                      {published ? (
                        <>
                          Published at{" "}
                          <Link href={`/s/${slug}`} className="underline underline-offset-2 text-[#1a1c1f]">
                            /s/{slug}
                          </Link>
                          .
                        </>
                      ) : (
                        "Not published yet."
                      )}{" "}
                      The website editor and enquiries open in the platform&apos;s classic layout.
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link
                        href="/en/portal/website"
                        prefetch={false}
                        data-testid="setup-website"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c8c5cb] text-[13px] font-semibold px-3.5 h-9 hover:bg-[#f3f3f7] transition-colors"
                      >
                        Edit website
                      </Link>
                      <Link
                        href="/en/portal/enquiries"
                        prefetch={false}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c8c5cb] text-[13px] font-semibold px-3.5 h-9 hover:bg-[#f3f3f7] transition-colors"
                      >
                        Website enquiries
                      </Link>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-[#c8c5cb]/30 shadow-sm p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px]">description</span>
                    <div className="text-[15px] leading-6 font-semibold">Your specification</div>
                  </div>
                  <p className="text-[13px] leading-5 text-[#5e5e67]">
                    The written brief we build from. It opens in the platform&apos;s classic layout.
                  </p>
                  <Link
                    href="/en/portal/spec"
                    prefetch={false}
                    className="mt-auto inline-flex items-center gap-1.5 self-start rounded-lg border border-[#c8c5cb] text-[13px] font-semibold px-3.5 h-9 hover:bg-[#f3f3f7] transition-colors"
                  >
                    Read the specification
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
