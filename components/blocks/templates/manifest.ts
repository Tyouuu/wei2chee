/**
 * The four page templates as DATA ONLY — no component imports.
 *
 * Split out of index.ts so that anything which only needs to know what the
 * templates ARE (their key, their section order) does not drag 35 React
 * components into its bundle. lib/templates/block-landings.ts is exactly that
 * caller: it builds Puck layouts out of section NAMES, and the components are
 * resolved later, at render, by SiteBlock.
 */

export type PageTemplate = {
  key: string;
  title: string;
  description: string;
  /** In the order the original page assembles them. */
  sections: string[];
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "startup",
    title: "Startup",
    description: "Lean startup landing page template for early-stage products and waitlists: centered hero section with inline email capture, stats, feature grid, how it works timeline, testimonial, and waitlist signup.",
    sections: ["startup/header", "startup/hero", "startup/stats", "startup/features", "startup/how-it-works", "startup/testimonials", "startup/newsletter", "startup/footer"],
  },
  {
    key: "saas-landing",
    title: "SaaS Landing",
    description: "Complete SaaS marketing homepage template assembled from free blocks: hero section, social proof, features, stats, testimonials, pricing, FAQ, and a closing CTA.",
    sections: ["saas-landing/header", "saas-landing/hero", "saas-landing/logo-cloud", "saas-landing/features", "saas-landing/bento", "saas-landing/stats", "saas-landing/testimonials", "saas-landing/pricing", "saas-landing/faqs", "saas-landing/cta", "saas-landing/footer"],
  },
  {
    key: "saas-landing-2",
    title: "SaaS Landing 2",
    description: "Product-tour SaaS landing page template: hero section with announcement pill, browser-framed gallery, tabbed features, how it works stepper, integrations, comparison, stats, testimonial, pricing, and FAQ.",
    sections: ["saas-landing-2/header", "saas-landing-2/hero", "saas-landing-2/gallery", "saas-landing-2/features", "saas-landing-2/how-it-works", "saas-landing-2/integrations", "saas-landing-2/comparison", "saas-landing-2/stats", "saas-landing-2/testimonials", "saas-landing-2/pricing", "saas-landing-2/faqs", "saas-landing-2/cta", "saas-landing-2/footer"],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Logged-in dashboard app template with a collapsible sidebar and command palette top bar wrapping stat cards, an interactive area chart, and a sortable, paginated data table.",
    sections: ["dashboard/dashboard", "dashboard/charts", "dashboard/table"],
  },
];
