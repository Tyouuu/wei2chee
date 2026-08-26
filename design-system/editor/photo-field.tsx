"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * How a photograph gets onto a customer's page.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * The field was a text input labelled 「照片网址（留空就是空框）」. A renovation
 * contractor does not have a photo URL. He has a photo, on his phone, of the
 * kitchen he finished last week — which is the single most persuasive thing
 * that could be on his website, and the product was asking him to paste a link
 * to it.
 *
 * The founder found the consequence on his own phone: three grey boxes reading
 * 「Add a photo」, one per screen, on the live published site. That is fixed on
 * the publishing side — an unfilled frame no longer publishes — but a page
 * with the section removed is not the goal. The goal is his photo.
 *
 * ── THE THREE SOURCES, IN THE ORDER THEY DESERVE ──────────────────────────
 *
 * 1. HIS OWN, straight off the device he is holding. The only one that answers
 *    the question a homeowner is actually asking: what does this contractor's
 *    work look like.
 * 2. THE LIBRARY. 「不滿意 可以再去圖庫推薦」 — ask again, get different ones. For
 *    the trades that genuinely have nothing to photograph: a wholesaler, a
 *    bookkeeper, an agent.
 * 3. GENERATED. Not built. Named here so the seam is visible rather than
 *    implied.
 *
 * All three land in one bucket and come back as one URL, so nothing downstream
 * — the page, the projection, the published site — has to know which it was.
 */
export function PhotoField({
  value,
  onChange,
  trade,
}: {
  value?: string;
  onChange: (next: string) => void;
  /** The customer's industry slug, the library's opening guess. */
  trade?: string;
}) {
  const [tab, setTab] = useState<"own" | "library">("own");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── his own ─────────────────────────────────────────────────────────── */
  async function upload(file: File) {
    setError(null);
    setBusy("upload");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("请先登入");
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("account_id", auth.user.id)
        .single();
      if (!project) throw new Error("找不到你的系统");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${project.id}/${crypto.randomUUID()}.${ext}`;
      // Straight to storage with the owner's own session. Storage RLS
      // (migration 20260826050000) is what confines the write to their own
      // folder, so the bytes never pass through our server at all.
      const { error: up } = await supabase.storage
        .from("site-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up) throw new Error(up.message);
      const { data } = supabase.storage.from("site-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(null);
    }
  }

  /* ── the library ─────────────────────────────────────────────────────── */
  type Photo = { id: string; thumb: string; full: string; credit: string };
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [noKey, setNoKey] = useState(false);
  const [q, setQ] = useState("");
  const seen = useRef<string[]>([]);

  async function ask(nextPage = 1, reset = false) {
    setError(null);
    setBusy("search");
    try {
      if (reset) seen.current = [];
      const url = new URL("/api/photos", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (trade) url.searchParams.set("trade", trade);
      url.searchParams.set("page", String(nextPage));
      // 「不滿意 可以再去圖庫推薦」: everything already offered is excluded, so
      // pressing again never returns the same photograph twice.
      url.searchParams.set("exclude", seen.current.slice(-60).join(","));
      const res = await fetch(url);
      const body = await res.json();
      if (body.reason === "no-key") {
        setNoKey(true);
        setPhotos([]);
        return;
      }
      setNoKey(false);
      const next = (body.photos ?? []) as Photo[];
      seen.current.push(...next.map((p) => p.id));
      setPhotos(next);
      setPage(nextPage);
    } catch {
      setError("图库连不上");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (tab === "library" && !photos.length && !noKey) void ask(1, true);
    // Once per tab opening, deliberately: re-running on every keystroke would
    // spend a rate limit shared across every customer on words nobody finished
    // typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function adopt(p: Photo) {
    setError(null);
    setBusy(p.id);
    try {
      // Through the server, which fetches the bytes and stores them: Pixabay's
      // licence requires the file to be hosted by us rather than linked. See
      // app/api/photos/route.ts.
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: p.full }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error("拿不到这张");
      onChange(body.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "拿不到这张");
    } finally {
      setBusy(null);
    }
  }

  const TAB = "rounded-[var(--radius-sm)] px-2.5 py-1 [font-size:var(--text-xs)]";
  const ON = "[background-color:var(--color-ink-850)] [color:var(--color-paper)]";
  const OFF = "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]";

  return (
    <div className="flex flex-col gap-2.5">
      {value ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-14 w-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)]"
          >
            换掉
          </button>
        </div>
      ) : null}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("own")}
          className={`${TAB} ${tab === "own" ? ON : OFF}`}
        >
          我自己的照片
        </button>
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`${TAB} ${tab === "library" ? ON : OFF}`}
        >
          从图库找
        </button>
      </div>

      {tab === "own" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy === "upload"}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-[var(--radius-md)] px-3 py-2.5 [border:1px_dashed_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[border-color:var(--color-paper-dim)] hover:[color:var(--color-paper)] disabled:opacity-50"
          >
            {busy === "upload" ? "上传中…" : "选一张照片（手机里那张就可以）"}
          </button>
          <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [line-height:var(--leading-body)]">
            客人是看完工照片在选人的。你自己拍的那一张，比任何图库的照片都有用。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask(1, true);
              }}
              placeholder="想找什么样的照片"
              className="min-w-0 flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 [background-color:var(--color-ink-900)] [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-xs)]"
            />
            <button
              type="button"
              onClick={() => void ask(page + 1)}
              disabled={busy === "search" || noKey}
              className="shrink-0 rounded-[var(--radius-sm)] px-2.5 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)] disabled:opacity-40"
            >
              {busy === "search" ? "…" : "换一批"}
            </button>
          </div>

          {noKey ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [line-height:var(--leading-body)]">
              图库还没接上。先用你自己的照片 —— 那一张本来就比图库的好用。
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`Pixabay · ${p.credit}`}
                  onClick={() => void adopt(p)}
                  disabled={Boolean(busy)}
                  className="relative overflow-hidden rounded-[var(--radius-sm)] [aspect-ratio:4/3] disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                  {busy === p.id ? (
                    <span className="absolute inset-0 grid place-items-center [background-color:oklch(0.16_0.012_265/0.7)] [color:#fff] [font-size:10px]">
                      …
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {/* Pixabay asks to be named wherever search results are shown. Their
              licence does not require it on the published page, and it does not
              belong there: a contractor's website is not the place to credit a
              photographer he has never met. */}
          {photos.length ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
              图片来自 Pixabay
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="[color:var(--color-clay-bright)] [font-size:var(--text-micro)]">{error}</p>
      ) : null}
    </div>
  );
}
