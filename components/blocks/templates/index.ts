import type { ComponentType } from "react";

/**
 * WHOLE PAGES, not sections.
 *
 * Four items in the @7Ovr registry are not blocks at all: startup,
 * saas-landing, saas-landing-2 and dashboard ship as multi-file app routes --
 * an `app/<name>/page.tsx` plus a folder of section components. The section
 * puller refused them because it only writes into components/blocks/, and that
 * refusal was right: writing their page.tsx would open public routes at
 * /startup and /dashboard, outside the locale segment, in a product where the
 * only anonymous route is a customer own site at /s/<slug>.
 *
 * So the SECTIONS were taken and the page file was only READ -- for the one
 * thing it is worth reading, the order its sections are assembled in. That
 * order is PAGE_TEMPLATES below.
 *
 * WHY THIS MATTERS MORE THAN THE 216. A customer who opens 模板库 does not want
 * to assemble a page out of parts; they want a page. These four are the only
 * items in the registry that answer that, and they are what the founder asked
 * for first: 「等你做完landing pages的模板先」.
 *
 * The one edit made to the pulled code: saas-landing footer shipped a
 * light/dark toggle on next-themes. Removed, with its dependency. On a page
 * that a customer own customers read, light-versus-dark is not the visitor
 * decision -- the page wears the register its owner picked, which is the rule
 * the whole product stands on.
 *
 * GENERATED. Re-run the template puller rather than editing the maps.
 */

import T_startup_header from "@/components/blocks/templates/startup/header";
import T_startup_hero from "@/components/blocks/templates/startup/hero";
import T_startup_stats from "@/components/blocks/templates/startup/stats";
import T_startup_features from "@/components/blocks/templates/startup/features";
import T_startup_how_it_works from "@/components/blocks/templates/startup/how-it-works";
import T_startup_testimonials from "@/components/blocks/templates/startup/testimonials";
import T_startup_newsletter from "@/components/blocks/templates/startup/newsletter";
import T_startup_footer from "@/components/blocks/templates/startup/footer";
import T_saas_landing_header from "@/components/blocks/templates/saas-landing/header";
import T_saas_landing_hero from "@/components/blocks/templates/saas-landing/hero";
import T_saas_landing_logo_cloud from "@/components/blocks/templates/saas-landing/logo-cloud";
import T_saas_landing_features from "@/components/blocks/templates/saas-landing/features";
import T_saas_landing_bento from "@/components/blocks/templates/saas-landing/bento";
import T_saas_landing_stats from "@/components/blocks/templates/saas-landing/stats";
import T_saas_landing_testimonials from "@/components/blocks/templates/saas-landing/testimonials";
import T_saas_landing_pricing from "@/components/blocks/templates/saas-landing/pricing";
import T_saas_landing_faqs from "@/components/blocks/templates/saas-landing/faqs";
import T_saas_landing_cta from "@/components/blocks/templates/saas-landing/cta";
import T_saas_landing_footer from "@/components/blocks/templates/saas-landing/footer";
import T_saas_landing_2_header from "@/components/blocks/templates/saas-landing-2/header";
import T_saas_landing_2_hero from "@/components/blocks/templates/saas-landing-2/hero";
import T_saas_landing_2_gallery from "@/components/blocks/templates/saas-landing-2/gallery";
import T_saas_landing_2_features from "@/components/blocks/templates/saas-landing-2/features";
import T_saas_landing_2_how_it_works from "@/components/blocks/templates/saas-landing-2/how-it-works";
import T_saas_landing_2_integrations from "@/components/blocks/templates/saas-landing-2/integrations";
import T_saas_landing_2_comparison from "@/components/blocks/templates/saas-landing-2/comparison";
import T_saas_landing_2_stats from "@/components/blocks/templates/saas-landing-2/stats";
import T_saas_landing_2_testimonials from "@/components/blocks/templates/saas-landing-2/testimonials";
import T_saas_landing_2_pricing from "@/components/blocks/templates/saas-landing-2/pricing";
import T_saas_landing_2_faqs from "@/components/blocks/templates/saas-landing-2/faqs";
import T_saas_landing_2_cta from "@/components/blocks/templates/saas-landing-2/cta";
import T_saas_landing_2_footer from "@/components/blocks/templates/saas-landing-2/footer";
import T_dashboard_dashboard from "@/components/blocks/templates/dashboard/dashboard";
import T_dashboard_charts from "@/components/blocks/templates/dashboard/charts";
import T_dashboard_table from "@/components/blocks/templates/dashboard/table";

/** Section component by "<template>/<file>" key. Merged into BLOCKS so
 *  SiteBlock can render one without knowing where it came from. */
export const TEMPLATE_BLOCKS: Record<string, ComponentType> = {
  "startup/header": T_startup_header,
  "startup/hero": T_startup_hero,
  "startup/stats": T_startup_stats,
  "startup/features": T_startup_features,
  "startup/how-it-works": T_startup_how_it_works,
  "startup/testimonials": T_startup_testimonials,
  "startup/newsletter": T_startup_newsletter,
  "startup/footer": T_startup_footer,
  "saas-landing/header": T_saas_landing_header,
  "saas-landing/hero": T_saas_landing_hero,
  "saas-landing/logo-cloud": T_saas_landing_logo_cloud,
  "saas-landing/features": T_saas_landing_features,
  "saas-landing/bento": T_saas_landing_bento,
  "saas-landing/stats": T_saas_landing_stats,
  "saas-landing/testimonials": T_saas_landing_testimonials,
  "saas-landing/pricing": T_saas_landing_pricing,
  "saas-landing/faqs": T_saas_landing_faqs,
  "saas-landing/cta": T_saas_landing_cta,
  "saas-landing/footer": T_saas_landing_footer,
  "saas-landing-2/header": T_saas_landing_2_header,
  "saas-landing-2/hero": T_saas_landing_2_hero,
  "saas-landing-2/gallery": T_saas_landing_2_gallery,
  "saas-landing-2/features": T_saas_landing_2_features,
  "saas-landing-2/how-it-works": T_saas_landing_2_how_it_works,
  "saas-landing-2/integrations": T_saas_landing_2_integrations,
  "saas-landing-2/comparison": T_saas_landing_2_comparison,
  "saas-landing-2/stats": T_saas_landing_2_stats,
  "saas-landing-2/testimonials": T_saas_landing_2_testimonials,
  "saas-landing-2/pricing": T_saas_landing_2_pricing,
  "saas-landing-2/faqs": T_saas_landing_2_faqs,
  "saas-landing-2/cta": T_saas_landing_2_cta,
  "saas-landing-2/footer": T_saas_landing_2_footer,
  "dashboard/dashboard": T_dashboard_dashboard,
  "dashboard/charts": T_dashboard_charts,
  "dashboard/table": T_dashboard_table,
};

export { PAGE_TEMPLATES, type PageTemplate } from "@/components/blocks/templates/manifest";
