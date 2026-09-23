import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Hair Lookbook &
 * Consultation Gallery" (Task 405, pasted 2026-09-23). Same structure, same
 * copy, same sample looks/formulas he designed with -- Material 3 semantic
 * colours swapped for their arbitrary hex equivalents so Tailwind's own
 * generator produces them without touching swiss.css's `--color-primary` /
 * `--color-on-primary`.
 *
 * Server Component: the source has no real onclick/JS behaviour for this
 * page (category chips, search box, sort dropdown, "Copy" and "Present
 * Look"/"Apply to Ticket" buttons are all inert in his own markup too --
 * this is a sales-demo screenshot of the concept, not a wired feature), so
 * nothing here fakes interactivity the source doesn't have.
 *
 * `data-alt` in his source (a Stitch-internal field) is rendered here as a
 * real `alt` attribute -- the only non-literal change, needed so the images
 * aren't accessibility dead ends.
 *
 * WHAT IS REAL AND WHAT IS NOT: the six formulas/looks below are his own
 * sample content. None of it reads from a database -- there is no lookbook
 * table yet, so "Add Hairstyle Case" and "Copy" do nothing today.
 */
/* eslint-disable @next/next/no-img-element -- literal port of his Stitch
   source; these are AI-generated reference photos from an external CDN,
   not user-uploaded content that needs next/image's optimisation pipeline. */

type Look = {
  tag: string;
  level: string;
  stylistColor: string;
  stylist: string;
  location: string;
  ref: string;
  img: string;
  alt: string;
  title: string;
  subtitle: string;
  tags: string[];
  formula: string;
};

const LOOKS: Look[] = [
  {
    tag: "#MochaVelvet",
    level: "L6.1",
    stylistColor: "#1a9a4d",
    stylist: "Jasmine Teo",
    location: "Bangsar Studio Tier 1",
    ref: "WT-601",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0_N4yozMgrXF88RCZV4KFJOsFaJNFoGqkOOnoeAaeDSUSL7akfvlx-18cFzs5bKqz5W5mOKi3J_qR2Zx9yB5bYiiWPYGinHZHQWg_cj_ZUBz1YJU8na4PD_7IQNf1YXLtefZkcR-sC2ru9LILGQiQLUIyQuo0yiXVxrG7LNPnAUy4KtJTDsVQBXJF6bSqZ8jUwWEfMUDVTI06SUFGMUvnzEt-fpRAKaJFWZSBcjhasOUN8hyPwUpf",
    alt: "High-fashion studio editorial portrait of an Asian woman with long glossy hair styled in a smoky mocha velvet seamless balayage melt, soft natural waves, neutral cool undertones, cinematic chiaroscuro studio lighting, minimalist black wardrobe.",
    title: "Smoky Mocha Velvet Seamless Melt",
    subtitle: "Color Lead Formula · Cool Ash Diffusion",
    tags: ["Asian Coarse to Medium", "Cool & Olive Undertones", "12-Wk Low Regrowth"],
    formula: "Majirel 6.1 (35g) + Inoa 5.0 (15g) · 20Vol · Dia Light 7.12 Finish Gloss",
  },
  {
    tag: "#AirCurtain",
    level: "L5.0 Gloss",
    stylistColor: "#3b62d9",
    stylist: "Marcus Wong",
    location: "Perm Chamber B",
    ref: "WT-204",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBPwJJcgh-F0sj051mSPQ9BCBD9sp9D-2pXGbtwBxbqcL-cEJhJ64lO84PmMLs2prHqpIx7QsZsogIlMdDLgi57D8Ix9IdsGNGSsNpVtaU-hsfpNoJFumc-nWJKVuqTOyz9CzGLSQ3_c_cFC3FI80pT2o4QkQI_li5-hKdulDzxp5juEHJ4Toxz7g8e1H6g_1t5WA9GTD_rKiMSQDtCrbHfdqLFFeIp6jTZbz8LkK5cnDOuqNVyhHE-",
    alt: "Salon portrait of a woman showing textured Korean airy C-curl perm with face-framing curtain bangs, glossy espresso dark hair, soft bounce, shot in bright minimal modern salon with natural sunlight and neutral interior.",
    title: "Seoul Airy Digital C-Curl & Curtain Bangs",
    subtitle: "Senior Stylist · Structural Elasticity",
    tags: ["Fine & Flat Hair Friendly", "Oval & Square Shapes", "16-Wk Perm Longevity"],
    formula: "Shiseido Qurl M (18m) · 24mm Rods @ 100°C · Bond Acidic Glaze",
  },
  {
    tag: "#ChampagnePearl",
    level: "L10.2",
    stylistColor: "#000000",
    stylist: "Wei Lin (Lead)",
    location: "Director Formula",
    ref: "WT-910",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAAvJSg1--nh5cjDJgG_tDAtQiX2AHd4PKPSIG1GpXDOzUcqt7KOVUJgluG8JXy3WcyZLnB2r7V1p2QY9sT-zYvs8HaFR6wQlDQYn0aROofuMmRdDIKR0CUlZEhC1B_qrmbw2lojcdjcpH1vwJSPNIxTTdqPAkJIynsSwuJc1hbaBx3yZcxqvjLb5h3HWv4sbcN8bDcivx8bYTBdVEU3S6IRvxevKrS5cee-2Nvo5W6Uz2rX0F8-QQl",
    alt: "High key beauty editorial photograph of a model with sleek ultra-blonde hair in iridescent Nordic champagne tones, zero yellow brassiness, high gloss finish, pale clean background, crisp directional light.",
    title: "Nordic Champagne & Iridescent Pearl",
    subtitle: "Creative Director Special · Double Process Lift",
    tags: ["Pre-lightened / Virgin Hair", "Fair & Neutral Undertones", "5-Wk Scalp Retouch"],
    formula: "Blond Studio 9 · Dialight 10.21 (40g) + 9.02 (10g) 6Vol (18m)",
  },
  {
    tag: "#CopperSunset",
    level: "L7.43",
    stylistColor: "#a8710a",
    stylist: "Chloe Tan",
    location: "Bangsar Studio Tier 2",
    ref: "WT-743",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAawvM06JWo4qT28R4fMDptCl1Zp-RVEi5pka0dVgz-XbOCPG2GiLSGDOxiYwqvZ-K6hK9liZnl79ACTnvsgz8JqoaoY9OYH88E9ks1PqSrjx5pXxtG--phkyTPu_VMQshNwQqk_z4AgEW_70oUbOvB_EDDHayyAOXxsNLfBBirs-OTnnF4A3LWWx8sBxjit6tB2bWQ47J3lX_QghpLgdtTClLsac9ZHYhrMyC3DHzf3PKnPSClHoWB",
    alt: "Studio portrait of a client with warm Italian copper amber hair, vibrant golden terracotta tones, glossy silky finish, backlit to show warm translucent reflections, minimalist architectural setting.",
    title: "Italian Amber Copper & Golden Glaze",
    subtitle: "Colorist Formula · High Refraction Warmth",
    tags: ["All Hair Densities", "Warm Golden Undertones", "8-Wk Gloss Refresh"],
    formula: "Igora Royal 7-77 (30g) + 8-4 (20g) · Vibrance 8-77 Glaze",
  },
  {
    tag: "#HoneyToffee",
    level: "L8.3",
    stylistColor: "#1a9a4d",
    stylist: "Jasmine Teo",
    location: "Bangsar Studio Tier 1",
    ref: "WT-830",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDEL3s7mtmwFmN6l2vpoKhginzipZIqJtdbU6U0WM9R0g2uN6oRCdoTzHR_PF2gDSNvpz0qHtBsoOXB8kqYR1S1sKqEVEcXjPxw4oSnqpsy_us0YlEEXbnTqTYdMt2vfxpKF5OezqIcm0jiI89yz1UIv-oCIKig2DIKFLx6aEPRwsICiOXnLZGrugavVEvsF8KiVX-ygt2GxIPHO2Idzefuf5SkT4TIrMoN2ZfXCpmk2WYI3g0cawRd",
    alt: "High resolution studio photo of a female model from behind and profile showing sun-kissed honey toffee foilyage ribbons woven through brunette hair, textured layered styling, warm ambient room light, elegant clean salon aesthetic.",
    title: "Golden Honey Toffee Foilyage Ribbon",
    subtitle: "Color Lead · Hand-Painted Transition",
    tags: ["Brunette Transitions", "Neutral to Warm Skin", "14-Wk Low Maintenance"],
    formula: "Blonde Glam 20Vol · Shadow 6.01 · Gloss: 8.34 + 9.03 (1:1)",
  },
  {
    tag: "#LiquidGlass",
    level: "L4.0",
    stylistColor: "#000000",
    stylist: "Wei Lin (Lead)",
    location: "Inkarami Lab",
    ref: "WT-400",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDT_jInvQNnehCxTaHpxeCWdwe_i7oSpzDNrUJToK88hsEoJNpCKMbN7mrhEFnku1D-GrhpyrovVwtVlRTZPpvDKfPL8lt_mrNfU4oTlkcpwbO4vr0hzQpgrOYHh2IyO_Xx4VQg8t_-wc0BjiWcERMQcN695jhmh4PD7zmfDjXppVE-outL-v00cj4NZIYCkwgrzMArEToFDf08wFeeFVBnDNPbfLd4zAOG-mqnlKaJBBlffmkLySbH",
    alt: "Close up detailed hair editorial showing super straight obsidian black liquid glass hair with mirror-like shine, crisp blunt cut ends, sleek reflective treatment, high-contrast studio ring light, opulent salon quality.",
    title: "Deep Obsidian Liquid Glass Lamination",
    subtitle: "Creative Director Special · Keratin & Protein Infusion",
    tags: ["Damaged or Frizzy Hair", "All Complexions", "10-Wk Anti-Humidity"],
    formula: "Tokio Inkarami 0-4 System + Dia Light Clear Lamination (6Vol)",
  },
];

const CATEGORIES: { label: string; count: number; active?: boolean }[] = [
  { label: "All Swatches", count: 142, active: true },
  { label: "Balayage & Foil Melts", count: 48 },
  { label: "Warm Caramels & Coppers", count: 32 },
  { label: "Korean C-Curl & Perms", count: 26 },
  { label: "Platinum Ice & Vivid", count: 18 },
  { label: "Scalp & Texture Spa", count: 18 },
];

const LIFT_LEVELS: { level: string; label: string; color: string; active?: boolean }[] = [
  { level: "1", label: "L1 - Jet Black", color: "#101012" },
  { level: "2", label: "L2 - Darkest Brown", color: "#241c19" },
  { level: "3", label: "L3 - Dark Brown", color: "#35251d" },
  { level: "4", label: "L4 - Medium Brown", color: "#4a3225" },
  { level: "5", label: "L5 - Light Brown", color: "#674b35" },
  { level: "6", label: "L6 - Dark Blonde", color: "#876644" },
  { level: "7", label: "L7 - Medium Blonde", color: "#ad8859" },
  { level: "8.3", label: "L8 - Light Blonde (Active Target)", color: "#cfad75", active: true },
  { level: "9", label: "L9 - Very Light Blonde", color: "#ebd19a" },
  { level: "10", label: "L10 - Lightest Platinum", color: "#f7e8c3" },
];

export default function SalonLookbookPreview() {
  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="lookbook-and-formulas" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full pt-0 bg-[#f9f9fd] p-5">
            <div className="flex flex-col w-full">
              {/* Page Header & Actions */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-widest text-[#5e5e67] mb-1">
                    <span>Archive Series 2025</span>
                    <span>•</span>
                    <span className="text-[#1a1c1f] text-base leading-6 tracking-[-0.01em] font-semibold">Curated Lookbook</span>
                    <span>•</span>
                    <span className="bg-[#e8e8ec] text-[#47464b] px-1.5 py-0.5 rounded text-[10px]">Client Display Optimized</span>
                  </div>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                    Hair Lookbook &amp; Consultation Gallery
                  </h1>
                  <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5 max-w-2xl">
                    Client visual archive, shade consultation swatches, and technical finishing references for front-of-house
                    consultations.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="h-9 px-3.5 rounded-lg bg-[#ffffff] text-[#1a1c1f] shadow-sm hover:bg-[#eeedf1] transition-colors flex items-center gap-1.5 text-[13.5px] leading-5 font-medium">
                    <span className="material-symbols-outlined text-[17px]">fullscreen</span>
                    <span>Present to Client (Full Screen)</span>
                  </button>
                  <button className="h-9 px-3.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] transition-colors flex items-center gap-1.5 text-[13.5px] leading-5 font-medium shadow-sm">
                    <span className="material-symbols-outlined text-[17px]">add</span>
                    <span>Add Hairstyle Case</span>
                  </button>
                </div>
              </div>

              {/* 3-Item Quick Consultation Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {/* Panel 1: Skin Undertone */}
                <div className="bg-[#ffffff] p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">palette</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        01. Skin Undertone Match
                      </span>
                    </div>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] bg-[#eeedf1] px-1.5 py-0.5 rounded">
                      Active Profiler
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f3f3f7] rounded-lg">
                    <button className="h-8 rounded bg-[#000000] text-[#ffffff] text-[13.5px] leading-5 font-medium flex flex-col items-center justify-center leading-none">
                      <span>Cool</span>
                      <span className="text-[9.5px] opacity-75 mt-0.5">Ash / Pearl</span>
                    </button>
                    <button className="h-8 rounded text-[#1a1c1f] hover:bg-[#e8e8ec] transition-colors text-[13.5px] leading-5 flex flex-col items-center justify-center leading-none">
                      <span>Neutral</span>
                      <span className="text-[9.5px] text-[#5e5e67] mt-0.5">Mocha</span>
                    </button>
                    <button className="h-8 rounded text-[#1a1c1f] hover:bg-[#e8e8ec] transition-colors text-[13.5px] leading-5 flex flex-col items-center justify-center leading-none">
                      <span>Warm</span>
                      <span className="text-[9.5px] text-[#5e5e67] mt-0.5">Caramel</span>
                    </button>
                  </div>
                </div>

                {/* Panel 2: Lift Level Chart */}
                <div className="bg-[#ffffff] p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">tune</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        02. Lift Level Chart
                      </span>
                    </div>
                    <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f] bg-[#eeedf1] px-1.5 py-0.5 rounded">
                      Target: L8.3 Blonde
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    {LIFT_LEVELS.map((lv) => (
                      <div key={lv.level} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer" title={lv.label}>
                        <div
                          className={
                            "w-full rounded transition-transform " +
                            (lv.active ? "h-6 scale-105 shadow-sm" : "h-5 group-hover:scale-105")
                          }
                          style={{ backgroundColor: lv.color }}
                        />
                        <span
                          className={
                            "text-[10px] font-mono " + (lv.active ? "text-[#1a1c1f] font-bold" : "text-[#5e5e67]")
                          }
                        >
                          {lv.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 3: Regrowth & Refresh Cadence */}
                <div className="bg-[#ffffff] p-3 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">timelapse</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        03. Regrowth Cadence
                      </span>
                    </div>
                    <span className="text-[13.5px] leading-5 font-medium text-[#1a9a4d] bg-[#1a9a4d]/10 px-2 py-0.5 rounded text-[11px]">
                      Low Maintenance
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[13.5px] leading-5 font-medium">
                      <span>8 - 12 Weeks Cycle</span>
                      <span className="text-[#5e5e67] font-mono text-[12px]">Next: ~Wk 10</span>
                    </div>
                    <div className="w-full h-2 bg-[#eeedf1] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#000000] rounded-full w-2/3" />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#5e5e67]">
                      <span>Scalp Glaze (Wk 6)</span>
                      <span>Full Melt Retouch (Wk 12)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search & Category Filters Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-5">
                {/* Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.label}
                      className={
                        "h-8 px-3 rounded-lg text-[13.5px] leading-5 flex items-center gap-1 whitespace-nowrap shadow-sm " +
                        (c.active
                          ? "bg-[#000000] text-[#ffffff] font-medium"
                          : "bg-[#ffffff] text-[#1a1c1f] hover:bg-[#e8e8ec] transition-colors")
                      }
                    >
                      <span>{c.label}</span>
                      <span className={"text-[11px] font-mono " + (c.active ? "opacity-75" : "text-[#5e5e67]")}>{c.count}</span>
                    </button>
                  ))}
                </div>
                {/* Search & Quick Filter */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined text-[16px] text-[#5e5e67] absolute left-2.5">search</span>
                    <input
                      className="h-8 pl-8 pr-12 w-64 bg-[#ffffff] rounded-lg text-[13.5px] leading-5 text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none shadow-sm"
                      placeholder="Search tone, technique, base..."
                      type="text"
                    />
                    <span className="absolute right-2 px-1 rounded bg-[#eeedf1] font-mono text-[10px] text-[#5e5e67]">⌘K</span>
                  </div>
                  <div className="flex items-center bg-[#ffffff] px-2.5 h-8 rounded-lg shadow-sm cursor-pointer hover:bg-[#eeedf1] transition-colors">
                    <span className="text-[13.5px] leading-5 text-[#1a1c1f] mr-1">Curated Top Looks</span>
                    <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Lookbook Cards 3-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-7">
                {LOOKS.map((look) => (
                  <div key={look.ref} className="bg-[#ffffff] rounded-xl shadow-sm overflow-hidden flex flex-col group">
                    {/* Media Header */}
                    <div className="relative h-64 bg-[#e8e8ec] overflow-hidden">
                      <img
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        alt={look.alt}
                        src={look.img}
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#000000]/80 backdrop-blur-md text-[#ffffff] text-[11.5px] leading-4 tracking-[0.04em]">
                          {look.tag}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#ffffff]/90 backdrop-blur-md text-[#1a1c1f] font-mono text-[11px] font-semibold">
                          {look.level}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.5 rounded bg-[#ffffff]/90 backdrop-blur-md text-[#1a1c1f] text-[11.5px] font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: look.stylistColor }} />
                          {look.stylist}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-3 right-3 flex justify-between items-center text-[#ffffff] text-[11px] opacity-90 drop-shadow-sm font-mono">
                        <span>{look.location}</span>
                        <span>Ref: {look.ref}</span>
                      </div>
                    </div>
                    {/* Card Body */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">{look.title}</h2>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] text-[#5e5e67] uppercase tracking-wide mb-3">
                          {look.subtitle}
                        </p>
                        {/* Diagnostic Tags */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {look.tags.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-[#eeedf1] text-[11.5px] leading-4 tracking-[0.04em] text-[#47464b]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        {/* Technical Formula Box */}
                        <div className="bg-[#f3f3f7] p-2.5 rounded-lg mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">science</span> Lab Formula
                            </span>
                            <button className="text-[#5e5e67] hover:text-[#1a1c1f] text-[11px] flex items-center gap-0.5" title="Copy to clipboard">
                              <span className="material-symbols-outlined text-[13px]">content_copy</span> Copy
                            </button>
                          </div>
                          <p className="text-[13.5px] leading-[18px] text-[#1a1c1f] font-mono text-[12px] leading-relaxed">
                            {look.formula}
                          </p>
                        </div>
                      </div>
                      {/* Action Row */}
                      <div className="grid grid-cols-2 gap-2 pt-2 bg-[#ffffff]">
                        <button className="h-8 rounded bg-[#eeedf1] text-[#1a1c1f] hover:bg-[#e8e8ec] transition-colors text-[13.5px] leading-5 font-medium flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">visibility</span> Present Look
                        </button>
                        <button className="h-8 rounded bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] transition-colors text-[13.5px] leading-5 font-medium flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">add_task</span> Apply to Ticket
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Technical Pagination Footer Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-[#ffffff] rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em]">
                  <span className="uppercase tracking-widest text-[#1a1c1f] font-semibold">Showing 1 - 6 of 142 Technical Formulas</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">
                    Sorted by: <span className="text-[#1a1c1f] font-medium">Recently Mixed &amp; Audited</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="h-8 px-2 rounded bg-[#f3f3f7] text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors disabled:opacity-40" disabled>
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button className="h-8 w-8 rounded bg-[#000000] text-[#ffffff] font-mono text-[12px] font-medium">1</button>
                  <button className="h-8 w-8 rounded text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors font-mono text-[12px]">2</button>
                  <button className="h-8 w-8 rounded text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors font-mono text-[12px]">3</button>
                  <span className="px-1 text-[#5e5e67] font-mono text-[12px]">...</span>
                  <button className="h-8 w-8 rounded text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors font-mono text-[12px]">24</button>
                  <button className="h-8 px-2 rounded bg-[#f3f3f7] text-[#1a1c1f] hover:bg-[#eeedf1] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
