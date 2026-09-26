"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SalonSidebar } from "../salon-shell";
import { AddWorkPanel, type Stylist } from "./add-work-panel";
import { PresentLook } from "./present-look";
import { liftOf, type LookCard } from "./types";

/* eslint-disable @next/next/no-img-element -- the photos are signed, expiring
   URLs from a private bucket (and, in the empty-lookbook examples, an external
   CDN); next/image's optimiser cannot fetch either. */

const ALL = "All Swatches";

/**
 * Shown only while the lookbook is empty, so a new salon still sees what a look
 * card holds. They are drawn but never actionable: Apply to Ticket would write
 * an invented formula into a real client's note. The photos are the Stitch
 * design's own reference images (an external CDN, kept as it was).
 */
const EXAMPLES: LookCard[] = [
  {
    id: "example-1",
    title: "Smoky Mocha Velvet Melt",
    category: "Balayage & Foil Melts",
    level: "6.1",
    formula: "Majirel 6.1 (35g) + Inoa 5.0 (15g) · 20 vol · gloss 7.12",
    note: "Cool ash diffusion, low regrowth",
    tags: ["Cool undertone", "Coarse to medium hair", "12-week regrowth"],
    stylistName: "Example stylist",
    stylistColor: "#1a9a4d",
    photoUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA0_N4yozMgrXF88RCZV4KFJOsFaJNFoGqkOOnoeAaeDSUSL7akfvlx-18cFzs5bKqz5W5mOKi3J_qR2Zx9yB5bYiiWPYGinHZHQWg_cj_ZUBz1YJU8na4PD_7IQNf1YXLtefZkcR-sC2ru9LILGQiQLUIyQuo0yiXVxrG7LNPnAUy4KtJTDsVQBXJF6bSqZ8jUwWEfMUDVTI06SUFGMUvnzEt-fpRAKaJFWZSBcjhasOUN8hyPwUpf",
    addedLabel: "Example",
    addedAt: "2000-01-03T00:00:00Z",
    example: true,
  },
  {
    id: "example-2",
    title: "Airy C-Curl & Curtain Bangs",
    category: "Perms & Curls",
    level: "5",
    formula: "Digital perm · 24mm rods at 100°C · acidic glaze",
    note: "Soft bounce for fine, flat hair",
    tags: ["Neutral undertone", "Fine hair", "16-week longevity"],
    stylistName: "Example stylist",
    stylistColor: "#3b62d9",
    photoUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBPwJJcgh-F0sj051mSPQ9BCBD9sp9D-2pXGbtwBxbqcL-cEJhJ64lO84PmMLs2prHqpIx7QsZsogIlMdDLgi57D8Ix9IdsGNGSsNpVtaU-hsfpNoJFumc-nWJKVuqTOyz9CzGLSQ3_c_cFC3FI80pT2o4QkQI_li5-hKdulDzxp5juEHJ4Toxz7g8e1H6g_1t5WA9GTD_rKiMSQDtCrbHfdqLFFeIp6jTZbz8LkK5cnDOuqNVyhHE-",
    addedLabel: "Example",
    addedAt: "2000-01-02T00:00:00Z",
    example: true,
  },
  {
    id: "example-3",
    title: "Copper Sunset Gloss",
    category: "Warm Caramels & Coppers",
    level: "7.43",
    formula: "Igora Royal 7-77 (30g) + 8-4 (20g) · glaze 8-77",
    note: "High-refraction warmth",
    tags: ["Warm undertone", "All densities", "8-week gloss refresh"],
    stylistName: "Example stylist",
    stylistColor: "#a8710a",
    photoUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAawvM06JWo4qT28R4fMDptCl1Zp-RVEi5pka0dVgz-XbOCPG2GiLSGDOxiYwqvZ-K6hK9liZnl79ACTnvsgz8JqoaoY9OYH88E9ks1PqSrjx5pXxtG--phkyTPu_VMQshNwQqk_z4AgEW_70oUbOvB_EDDHayyAOXxsNLfBBirs-OTnnF4A3LWWx8sBxjit6tB2bWQ47J3lX_QghpLgdtTClLsac9ZHYhrMyC3DHzf3PKnPSClHoWB",
    addedLabel: "Example",
    addedAt: "2000-01-01T00:00:00Z",
    example: true,
  },
];

const LIFT_LEVELS: { level: number; label: string; color: string }[] = [
  { level: 1, label: "Level 1 · Jet Black", color: "#101012" },
  { level: 2, label: "Level 2 · Darkest Brown", color: "#241c19" },
  { level: 3, label: "Level 3 · Dark Brown", color: "#35251d" },
  { level: 4, label: "Level 4 · Medium Brown", color: "#4a3225" },
  { level: 5, label: "Level 5 · Light Brown", color: "#674b35" },
  { level: 6, label: "Level 6 · Dark Blonde", color: "#876644" },
  { level: 7, label: "Level 7 · Medium Blonde", color: "#ad8859" },
  { level: 8, label: "Level 8 · Light Blonde", color: "#cfad75" },
  { level: 9, label: "Level 9 · Very Light Blonde", color: "#ebd19a" },
  { level: 10, label: "Level 10 · Lightest Platinum", color: "#f7e8c3" },
];

const UNDERTONES = ["cool", "neutral", "warm"] as const;
type Undertone = (typeof UNDERTONES)[number];
type Sort = "newest" | "oldest" | "az";

export function LookbookClient({
  projectId,
  businessName,
  customers,
  stylists,
  works,
}: {
  projectId: string;
  businessName: string;
  customers: { id: string; name: string; note: string }[];
  stylists: Stylist[];
  works: LookCard[];
}) {
  const router = useRouter();
  const isEmpty = works.length === 0;
  const pool = isEmpty ? EXAMPLES : works;

  const [activeCategory, setActiveCategory] = useState(ALL);
  const [search, setSearch] = useState("");
  const [undertone, setUndertone] = useState<Undertone | null>(null);
  const [lift, setLift] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [adding, setAdding] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [captioningId, setCaptioningId] = useState<string | null>(null);
  const [captionCopiedId, setCaptionCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyTargetId, setApplyTargetId] = useState(customers[0]?.id ?? "");
  // A customer's note as this page has already extended it, so a second Apply to
  // the same client appends to the first instead of to the stale original.
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of pool) if (l.category) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
    return [{ label: ALL, count: pool.length }, ...[...counts].map(([label, count]) => ({ label, count }))];
  }, [pool]);
  // A category whose last look was just removed no longer exists: fall back to all.
  const category = categories.some((c) => c.label === activeCategory) ? activeCategory : ALL;

  const filtersOn = category !== ALL || search.trim() !== "" || undertone !== null || lift !== null;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = pool.filter((l) => {
      if (category !== ALL && l.category !== category) return false;
      if (undertone && ![...l.tags, l.note].some((t) => t.toLowerCase().includes(undertone))) return false;
      if (lift !== null && liftOf(l.level) !== lift) return false;
      if (!q) return true;
      return [l.title, l.category, l.level, l.formula, l.note, l.stylistName ?? "", ...l.tags].some((t) => t.toLowerCase().includes(q));
    });
    return list.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title)
      : sort === "oldest" ? a.addedAt.localeCompare(b.addedAt)
      : b.addedAt.localeCompare(a.addedAt));
  }, [pool, category, search, undertone, lift, sort]);

  function clearFilters() {
    setActiveCategory(ALL);
    setSearch("");
    setUndertone(null);
    setLift(null);
  }

  const copyFormula = async (look: LookCard) => {
    try {
      await navigator.clipboard.writeText(look.formula);
      setCopiedId(look.id);
      setTimeout(() => setCopiedId((r) => (r === look.id ? null : r)), 1500);
    } catch {
      setFlash({ ok: false, text: "Couldn't copy: your browser blocked clipboard access." });
    }
  };

  const presentFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {
      setFlash({ ok: false, text: "Your browser blocked full screen." });
    });
  };

  const applyToTicket = async (look: LookCard) => {
    const target = customers.find((c) => c.id === applyTargetId);
    if (!target) {
      setFlash({ ok: false, text: "Pick a client first (top right): there's no one to apply this formula to." });
      return;
    }
    setApplyingId(look.id);
    try {
      const supabase = createBrowserSupabaseClient();
      const line = `[${look.title}] ${look.formula}`;
      const current = notes[target.id] ?? target.note;
      const nextNote = current ? `${current}\n${line}` : line;
      const { error } = await supabase.rpc("update_directory_entry", { in_id: target.id, in_note: nextNote });
      if (error) {
        setFlash({ ok: false, text: `Couldn't apply: ${error.message}` });
        return;
      }
      setNotes((n) => ({ ...n, [target.id]: nextNote }));
      setAppliedId(look.id);
      setTimeout(() => setAppliedId((r) => (r === look.id ? null : r)), 1500);
    } finally {
      setApplyingId(null);
    }
  };

  /**
   * GlossGenius's 2026-07 "Genius AI" rebrand made this its headline: a
   * salon's own before/after work, turned into a post it can put up today.
   * The formula never leaves this component -- `/api/portal/caption` isn't
   * even sent it -- because it's the salon's own trade secret, not something
   * to hand a stranger reading Instagram.
   */
  const generateCaption = async (look: LookCard) => {
    setCaptioningId(look.id);
    try {
      const res = await fetch("/api/portal/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookId: look.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setFlash({ ok: false, text: "Couldn't write a caption for this one -- try again in a moment." });
        return;
      }
      setCaptions((c) => ({ ...c, [look.id]: data.text }));
    } catch {
      setFlash({ ok: false, text: "Couldn't reach the caption writer -- check your connection." });
    } finally {
      setCaptioningId(null);
    }
  };

  const copyCaption = async (look: LookCard) => {
    const text = captions[look.id];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCaptionCopiedId(look.id);
      setTimeout(() => setCaptionCopiedId((r) => (r === look.id ? null : r)), 1500);
    } catch {
      setFlash({ ok: false, text: "Couldn't copy: your browser blocked clipboard access." });
    }
  };

  const removeLook = async (look: LookCard) => {
    setBusyId(look.id);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_lookbook_work_archived", { in_id: look.id, in_archived: true });
      if (error) {
        setFlash({ ok: false, text: `Couldn't remove it: ${error.message}` });
        return;
      }
      setConfirmRemove(null);
      setFlash({ ok: true, text: `Removed "${look.title}" from the lookbook.` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="lookbook-and-formulas" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full pt-0 bg-[#f9f9fd] p-5">
          <div className="flex flex-col w-full">
            {/* Page Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-widest text-[#5e5e67] mb-1">
                  <span>{isEmpty ? "Examples" : "Your Lookbook"}</span>
                </div>
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                  Hair Lookbook &amp; Consultation Gallery
                </h1>
                <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5 max-w-2xl">
                  Client visual archive, shade consultation swatches, and technical finishing references for front-of-house consultations.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {!isEmpty && customers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] text-[#5e5e67] whitespace-nowrap">Applying formulas to:</span>
                    <select
                      value={applyTargetId}
                      onChange={(e) => setApplyTargetId(e.target.value)}
                      aria-label="Client to apply formulas to"
                      className="h-9 px-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb]/40 text-[13px] focus:outline-none cursor-pointer"
                    >
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={presentFullscreen}
                  className="h-9 px-3.5 rounded-lg bg-[#ffffff] text-[#1a1c1f] shadow-sm hover:bg-[#eeedf1] active:scale-[0.97] transition-colors flex items-center gap-1.5 text-[13.5px] leading-5 font-medium"
                >
                  <span className="material-symbols-outlined text-[17px]">fullscreen</span>
                  <span>Present to Client (Full Screen)</span>
                </button>
                <button
                  onClick={() => setAdding(true)}
                  className="h-9 px-3.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] active:scale-[0.97] transition-colors flex items-center gap-1.5 text-[13.5px] leading-5 font-medium shadow-sm"
                >
                  <span className="material-symbols-outlined text-[17px]">add</span>
                  <span>Add Hairstyle Case</span>
                </button>
              </div>
            </div>

            {flash && (
              <p
                role={flash.ok ? "status" : "alert"}
                data-testid="lookbook-flash"
                className={"mb-4 text-[13px] font-medium " + (flash.ok ? "text-[#047857]" : "text-[#ba1a1a]")}
              >
                {flash.text}
              </p>
            )}

            {isEmpty && (
              <div data-testid="lookbook-empty" className="mb-5 flex flex-col items-start gap-3 rounded-xl border border-dashed border-[#c8c5cb] bg-[#ffffff] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[26px] text-[#5e5e67]">photo_library</span>
                  <div>
                    <h2 className="text-base leading-6 font-semibold text-[#1a1c1f]">Your lookbook is empty</h2>
                    <p className="text-[13.5px] leading-5 text-[#5e5e67] max-w-xl">
                      The cards below are examples of what a look holds: a photo, the formula, who did it, and tags. Add your first look and they disappear.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdding(true)}
                  className="h-9 shrink-0 px-3.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] active:scale-[0.97] transition-colors flex items-center gap-1.5 text-[13.5px] font-medium"
                >
                  <span className="material-symbols-outlined text-[17px]">add</span>
                  <span>Add your first look</span>
                </button>
              </div>
            )}

            {/* 3-Item Quick Consultation Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">palette</span>
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">01. Skin Undertone Match</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f3f3f7] rounded-lg">
                  {UNDERTONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setUndertone((cur) => (cur === t ? null : t))}
                      aria-pressed={undertone === t}
                      title={`Looks tagged "${t}"`}
                      className={
                        "h-8 rounded text-[13.5px] leading-5 flex items-center justify-center capitalize active:scale-[0.97] transition-colors " +
                        (undertone === t ? "bg-[#000000] text-[#ffffff] font-medium" : "text-[#1a1c1f] hover:bg-[#e8e8ec]")
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">tune</span>
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">02. Lift Level Chart</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1 mt-1">
                  {LIFT_LEVELS.map((lv) => (
                    <button
                      key={lv.level}
                      onClick={() => setLift((cur) => (cur === lv.level ? null : lv.level))}
                      aria-pressed={lift === lv.level}
                      aria-label={lv.label}
                      className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                      title={lv.label}
                    >
                      <div className={"w-full rounded transition-transform " + (lift === lv.level ? "h-6 scale-105 shadow-sm ring-2 ring-[#000000]" : "h-5 group-hover:scale-105")} style={{ backgroundColor: lv.color }} />
                      <span className={"text-[10px] font-mono " + (lift === lv.level ? "text-[#1a1c1f] font-bold" : "text-[#5e5e67]")}>{lv.level}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#5e5e67] text-[16px]">timelapse</span>
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">03. Regrowth Cadence</span>
                  </div>
                </div>
                <p className="text-[12px] text-[#5e5e67] py-2">Depends on which look and which client -- pick a look below to see its own cycle.</p>
              </div>
            </div>

            {/* Search & Category Filters Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {categories.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setActiveCategory(c.label)}
                    className={
                      "h-8 px-3 rounded-lg text-[13.5px] leading-5 flex items-center gap-1 whitespace-nowrap shadow-sm active:scale-[0.97] " +
                      (category === c.label ? "bg-[#000000] text-[#ffffff] font-medium" : "bg-[#ffffff] text-[#1a1c1f] hover:bg-[#e8e8ec] transition-colors")
                    }
                  >
                    <span>{c.label}</span>
                    <span className={"text-[11px] font-mono " + (category === c.label ? "opacity-75" : "text-[#5e5e67]")}>{c.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[16px] text-[#5e5e67] absolute left-2.5">search</span>
                  <input
                    className="h-8 pl-8 pr-3 w-64 bg-[#ffffff] rounded-lg text-[13.5px] leading-5 text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none shadow-sm"
                    placeholder="Search tone, technique, base..."
                    aria-label="Search the lookbook"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <label className="relative flex items-center bg-[#ffffff] h-8 rounded-lg shadow-sm cursor-pointer hover:bg-[#eeedf1] transition-colors">
                  <span className="sr-only">Sort looks</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="appearance-none bg-transparent h-8 pl-2.5 pr-7 text-[13.5px] leading-5 text-[#1a1c1f] focus:outline-none cursor-pointer"
                  >
                    <option value="newest">Recently Added</option>
                    <option value="oldest">Oldest First</option>
                    <option value="az">Name A to Z</option>
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-[#5e5e67] absolute right-2 pointer-events-none">expand_more</span>
                </label>
              </div>
            </div>

            {/* Lookbook Cards 3-Column Grid */}
            {visible.length === 0 && (
              <div data-testid="lookbook-no-match" className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm py-10 text-center text-[13.5px] text-[#5e5e67] mb-7 flex flex-col items-center gap-3">
                <span>No looks match {filtersOn ? "these filters" : "yet"}.</span>
                {filtersOn && (
                  <button onClick={clearFilters} className="h-8 px-3 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] text-[13.5px] font-medium text-[#1a1c1f] transition-colors">
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-7">
              {visible.map((look, i) => (
                <div key={look.id} data-testid="lookbook-card" data-example={look.example ? "true" : undefined} className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm overflow-hidden flex flex-col group">
                  <div className="relative h-64 bg-[#e8e8ec] overflow-hidden">
                    {look.photoUrl ? (
                      <img className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" alt={look.title} src={look.photoUrl} loading="lazy" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-[#77767b]">
                        <span className="material-symbols-outlined text-[36px]">photo_camera</span>
                        <span className="text-[12px]">No photo yet</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 right-24 flex flex-wrap items-center gap-1.5">
                      {look.example && <span className="px-2 py-0.5 rounded bg-[#f59e0b] text-[#1a1c1f] text-[11.5px] leading-4 font-semibold">Example</span>}
                      {look.category && <span className="px-2 py-0.5 rounded bg-[#000000]/80 backdrop-blur-md text-[#ffffff] text-[11.5px] leading-4 tracking-[0.04em]">{look.category}</span>}
                      {look.level && <span className="px-1.5 py-0.5 rounded bg-[#ffffff]/90 backdrop-blur-md text-[#1a1c1f] font-mono text-[11px] font-semibold">L{look.level.replace(/^L/i, "")}</span>}
                    </div>
                    {look.stylistName && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.5 rounded bg-[#ffffff]/90 backdrop-blur-md text-[#1a1c1f] text-[11.5px] font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: look.stylistColor }} />
                          {look.stylistName}
                        </span>
                      </div>
                    )}
                    {!look.example && (
                      <div className={"absolute bottom-2 left-3 text-[11px] font-mono " + (look.photoUrl ? "text-[#ffffff] opacity-90 drop-shadow-sm" : "text-[#77767b]")}>
                        Added {look.addedLabel}
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">{look.title}</h2>
                        {!look.example && (
                          <button
                            onClick={() => setConfirmRemove(look.id)}
                            aria-label={`Remove ${look.title}`}
                            title="Remove from the lookbook"
                            className="h-7 w-7 shrink-0 rounded-lg text-[#77767b] hover:bg-[#f3f3f7] hover:text-[#ba1a1a] flex items-center justify-center transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                      {look.note && <p className="text-[11.5px] leading-4 tracking-[0.04em] text-[#5e5e67] uppercase tracking-wide mb-3">{look.note}</p>}
                      {look.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {look.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded bg-[#eeedf1] text-[11.5px] leading-4 tracking-[0.04em] text-[#47464b]">{t}</span>
                          ))}
                        </div>
                      )}
                      {look.formula && (
                        <div className="bg-[#f3f3f7] p-2.5 rounded-lg mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67] flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">science</span> Lab Formula
                            </span>
                            {!look.example && (
                              <button
                                onClick={() => copyFormula(look)}
                                className="text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] text-[11px] flex items-center gap-0.5"
                                title="Copy to clipboard"
                              >
                                <span className="material-symbols-outlined text-[13px]">{copiedId === look.id ? "check" : "content_copy"}</span>
                                {copiedId === look.id ? "Copied" : "Copy"}
                              </button>
                            )}
                          </div>
                          <p className="text-[12px] text-[#1a1c1f] font-mono leading-relaxed whitespace-pre-wrap">{look.formula}</p>
                        </div>
                      )}
                    </div>
                    {!look.example && confirmRemove === look.id ? (
                      <div data-testid="lookbook-confirm-remove" className="flex items-center gap-2 pt-2">
                        <span className="flex-1 text-[13px] text-[#1a1c1f]">Remove this look?</span>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          disabled={busyId === look.id}
                          className="h-8 px-3 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] text-[13.5px] font-medium transition-colors"
                        >
                          Keep
                        </button>
                        <button
                          onClick={() => removeLook(look)}
                          disabled={busyId === look.id}
                          className="h-8 px-3 rounded bg-[#ba1a1a] hover:bg-[#93000a] text-[#ffffff] text-[13.5px] font-medium transition-colors disabled:opacity-60"
                        >
                          {busyId === look.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    ) : !look.example ? (
                      <div className="grid grid-cols-2 gap-2 pt-2 bg-[#ffffff]">
                        <button
                          onClick={() => setPresenting(i)}
                          className="h-8 rounded bg-[#eeedf1] text-[#1a1c1f] hover:bg-[#e8e8ec] active:scale-[0.97] transition-colors text-[13.5px] leading-5 font-medium flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span> Present Look
                        </button>
                        <button
                          onClick={() => applyToTicket(look)}
                          disabled={applyingId === look.id || !look.formula}
                          title={look.formula ? undefined : "This look has no formula to apply"}
                          className="h-8 rounded bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] active:scale-[0.97] transition-colors text-[13.5px] leading-5 font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">{appliedId === look.id ? "check" : "add_task"}</span>
                          {appliedId === look.id ? "Applied" : applyingId === look.id ? "Applying…" : "Apply to Ticket"}
                        </button>
                      </div>
                    ) : null}
                    {!look.example && (
                      <div className="pt-2">
                        {captions[look.id] ? (
                          <div className="bg-[#f3f3f7] p-2.5 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">edit_note</span> Post Caption
                              </span>
                              <button
                                onClick={() => copyCaption(look)}
                                className="text-[#5e5e67] hover:text-[#1a1c1f] active:scale-[0.97] text-[11px] flex items-center gap-0.5"
                                title="Copy to clipboard"
                              >
                                <span className="material-symbols-outlined text-[13px]">{captionCopiedId === look.id ? "check" : "content_copy"}</span>
                                {captionCopiedId === look.id ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <p className="text-[12.5px] text-[#1a1c1f] leading-relaxed whitespace-pre-wrap">{captions[look.id]}</p>
                            <button
                              onClick={() => generateCaption(look)}
                              disabled={captioningId === look.id}
                              className="mt-2 text-[11px] text-[#5e5e67] hover:text-[#1a1c1f] disabled:opacity-50"
                            >
                              {captioningId === look.id ? "Rewriting…" : "Rewrite"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => generateCaption(look)}
                            disabled={captioningId === look.id}
                            className="w-full h-8 rounded bg-[#eeedf1] text-[#1a1c1f] hover:bg-[#e8e8ec] active:scale-[0.97] transition-colors text-[13.5px] leading-5 font-medium flex items-center justify-center gap-1 disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit_note</span>
                            {captioningId === look.id ? "Writing…" : "Turn into a Caption"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm">
              <div className="flex items-center gap-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em]">
                <span data-testid="lookbook-count" className="uppercase tracking-widest text-[#1a1c1f] font-semibold">
                  {visible.length > 0 ? `Showing 1 - ${visible.length} of ` : "Showing 0 of "}
                  {pool.length} {isEmpty ? "Example" : "Saved"} {pool.length === 1 ? "Look" : "Looks"}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {adding && (
        <AddWorkPanel
          projectId={projectId}
          stylists={stylists}
          categories={categories.filter((c) => c.label !== ALL).map((c) => c.label)}
          onClose={() => setAdding(false)}
          onAdded={(title) => setFlash({ ok: true, text: `Added "${title}" to the lookbook.` })}
        />
      )}

      {presenting !== null && !isEmpty && (
        <PresentLook
          looks={visible}
          index={Math.min(presenting, visible.length - 1)}
          onIndex={setPresenting}
          onClose={() => setPresenting(null)}
        />
      )}
    </div>
  );
}
