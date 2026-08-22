/**
 * NOT a client module, deliberately.
 *
 * With `"use client"` at the top, a Server Component importing this file gets
 * client REFERENCES rather than the objects -- `Object.keys(BLOCKS)` came back
 * empty and the contact sheet rendered "0 blocks". Each pulled block carries
 * its own `"use client"` where it needs one; this index only has to hand them
 * over.
 */

/**
 * THE 164 BLOCKS PULLED FROM THE 7Ovr REGISTRY, IN ONE INDEX.
 *
 * WHERE THEY CAME FROM. 7ovr.com ships a shadcn registry of 241 free blocks
 * under MIT-0 -- the one licence with no attribution clause at all, so they can
 * be shipped inside a customer's own website without a credit line. Measured on
 * 2026-08-23 against the other seven registries already wired in
 * components.json:
 *
 *     registry        items   token purity   licence
 *     @7ovr             241            99%   MIT-0
 *     @ilinxa           184            93%   MIT
 *     @kibo              41            43%   MIT
 *     @magicui          247            39%   MIT
 *     @evilcharts       279            16%   -
 *     @kokonutui         51            10%   -
 *
 * Token purity is the number that decides this. It is the share of colour
 * decisions written as a token (bg-primary, var(--color-paper)) rather than as
 * a literal (#0f172a, bg-blue-500). A block at 10% ignores whichever of the
 * twelve registers the customer picked; a block at 99% wears it. That is the
 * whole product.
 *
 * WHY NOT ALL 241. Seventy-seven need a primitive this repo does not have --
 * sonner unlocks 84 of them on its own, then kbd, sheet, empty. Nothing about
 * them is harder, they are just a later batch.
 *
 * WHAT HAD TO BE CHANGED, AND IT WAS LESS THAN IT LOOKED. The registry declares
 * @base-ui/react as a dependency and the docs ask for a base-* style. Measured
 * rather than believed: of the 241 block FILES, the number that actually import
 * @base-ui/react is ZERO. They import @/components/ui/* -- this repo's own
 * Radix-based shadcn primitives. What did differ was spelling, and a codemod
 * settled it: Base UI's polymorphic `render={<a />}` is Radix's `asChild`
 * (75 sites), `nativeButton` does not exist here (60), and Radix makes
 * Accordion/ToggleGroup single-vs-multiple an explicit `type` where Base UI
 * infers it. After that: 0 type errors across 164 files.
 *
 * This file is GENERATED. Re-run the puller in the 2026-08-23 session notes
 * after adding blocks; do not hand-edit the three maps below.
 */

import B_about_1 from "@/components/blocks/about-1";
import B_about_2 from "@/components/blocks/about-2";
import B_about_3 from "@/components/blocks/about-3";
import B_about_4 from "@/components/blocks/about-4";
import B_activity_1 from "@/components/blocks/activity-1";
import B_activity_3 from "@/components/blocks/activity-3";
import B_activity_4 from "@/components/blocks/activity-4";
import B_announcement_1 from "@/components/blocks/announcement-1";
import B_announcement_2 from "@/components/blocks/announcement-2";
import B_announcement_3 from "@/components/blocks/announcement-3";
import B_announcement_4 from "@/components/blocks/announcement-4";
import B_article_1 from "@/components/blocks/article-1";
import B_article_2 from "@/components/blocks/article-2";
import B_article_4 from "@/components/blocks/article-4";
import B_article_5 from "@/components/blocks/article-5";
import B_auth_6 from "@/components/blocks/auth-6";
import B_auth_7 from "@/components/blocks/auth-7";
import B_bento_1 from "@/components/blocks/bento-1";
import B_bento_2 from "@/components/blocks/bento-2";
import B_bento_3 from "@/components/blocks/bento-3";
import B_bento_4 from "@/components/blocks/bento-4";
import B_billing_4 from "@/components/blocks/billing-4";
import B_billing_5 from "@/components/blocks/billing-5";
import B_billing_6 from "@/components/blocks/billing-6";
import B_blog_1 from "@/components/blocks/blog-1";
import B_blog_2 from "@/components/blocks/blog-2";
import B_blog_3 from "@/components/blocks/blog-3";
import B_blog_4 from "@/components/blocks/blog-4";
import B_blog_5 from "@/components/blocks/blog-5";
import B_calendar_1 from "@/components/blocks/calendar-1";
import B_calendar_2 from "@/components/blocks/calendar-2";
import B_calendar_3 from "@/components/blocks/calendar-3";
import B_careers_1 from "@/components/blocks/careers-1";
import B_careers_2 from "@/components/blocks/careers-2";
import B_careers_3 from "@/components/blocks/careers-3";
import B_careers_4 from "@/components/blocks/careers-4";
import B_changelog_1 from "@/components/blocks/changelog-1";
import B_changelog_2 from "@/components/blocks/changelog-2";
import B_changelog_3 from "@/components/blocks/changelog-3";
import B_changelog_4 from "@/components/blocks/changelog-4";
import B_changelog_5 from "@/components/blocks/changelog-5";
import B_charts_1 from "@/components/blocks/charts-1";
import B_charts_2 from "@/components/blocks/charts-2";
import B_charts_3 from "@/components/blocks/charts-3";
import B_charts_4 from "@/components/blocks/charts-4";
import B_charts_5 from "@/components/blocks/charts-5";
import B_coming_soon_1 from "@/components/blocks/coming-soon-1";
import B_coming_soon_2 from "@/components/blocks/coming-soon-2";
import B_coming_soon_3 from "@/components/blocks/coming-soon-3";
import B_coming_soon_4 from "@/components/blocks/coming-soon-4";
import B_coming_soon_5 from "@/components/blocks/coming-soon-5";
import B_comparison_1 from "@/components/blocks/comparison-1";
import B_comparison_2 from "@/components/blocks/comparison-2";
import B_comparison_3 from "@/components/blocks/comparison-3";
import B_comparison_4 from "@/components/blocks/comparison-4";
import B_cookie_consent_1 from "@/components/blocks/cookie-consent-1";
import B_cookie_consent_2 from "@/components/blocks/cookie-consent-2";
import B_cookie_consent_3 from "@/components/blocks/cookie-consent-3";
import B_cookie_consent_4 from "@/components/blocks/cookie-consent-4";
import B_cookie_consent_5 from "@/components/blocks/cookie-consent-5";
import B_cta_1 from "@/components/blocks/cta-1";
import B_cta_2 from "@/components/blocks/cta-2";
import B_cta_3 from "@/components/blocks/cta-3";
import B_cta_4 from "@/components/blocks/cta-4";
import B_cta_5 from "@/components/blocks/cta-5";
import B_cta_6 from "@/components/blocks/cta-6";
import B_dashboard_1 from "@/components/blocks/dashboard-1";
import B_dashboard_2 from "@/components/blocks/dashboard-2";
import B_dashboard_3 from "@/components/blocks/dashboard-3";
import B_dashboard_4 from "@/components/blocks/dashboard-4";
import B_error_1 from "@/components/blocks/error-1";
import B_error_2 from "@/components/blocks/error-2";
import B_error_3 from "@/components/blocks/error-3";
import B_error_4 from "@/components/blocks/error-4";
import B_error_5 from "@/components/blocks/error-5";
import B_error_6 from "@/components/blocks/error-6";
import B_faqs_1 from "@/components/blocks/faqs-1";
import B_faqs_2 from "@/components/blocks/faqs-2";
import B_features_1 from "@/components/blocks/features-1";
import B_features_2 from "@/components/blocks/features-2";
import B_features_3 from "@/components/blocks/features-3";
import B_features_4 from "@/components/blocks/features-4";
import B_features_5 from "@/components/blocks/features-5";
import B_file_upload_4 from "@/components/blocks/file-upload-4";
import B_file_upload_5 from "@/components/blocks/file-upload-5";
import B_footer_1 from "@/components/blocks/footer-1";
import B_footer_2 from "@/components/blocks/footer-2";
import B_footer_5 from "@/components/blocks/footer-5";
import B_gallery_1 from "@/components/blocks/gallery-1";
import B_gallery_2 from "@/components/blocks/gallery-2";
import B_gallery_3 from "@/components/blocks/gallery-3";
import B_gallery_4 from "@/components/blocks/gallery-4";
import B_hero_1 from "@/components/blocks/hero-1";
import B_hero_2 from "@/components/blocks/hero-2";
import B_hero_3 from "@/components/blocks/hero-3";
import B_hero_5 from "@/components/blocks/hero-5";
import B_hero_6 from "@/components/blocks/hero-6";
import B_how_it_works_1 from "@/components/blocks/how-it-works-1";
import B_how_it_works_2 from "@/components/blocks/how-it-works-2";
import B_how_it_works_3 from "@/components/blocks/how-it-works-3";
import B_how_it_works_4 from "@/components/blocks/how-it-works-4";
import B_integrations_4 from "@/components/blocks/integrations-4";
import B_integrations_5 from "@/components/blocks/integrations-5";
import B_kanban_1 from "@/components/blocks/kanban-1";
import B_kanban_2 from "@/components/blocks/kanban-2";
import B_kanban_3 from "@/components/blocks/kanban-3";
import B_kanban_4 from "@/components/blocks/kanban-4";
import B_logo_cloud_1 from "@/components/blocks/logo-cloud-1";
import B_logo_cloud_2 from "@/components/blocks/logo-cloud-2";
import B_logo_cloud_3 from "@/components/blocks/logo-cloud-3";
import B_logo_cloud_4 from "@/components/blocks/logo-cloud-4";
import B_logo_cloud_5 from "@/components/blocks/logo-cloud-5";
import B_newsletter_4 from "@/components/blocks/newsletter-4";
import B_newsletter_5 from "@/components/blocks/newsletter-5";
import B_notifications_2 from "@/components/blocks/notifications-2";
import B_notifications_3 from "@/components/blocks/notifications-3";
import B_notifications_4 from "@/components/blocks/notifications-4";
import B_notifications_5 from "@/components/blocks/notifications-5";
import B_onboarding_1 from "@/components/blocks/onboarding-1";
import B_onboarding_2 from "@/components/blocks/onboarding-2";
import B_onboarding_4 from "@/components/blocks/onboarding-4";
import B_onboarding_5 from "@/components/blocks/onboarding-5";
import B_onboarding_6 from "@/components/blocks/onboarding-6";
import B_page_header_1 from "@/components/blocks/page-header-1";
import B_page_header_2 from "@/components/blocks/page-header-2";
import B_page_header_3 from "@/components/blocks/page-header-3";
import B_page_header_4 from "@/components/blocks/page-header-4";
import B_page_header_5 from "@/components/blocks/page-header-5";
import B_page_header_6 from "@/components/blocks/page-header-6";
import B_pricing_1 from "@/components/blocks/pricing-1";
import B_pricing_2 from "@/components/blocks/pricing-2";
import B_pricing_3 from "@/components/blocks/pricing-3";
import B_pricing_4 from "@/components/blocks/pricing-4";
import B_pricing_5 from "@/components/blocks/pricing-5";
import B_profile_1 from "@/components/blocks/profile-1";
import B_profile_2 from "@/components/blocks/profile-2";
import B_profile_3 from "@/components/blocks/profile-3";
import B_roadmap_1 from "@/components/blocks/roadmap-1";
import B_roadmap_2 from "@/components/blocks/roadmap-2";
import B_roadmap_3 from "@/components/blocks/roadmap-3";
import B_roadmap_4 from "@/components/blocks/roadmap-4";
import B_search_1 from "@/components/blocks/search-1";
import B_search_2 from "@/components/blocks/search-2";
import B_settings_4 from "@/components/blocks/settings-4";
import B_stats_1 from "@/components/blocks/stats-1";
import B_stats_2 from "@/components/blocks/stats-2";
import B_stats_3 from "@/components/blocks/stats-3";
import B_stats_4 from "@/components/blocks/stats-4";
import B_stats_5 from "@/components/blocks/stats-5";
import B_status_1 from "@/components/blocks/status-1";
import B_status_3 from "@/components/blocks/status-3";
import B_steps_1 from "@/components/blocks/steps-1";
import B_steps_2 from "@/components/blocks/steps-2";
import B_steps_3 from "@/components/blocks/steps-3";
import B_table_3 from "@/components/blocks/table-3";
import B_team_1 from "@/components/blocks/team-1";
import B_team_2 from "@/components/blocks/team-2";
import B_team_3 from "@/components/blocks/team-3";
import B_testimonials_1 from "@/components/blocks/testimonials-1";
import B_testimonials_2 from "@/components/blocks/testimonials-2";
import B_testimonials_3 from "@/components/blocks/testimonials-3";
import B_testimonials_4 from "@/components/blocks/testimonials-4";
import B_timeline_1 from "@/components/blocks/timeline-1";
import B_timeline_2 from "@/components/blocks/timeline-2";

/** Component by registry name. */
export const BLOCKS: Record<string, React.ComponentType> = {
  "about-1": B_about_1,
  "about-2": B_about_2,
  "about-3": B_about_3,
  "about-4": B_about_4,
  "activity-1": B_activity_1,
  "activity-3": B_activity_3,
  "activity-4": B_activity_4,
  "announcement-1": B_announcement_1,
  "announcement-2": B_announcement_2,
  "announcement-3": B_announcement_3,
  "announcement-4": B_announcement_4,
  "article-1": B_article_1,
  "article-2": B_article_2,
  "article-4": B_article_4,
  "article-5": B_article_5,
  "auth-6": B_auth_6,
  "auth-7": B_auth_7,
  "bento-1": B_bento_1,
  "bento-2": B_bento_2,
  "bento-3": B_bento_3,
  "bento-4": B_bento_4,
  "billing-4": B_billing_4,
  "billing-5": B_billing_5,
  "billing-6": B_billing_6,
  "blog-1": B_blog_1,
  "blog-2": B_blog_2,
  "blog-3": B_blog_3,
  "blog-4": B_blog_4,
  "blog-5": B_blog_5,
  "calendar-1": B_calendar_1,
  "calendar-2": B_calendar_2,
  "calendar-3": B_calendar_3,
  "careers-1": B_careers_1,
  "careers-2": B_careers_2,
  "careers-3": B_careers_3,
  "careers-4": B_careers_4,
  "changelog-1": B_changelog_1,
  "changelog-2": B_changelog_2,
  "changelog-3": B_changelog_3,
  "changelog-4": B_changelog_4,
  "changelog-5": B_changelog_5,
  "charts-1": B_charts_1,
  "charts-2": B_charts_2,
  "charts-3": B_charts_3,
  "charts-4": B_charts_4,
  "charts-5": B_charts_5,
  "coming-soon-1": B_coming_soon_1,
  "coming-soon-2": B_coming_soon_2,
  "coming-soon-3": B_coming_soon_3,
  "coming-soon-4": B_coming_soon_4,
  "coming-soon-5": B_coming_soon_5,
  "comparison-1": B_comparison_1,
  "comparison-2": B_comparison_2,
  "comparison-3": B_comparison_3,
  "comparison-4": B_comparison_4,
  "cookie-consent-1": B_cookie_consent_1,
  "cookie-consent-2": B_cookie_consent_2,
  "cookie-consent-3": B_cookie_consent_3,
  "cookie-consent-4": B_cookie_consent_4,
  "cookie-consent-5": B_cookie_consent_5,
  "cta-1": B_cta_1,
  "cta-2": B_cta_2,
  "cta-3": B_cta_3,
  "cta-4": B_cta_4,
  "cta-5": B_cta_5,
  "cta-6": B_cta_6,
  "dashboard-1": B_dashboard_1,
  "dashboard-2": B_dashboard_2,
  "dashboard-3": B_dashboard_3,
  "dashboard-4": B_dashboard_4,
  "error-1": B_error_1,
  "error-2": B_error_2,
  "error-3": B_error_3,
  "error-4": B_error_4,
  "error-5": B_error_5,
  "error-6": B_error_6,
  "faqs-1": B_faqs_1,
  "faqs-2": B_faqs_2,
  "features-1": B_features_1,
  "features-2": B_features_2,
  "features-3": B_features_3,
  "features-4": B_features_4,
  "features-5": B_features_5,
  "file-upload-4": B_file_upload_4,
  "file-upload-5": B_file_upload_5,
  "footer-1": B_footer_1,
  "footer-2": B_footer_2,
  "footer-5": B_footer_5,
  "gallery-1": B_gallery_1,
  "gallery-2": B_gallery_2,
  "gallery-3": B_gallery_3,
  "gallery-4": B_gallery_4,
  "hero-1": B_hero_1,
  "hero-2": B_hero_2,
  "hero-3": B_hero_3,
  "hero-5": B_hero_5,
  "hero-6": B_hero_6,
  "how-it-works-1": B_how_it_works_1,
  "how-it-works-2": B_how_it_works_2,
  "how-it-works-3": B_how_it_works_3,
  "how-it-works-4": B_how_it_works_4,
  "integrations-4": B_integrations_4,
  "integrations-5": B_integrations_5,
  "kanban-1": B_kanban_1,
  "kanban-2": B_kanban_2,
  "kanban-3": B_kanban_3,
  "kanban-4": B_kanban_4,
  "logo-cloud-1": B_logo_cloud_1,
  "logo-cloud-2": B_logo_cloud_2,
  "logo-cloud-3": B_logo_cloud_3,
  "logo-cloud-4": B_logo_cloud_4,
  "logo-cloud-5": B_logo_cloud_5,
  "newsletter-4": B_newsletter_4,
  "newsletter-5": B_newsletter_5,
  "notifications-2": B_notifications_2,
  "notifications-3": B_notifications_3,
  "notifications-4": B_notifications_4,
  "notifications-5": B_notifications_5,
  "onboarding-1": B_onboarding_1,
  "onboarding-2": B_onboarding_2,
  "onboarding-4": B_onboarding_4,
  "onboarding-5": B_onboarding_5,
  "onboarding-6": B_onboarding_6,
  "page-header-1": B_page_header_1,
  "page-header-2": B_page_header_2,
  "page-header-3": B_page_header_3,
  "page-header-4": B_page_header_4,
  "page-header-5": B_page_header_5,
  "page-header-6": B_page_header_6,
  "pricing-1": B_pricing_1,
  "pricing-2": B_pricing_2,
  "pricing-3": B_pricing_3,
  "pricing-4": B_pricing_4,
  "pricing-5": B_pricing_5,
  "profile-1": B_profile_1,
  "profile-2": B_profile_2,
  "profile-3": B_profile_3,
  "roadmap-1": B_roadmap_1,
  "roadmap-2": B_roadmap_2,
  "roadmap-3": B_roadmap_3,
  "roadmap-4": B_roadmap_4,
  "search-1": B_search_1,
  "search-2": B_search_2,
  "settings-4": B_settings_4,
  "stats-1": B_stats_1,
  "stats-2": B_stats_2,
  "stats-3": B_stats_3,
  "stats-4": B_stats_4,
  "stats-5": B_stats_5,
  "status-1": B_status_1,
  "status-3": B_status_3,
  "steps-1": B_steps_1,
  "steps-2": B_steps_2,
  "steps-3": B_steps_3,
  "table-3": B_table_3,
  "team-1": B_team_1,
  "team-2": B_team_2,
  "team-3": B_team_3,
  "testimonials-1": B_testimonials_1,
  "testimonials-2": B_testimonials_2,
  "testimonials-3": B_testimonials_3,
  "testimonials-4": B_testimonials_4,
  "timeline-1": B_timeline_1,
  "timeline-2": B_timeline_2,
};

/** Registry name -> what 7Ovr calls it, kept so the gallery can show a real
 *  title rather than "hero-3". */
export const BLOCK_META: Record<string, { title: string; cats: string }> = {
  "hero-1": {"title":"Centered Hero With Trust Logos","cats":"hero"},
  "features-1": {"title":"Six Card Icon Grid","cats":"features"},
  "dashboard-1": {"title":"Overview With Range Select","cats":"dashboard"},
  "footer-1": {"title":"Brand Blurb With Link Columns","cats":"footer"},
  "cta-1": {"title":"Centered CTA Band","cats":"cta"},
  "logo-cloud-1": {"title":"Trusted By Logo Grid","cats":"logo-cloud"},
  "faqs-1": {"title":"Centered FAQ Accordion","cats":"faqs"},
  "pricing-1": {"title":"Three Tier Plan Cards","cats":"pricing"},
  "testimonials-1": {"title":"Bordered Quote Trio","cats":"testimonials"},
  "stats-1": {"title":"Bordered Four-Up Stat Band","cats":"stats"},
  "bento-1": {"title":"Icon Bento With Hero Tile","cats":"bento"},
  "how-it-works-1": {"title":"Three Step Icon Cards","cats":"how-it-works"},
  "announcement-1": {"title":"Dismissible Bar And Callout","cats":"announcement"},
  "blog-1": {"title":"Three Card Post Grid","cats":"blog"},
  "team-1": {"title":"Member Cards With Socials","cats":"team"},
  "comparison-1": {"title":"Two-Plan Table With Billing Toggle","cats":"comparison"},
  "gallery-1": {"title":"Filterable Photo Grid","cats":"gallery"},
  "onboarding-1": {"title":"Welcome Checklist Card","cats":"onboarding"},
  "kanban-1": {"title":"Three Column Task Board","cats":"kanban"},
  "calendar-1": {"title":"Month Grid With Day Detail","cats":"calendar"},
  "charts-1": {"title":"Revenue Bars With Year Select","cats":"charts"},
  "bento-2": {"title":"Equal Four-Tile Bento","cats":"bento"},
  "how-it-works-2": {"title":"Vertical Numbered Timeline","cats":"how-it-works"},
  "announcement-2": {"title":"Product Update Card","cats":"announcement"},
  "blog-2": {"title":"Divider Separated Post List","cats":"blog"},
  "team-2": {"title":"Department Badge Grid","cats":"team"},
  "comparison-2": {"title":"Us Versus Them Cards","cats":"comparison"},
  "gallery-2": {"title":"Product Screenshot Showcase","cats":"gallery"},
  "onboarding-2": {"title":"Three-Card Setup Steps","cats":"onboarding"},
  "notifications-2": {"title":"Bell Popover With Badge","cats":"notifications"},
  "kanban-2": {"title":"Single In Progress Column","cats":"kanban"},
  "calendar-2": {"title":"Weekly Agenda View","cats":"calendar"},
  "charts-2": {"title":"Active Users Area Trend","cats":"charts"},
  "hero-2": {"title":"Split Hero With Dashboard Mockup","cats":"hero"},
  "features-2": {"title":"Alternating Rows With Stats","cats":"features"},
  "pricing-2": {"title":"Two Plan Split Panel","cats":"pricing"},
  "testimonials-2": {"title":"Single Voice Spotlight","cats":"testimonials"},
  "stats-2": {"title":"Minimal Numbers Band","cats":"stats"},
  "logo-cloud-2": {"title":"Integrations Logo Grid","cats":"logo-cloud"},
  "cta-2": {"title":"Compact CTA Card","cats":"cta"},
  "faqs-2": {"title":"Two-Column FAQ Accordion","cats":"faqs"},
  "footer-2": {"title":"Slim Single Bar","cats":"footer"},
  "dashboard-2": {"title":"KPI Cards And Activity Feed","cats":"dashboard"},
  "hero-3": {"title":"Left-Aligned Hero With Metrics","cats":"hero"},
  "features-3": {"title":"Everything Included Checklist","cats":"features"},
  "pricing-3": {"title":"Single Plan Spotlight","cats":"pricing"},
  "cta-3": {"title":"Inverted Banner CTA","cats":"cta"},
  "dashboard-3": {"title":"Flush Six Metric Strip","cats":"dashboard"},
  "table-3": {"title":"Invoice Line Items Summary","cats":"table"},
  "hero-5": {"title":"Hero With Demo Video Dialog","cats":"hero"},
  "logo-cloud-3": {"title":"Auto-Scrolling Logo Marquee","cats":"logo-cloud"},
  "logo-cloud-4": {"title":"Logo Grid With Tooltips","cats":"logo-cloud"},
  "cta-4": {"title":"Email Capture CTA","cats":"cta"},
  "cta-5": {"title":"Split CTA With App Preview","cats":"cta"},
  "newsletter-4": {"title":"Topic Picker Double Opt-In","cats":"newsletter"},
  "newsletter-5": {"title":"Newsletter Signup With Social Proof","cats":"newsletter"},
  "announcement-3": {"title":"Persisted Dismissible Banner","cats":"announcement"},
  "announcement-4": {"title":"Sale Countdown Promo Bar","cats":"announcement"},
  "integrations-4": {"title":"Connection Toggle Settings","cats":"integrations"},
  "features-4": {"title":"Tabbed Feature Categories","cats":"features"},
  "pricing-4": {"title":"Annual Savings Toggle","cats":"pricing"},
  "testimonials-3": {"title":"Wall Of Love Grid","cats":"testimonials"},
  "stats-4": {"title":"Count-Up Stats On Scroll","cats":"stats"},
  "bento-4": {"title":"Bento With Static Chart Visuals","cats":"bento"},
  "how-it-works-3": {"title":"Clickable Horizontal Stepper","cats":"how-it-works"},
  "how-it-works-4": {"title":"Zig-Zag Steps With Mockups","cats":"how-it-works"},
  "blog-3": {"title":"Filterable Blog Index","cats":"blog"},
  "blog-4": {"title":"Horizontal Media Cards","cats":"blog"},
  "team-3": {"title":"Hover Reveal Bio Cards","cats":"team"},
  "comparison-3": {"title":"Three-Plan Feature Matrix","cats":"comparison"},
  "gallery-3": {"title":"Masonry Column Gallery","cats":"gallery"},
  "gallery-4": {"title":"Grayscale Mosaic With Lightbox","cats":"gallery"},
  "notifications-3": {"title":"Notification Center Tabs","cats":"notifications"},
  "billing-4": {"title":"Usage Metering Card","cats":"billing"},
  "onboarding-4": {"title":"First-Run Welcome Screen","cats":"onboarding"},
  "calendar-3": {"title":"Month And Week Toggle","cats":"calendar"},
  "file-upload-4": {"title":"Image Gallery Uploader","cats":"file-upload"},
  "charts-3": {"title":"Traffic Range Switcher","cats":"charts"},
  "error-1": {"title":"404 Not Found With Actions","cats":"error"},
  "cookie-consent-1": {"title":"Bottom Cookie Bar","cats":"cookie-consent"},
  "page-header-1": {"title":"Title With Export Actions","cats":"page-header"},
  "coming-soon-1": {"title":"Centered Waitlist Capture","cats":"coming-soon"},
  "error-2": {"title":"404 With Search And Links","cats":"error"},
  "error-3": {"title":"500 Server Error With Retry","cats":"error"},
  "cookie-consent-2": {"title":"Corner Consent Card","cats":"cookie-consent"},
  "cookie-consent-3": {"title":"Cookie Preferences Panel","cats":"cookie-consent"},
  "cookie-consent-4": {"title":"Blocking Consent Dialog","cats":"cookie-consent"},
  "page-header-2": {"title":"Breadcrumb Header With Status","cats":"page-header"},
  "page-header-3": {"title":"Header With Section Tabs","cats":"page-header"},
  "page-header-4": {"title":"Detail Header With Back Link","cats":"page-header"},
  "coming-soon-2": {"title":"Split Waitlist With Preview","cats":"coming-soon"},
  "coming-soon-3": {"title":"Launch Countdown Timer","cats":"coming-soon"},
  "coming-soon-4": {"title":"Full-Bleed Gradient Launch","cats":"coming-soon"},
  "stats-3": {"title":"Stat Cards With Trend Arrows","cats":"stats"},
  "bento-3": {"title":"Divided Bento With Terminal Snippet","cats":"bento"},
  "timeline-1": {"title":"Milestone Rail With Status","cats":"timeline"},
  "timeline-2": {"title":"Alternating Spine Story","cats":"timeline"},
  "changelog-1": {"title":"Version Rail Release Notes","cats":"changelog"},
  "changelog-2": {"title":"Tabbed Change Filter","cats":"changelog"},
  "changelog-3": {"title":"In-App What's New Card","cats":"changelog"},
  "changelog-4": {"title":"Vertical Release Timeline","cats":"changelog"},
  "roadmap-1": {"title":"Status Kanban Board","cats":"roadmap"},
  "roadmap-2": {"title":"Now Next Later Phases","cats":"roadmap"},
  "roadmap-3": {"title":"Upvotable Feature Requests","cats":"roadmap"},
  "roadmap-4": {"title":"Quarterly Roadmap Columns","cats":"roadmap"},
  "article-1": {"title":"Centered Blog Post","cats":"article"},
  "article-2": {"title":"Article With Scroll-Spy Contents","cats":"article"},
  "article-4": {"title":"Magazine Feature With Drop Cap","cats":"article"},
  "profile-1": {"title":"Public Profile With Tabs","cats":"profile"},
  "profile-2": {"title":"Compact Profile Card","cats":"profile"},
  "profile-3": {"title":"Organization Profile Card","cats":"profile"},
  "steps-1": {"title":"Horizontal Numbered Stepper","cats":"steps"},
  "steps-2": {"title":"Vertical Stepper With Descriptions","cats":"steps"},
  "steps-3": {"title":"Wizard Progress Bar Header","cats":"steps"},
  "activity-1": {"title":"Recent Activity Card","cats":"activity"},
  "activity-3": {"title":"Audit Log With Icon Tiles","cats":"activity"},
  "activity-4": {"title":"Activity Tabs With Unread","cats":"activity"},
  "search-1": {"title":"Faceted Docs Search Panel","cats":"search"},
  "search-2": {"title":"Search Results Page","cats":"search"},
  "careers-1": {"title":"Open Roles By Department","cats":"careers"},
  "careers-2": {"title":"Job Posting Detail Page","cats":"careers"},
  "careers-3": {"title":"Culture And Benefits Page","cats":"careers"},
  "about-1": {"title":"Mission Statement With Stats","cats":"about"},
  "about-2": {"title":"Founder Story With Photo","cats":"about"},
  "status-1": {"title":"All Systems Operational Summary","cats":"status"},
  "status-3": {"title":"90 Day Uptime Bars","cats":"status"},
  "testimonials-4": {"title":"Star Rated Review Cards","cats":"testimonials"},
  "stats-5": {"title":"Inverted Stats Panel","cats":"stats"},
  "about-3": {"title":"Values Card Grid","cats":"about"},
  "about-4": {"title":"Mission Vision Values Columns","cats":"about"},
  "features-5": {"title":"Security Feature Spotlight","cats":"features"},
  "hero-6": {"title":"Hero With Avatar Social Proof","cats":"hero"},
  "pricing-5": {"title":"Plan Comparison Table","cats":"pricing"},
  "comparison-4": {"title":"Named Competitor Table","cats":"comparison"},
  "dashboard-4": {"title":"Overview With Recent Orders","cats":"dashboard"},
  "charts-4": {"title":"Monthly Visitors Line","cats":"charts"},
  "charts-5": {"title":"Traffic Source Donut","cats":"charts"},
  "auth-6": {"title":"Forgot Password Request","cats":"auth"},
  "auth-7": {"title":"Set New Password With Rules","cats":"auth"},
  "kanban-3": {"title":"Four Column Project Board","cats":"kanban"},
  "kanban-4": {"title":"Personal Task Lanes","cats":"kanban"},
  "error-4": {"title":"403 Access Denied","cats":"error"},
  "error-5": {"title":"Scheduled Maintenance Page","cats":"error"},
  "error-6": {"title":"Oversized 404 Numeral","cats":"error"},
  "page-header-5": {"title":"Header With Search Toolbar","cats":"page-header"},
  "page-header-6": {"title":"Header With Metrics Strip","cats":"page-header"},
  "changelog-5": {"title":"Sticky Version Jump Sidebar","cats":"changelog"},
  "blog-5": {"title":"Blog With Sticky Sidebar","cats":"blog"},
  "article-5": {"title":"Article With Author Sidebar","cats":"article"},
  "coming-soon-5": {"title":"Launch Progress Milestones","cats":"coming-soon"},
  "cookie-consent-5": {"title":"Expandable Consent Banner","cats":"cookie-consent"},
  "careers-4": {"title":"Filterable Jobs Board","cats":"careers"},
  "cta-6": {"title":"App Download CTA","cats":"cta"},
  "footer-5": {"title":"Call To Action Footer","cats":"footer"},
  "onboarding-5": {"title":"Invite Your Team Step","cats":"onboarding"},
  "onboarding-6": {"title":"Dismissible Getting Started Widget","cats":"onboarding"},
  "billing-5": {"title":"Saved Payment Methods","cats":"billing"},
  "billing-6": {"title":"Add Card Form","cats":"billing"},
  "notifications-4": {"title":"Notification Preferences Toggles","cats":"notifications"},
  "notifications-5": {"title":"Dismissible Alert Stack","cats":"notifications"},
  "integrations-5": {"title":"Split Logo Grid With CTA","cats":"integrations"},
  "logo-cloud-5": {"title":"Minimal Trust Strip","cats":"logo-cloud"},
  "settings-4": {"title":"Section Nav Settings Layout","cats":"settings"},
  "file-upload-5": {"title":"Avatar Photo Uploader","cats":"file-upload"},
};

/** The 7Ovr categories, which are the vocabulary the whole template world uses
 *  -- the same shelves 21st.dev and landingfolio run. Kept as THEIR names here;
 *  the Chinese shelf names a customer reads are a separate decision. */
export const BLOCK_CATEGORIES: Record<string, string[]> = {
  "hero": ["hero-1", "hero-2", "hero-3", "hero-5", "hero-6"],
  "features": ["features-1", "features-2", "features-3", "features-4", "features-5"],
  "dashboard": ["dashboard-1", "dashboard-2", "dashboard-3", "dashboard-4"],
  "footer": ["footer-1", "footer-2", "footer-5"],
  "cta": ["cta-1", "cta-2", "cta-3", "cta-4", "cta-5", "cta-6"],
  "logo-cloud": ["logo-cloud-1", "logo-cloud-2", "logo-cloud-3", "logo-cloud-4", "logo-cloud-5"],
  "faqs": ["faqs-1", "faqs-2"],
  "pricing": ["pricing-1", "pricing-2", "pricing-3", "pricing-4", "pricing-5"],
  "testimonials": ["testimonials-1", "testimonials-2", "testimonials-3", "testimonials-4"],
  "stats": ["stats-1", "stats-2", "stats-4", "stats-3", "stats-5"],
  "bento": ["bento-1", "bento-2", "bento-4", "bento-3"],
  "how-it-works": ["how-it-works-1", "how-it-works-2", "how-it-works-3", "how-it-works-4"],
  "announcement": ["announcement-1", "announcement-2", "announcement-3", "announcement-4"],
  "blog": ["blog-1", "blog-2", "blog-3", "blog-4", "blog-5"],
  "team": ["team-1", "team-2", "team-3"],
  "comparison": ["comparison-1", "comparison-2", "comparison-3", "comparison-4"],
  "gallery": ["gallery-1", "gallery-2", "gallery-3", "gallery-4"],
  "onboarding": ["onboarding-1", "onboarding-2", "onboarding-4", "onboarding-5", "onboarding-6"],
  "kanban": ["kanban-1", "kanban-2", "kanban-3", "kanban-4"],
  "calendar": ["calendar-1", "calendar-2", "calendar-3"],
  "charts": ["charts-1", "charts-2", "charts-3", "charts-4", "charts-5"],
  "notifications": ["notifications-2", "notifications-3", "notifications-4", "notifications-5"],
  "table": ["table-3"],
  "newsletter": ["newsletter-4", "newsletter-5"],
  "integrations": ["integrations-4", "integrations-5"],
  "billing": ["billing-4", "billing-5", "billing-6"],
  "file-upload": ["file-upload-4", "file-upload-5"],
  "error": ["error-1", "error-2", "error-3", "error-4", "error-5", "error-6"],
  "cookie-consent": ["cookie-consent-1", "cookie-consent-2", "cookie-consent-3", "cookie-consent-4", "cookie-consent-5"],
  "page-header": ["page-header-1", "page-header-2", "page-header-3", "page-header-4", "page-header-5", "page-header-6"],
  "coming-soon": ["coming-soon-1", "coming-soon-2", "coming-soon-3", "coming-soon-4", "coming-soon-5"],
  "timeline": ["timeline-1", "timeline-2"],
  "changelog": ["changelog-1", "changelog-2", "changelog-3", "changelog-4", "changelog-5"],
  "roadmap": ["roadmap-1", "roadmap-2", "roadmap-3", "roadmap-4"],
  "article": ["article-1", "article-2", "article-4", "article-5"],
  "profile": ["profile-1", "profile-2", "profile-3"],
  "steps": ["steps-1", "steps-2", "steps-3"],
  "activity": ["activity-1", "activity-3", "activity-4"],
  "search": ["search-1", "search-2"],
  "careers": ["careers-1", "careers-2", "careers-3", "careers-4"],
  "about": ["about-1", "about-2", "about-3", "about-4"],
  "status": ["status-1", "status-3"],
  "auth": ["auth-6", "auth-7"],
  "settings": ["settings-4"],
};
