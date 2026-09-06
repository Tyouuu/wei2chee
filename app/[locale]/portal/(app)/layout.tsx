import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { PortalShell } from "./portal-shell";
import { canOpenModule, loadWorkspace } from "@/lib/portal/workspace";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import {
  displayBusinessName,
  displayOwnerName,
  navLabels,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
} from "@/lib/templates/industry-template";

/**
 * The shell every application screen sits inside.
 *
 * WHY A ROUTE GROUP. `(app)` does not appear in any URL — `/portal`,
 * `/portal/library`, `/portal/spec` are unchanged. What it buys is the ability
 * to give those screens a shell while leaving `/portal/[pageKey]` (the Puck
 * editor, which must be full-screen) and `/portal/style-select` (one-time
 * onboarding, before there is an app to navigate) outside it. Next resolves
 * static segments before dynamic ones, so `/portal/library` reaches this
 * group's `library/page.tsx` rather than the `[pageKey]` editor.
 *
 * WHY THE NAV DATA IS FETCHED HERE AND NOT IN EACH PAGE. The rail lists the
 * customer's own pages by their own names, on every screen. Fetching that in
 * the layout means one query for the whole shell rather than one per route, and
 * means a page that forgets to pass nav data cannot render a rail with holes
 * in it.
 */

export default async function PortalAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client: RLS's own policies are the real enforcement, the
  // `.eq()` filters are for explicitness.
  const supabase = await createSessionSupabaseClient();

  /* NOT 「the project I own」 any more. A site supervisor owns an empty shell
     the signup trigger made for him and works in his boss's business, so the
     question the rail has to answer is 「which business am I standing in」.
     One place decides that, and it is the database -- see lib/portal/
     workspace.ts and 20260901030000. */
  const workspace = await loadWorkspace();
  const { data: project } = workspace
    ? await supabase
        .from("projects")
        .select("id, paid, site_published")
        .eq("id", workspace.projectId)
        .single()
    : { data: null };

  /*
    A founder account may have no project of its own. It used to be let into
    this shell anyway, because the console lived inside it and there was
    nowhere else to go. The console has its own route and its own shell now, so
    the right answer is to send them there rather than to hand them a customer
    portal with an empty rail. Customers without a project are a broken signup
    and still go back to login, as before.
  */
  if (!project) {
    const { data: founder } = await supabase.rpc("is_founder");
    redirect(founder ? `/${locale}/console` : "/login");
  }

  const { data: pageRows } = project
    ? await supabase
        .from("project_pages")
        .select("page_key, title, sort_order")
        .eq("project_id", project.id)
    : { data: [] };

  /* 开着的店有几间 —— 搬货那一行只有两间以上才画。
     ⚠️ 只数**开着的**（那一栏叫 `active`）：关掉的那一间搬不了货。 */
  const { data: shopRows } = project
    ? await supabase
        .from("branches")
        .select("id")
        .eq("project_id", project.id)
        .eq("active", true)
    : { data: [] };

  const pageRefs = sortPages(
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

  /*
    THE PUBLIC SIDE, IN THE RAIL.

    「客户的system页面 跟客户的landing pages跟website应该是要分开放的」. The home
    screen was split on 2026-08-25; the rail was not, so 官网 still sat sixth in
    「我的系统」 next to 报价单 and 客户 as though it were another internal page. It
    is not: it has a public address, it is either live or it is not, and
    strangers post into it. Those three facts are the whole difference, and a
    rail that hides all three is the reason the split had to be explained on the
    home screen at all.

    A head-only count, the same one the home screen takes: 「有没有新的询价」 is
    the one thing an owner opens this product to find out, and it belongs where
    it can be seen from every screen rather than only on the one screen he has
    to navigate to.
  */
  /* UNREAD, not every enquiry that ever arrived. A badge is a "there is
     something here for you"; counting the lifetime total makes it a tally, and
     a tally that only ever grows stops being read after the second week.
     `status` has had a 'new' state since the table was written and nothing had
     ever moved a row off it -- see 20260828070000. The home screen's own
     count deliberately stays a lifetime total, because the sentence there is
     「X enquiries so far」 and that is a different question. */
  const { count: enquiryCount } = project
    ? await supabase
        .from("site_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "new")
    : { count: 0 };

  /* 🔴 两个只数不读的计数，为了两条**跟行业走**的工具连结。

     车牌跟保养合约不是每一行都有的：一间沙龙没有车，一家五金店不做定期保养。
     而侧栏上一条永远用不到的连结，就是他讲过的「四不像」那件事的第 N 次
     ——[任务 20](../../../../docs/founder-tasks.md#20) 砍掉六行就是这个理由。

     ⚠️ 所以它们**按有没有资料**决定画不画，而不是按角色。
     那会留下一个「一台车都还没有的车厂看不到入口」的洞 ——
     补它的是「加一单」那一页底下那条架子，第一次从那里进去。 */
  const [
    { count: vehicleCount },
    { count: contractCount },
    { count: batchCount },
    { count: rentalCount },
  ] = project
    ? await Promise.all([
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .is("archived_at", null),
        supabase
          .from("service_contracts")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .is("archived_at", null),
        /* 批号 · 借出去的 —— 同一条：绝大多数五金店没有批号，
           绝大多数装修公司不出租东西。 */
        supabase
          .from("stock_batches")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id),
        supabase
          .from("rentals")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .is("returned_on", null)
          .is("archived_at", null),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  return (
    <PortalShell
      locale={locale}
      accountEmail={user.email ?? ""}
      businessName={displayBusinessName(businessContext)}
      savedBusinessName={businessContext.identity?.business_name ?? null}
      savedOwnerName={businessContext.identity?.owner_name ?? null}
      systemLang={systemLangOf(businessContext)}
      ownerName={displayOwnerName(
        businessContext,
        user.email?.split("@")[0] || "我",
      )}
      isOwner={workspace?.isOwner ?? true}
      /* 🔴 THE MONEY IS NOT IN HIS RAIL.

         RLS already refuses it -- a supervisor opening 收款 gets a page that
         renders perfectly and is empty. Empty is the worse failure: it reads
         as 「the boss has taken no money」 rather than 「this is not mine to
         see」, and a system that quietly answers a question wrongly is worse
         than one that does not offer to answer it.

         Filtered by SHAPE, not by a list of page keys, so 佣金 -- catalogued
         into the ledger shape after 收款 and 开销 -- is covered without
         anybody remembering to add it. */
      /* 🔴 **两行同名的 bug 也在这一条侧栏上。**

         [任务 199] 修的是**客户系统自己那一条**侧栏（`railNavNode`），
         而这一条是 Formae 自己的壳，当时还在逐页叫 `pageLabel` ——
         于是一个同时开了「工程」跟「订单」的生意，
         在这里看到**两行都写着 Orders**（2026-09-06 一张图抳到）。

         同一条规则，两个侧栏共用一支函式 ——
         第二份手写的同一条规则是这个仓库栽过八次的那件事。 */
      pages={(() => {
        const shown = pageRefs.filter((ref) =>
          canOpenModule(workspace?.role ?? "owner", ref.key),
        );
        const labels = navLabels(
          shown,
          tradeLabels(businessContext, pageRefs),
          systemLangOf(businessContext),
        );
        return shown.map((ref, i) => ({ key: ref.key, label: labels[i] }));
      })()}
      sitePublished={Boolean(project?.site_published)}
      enquiryCount={enquiryCount ?? 0}
      hasVehicles={(vehicleCount ?? 0) > 0}
      hasContracts={(contractCount ?? 0) > 0}
      hasBatches={(batchCount ?? 0) > 0}
      hasRentals={(rentalCount ?? 0) > 0}
      hasPurchases={pageRefs.some((r) => r.key === "purchases")}
      hasStaff={pageRefs.some((r) => r.key === "staff")}
      twoShops={(shopRows ?? []).length >= 2}
      paid={Boolean(project?.paid)}
    >
      {/* Inside the shell, not around it. PortalShell is FORMAE -- dark chrome,
          the founder's own product, always in the owner's language. Everything
          it wraps is the CUSTOMER'S system, which speaks whatever
          `projects.system_language` says. Putting the provider here is what
          keeps that line visible in the code as well as on the screen. */}
      <SystemLangProvider lang={systemLangOf(businessContext)}>
        {children}
      </SystemLangProvider>
    </PortalShell>
  );
}
