"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { FIELD, LABEL, PanelFooter, Sheet, sentence } from "../side-panel";
import { MAX_BYTES, shrinkPhoto } from "./photo";

/**
 * "Add Hairstyle Case" -- one finished look into the lookbook (Task 415 item 1,
 * add_lookbook_work in 20260925040000).
 *
 * Only the name is required. A photo, the formula, the stylist and the tags are
 * what make it useful in front of a client, but a stylist who has just finished
 * a head of hair and has one hand free should be able to save "Copper melt" and
 * fill the rest in later -- there is no edit yet, so the honest fix for a typo
 * is to remove the look and add it again (and the panel says so on save).
 *
 * The photo goes up first, straight into the private job-photos bucket under
 * this business's own folder with the person's own login (the bucket's policy is
 * the real boundary), and only then does the database row that points at it get
 * written. If that write fails the uploaded file is removed again so a failed
 * save does not leave a photo nobody can see.
 */

export type Stylist = { id: string; name: string };

export function AddWorkPanel({
  projectId,
  stylists,
  categories,
  onClose,
  onAdded,
}: {
  projectId: string;
  stylists: Stylist[];
  /** Categories already in use, offered as suggestions so "Balayage" is not typed three ways. */
  categories: string[];
  onClose: () => void;
  onAdded: (title: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [stylistId, setStylistId] = useState("");
  const [formula, setFormula] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per opening of the panel: a second press (or a retry after a dropped
  // connection) returns the first look instead of adding it twice.
  const attemptKey = useRef<string | null>(null);
  const photoPath = useRef<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  // The preview URL is made when a file is chosen (not in an effect), and given
  // back when another is chosen or the panel goes away.
  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  async function submit() {
    if (busy) return;
    if (!title.trim()) {
      setError("Give the look a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    attemptKey.current ??= crypto.randomUUID();
    const supabase = createBrowserSupabaseClient();
    try {
      // 1. The photo, if there is one (kept across a retry so a failed save does
      //    not upload the same picture twice).
      if (file && !photoPath.current) {
        const { blob, ext } = await shrinkPhoto(file);
        if (blob.size > MAX_BYTES) {
          setError("That photo is too large even after shrinking. Try a smaller one.");
          return;
        }
        const path = `${projectId}/lookbook/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("job-photos")
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (upErr) {
          setError(sentence(upErr.message));
          return;
        }
        photoPath.current = path;
      }

      // 2. The look itself.
      const tagList = tags
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const { error: rpcErr } = await supabase.rpc("add_lookbook_work", {
        in_project_id: projectId,
        in_title: title,
        in_category: category,
        in_level: level,
        in_formula: formula,
        in_note: note,
        in_tags: tagList,
        in_stylist_id: stylistId || null,
        in_photo_path: photoPath.current ?? "",
        in_idempotency_key: attemptKey.current,
      });
      if (rpcErr) {
        // The photo is uploaded but no look points at it. Keep it for a retry only
        // when the mistake is something he can fix (a missing name is caught above;
        // "at most 8 tags" and the like are fixed and re-sent with the same photo).
        setError(sentence(rpcErr.message));
        return;
      }
      photoPath.current = null;
      onAdded(title.trim());
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  // Closing the panel with an uploaded photo nothing points at: take it back out.
  function close() {
    if (busy) return;
    const orphan = photoPath.current;
    if (orphan) {
      void createBrowserSupabaseClient().storage.from("job-photos").remove([orphan]);
      photoPath.current = null;
    }
    onClose();
  }

  return (
    <Sheet
      label="Add a hairstyle case"
      title="Add Hairstyle Case"
      subtitle="A finished look for the lookbook. Only the name is needed."
      onClose={close}
      busy={busy}
      footer={<PanelFooter busy={busy} onClose={close} onSubmit={submit} submitLabel="Add to Lookbook" busyLabel="Adding…" />}
    >
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Photo</span>
        <label className="group relative flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#c8c5cb] bg-[#f3f3f7] hover:bg-[#eeedf1] transition-colors">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a served image
            <img src={preview} alt="Chosen look" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[#5e5e67]">
              <span className="material-symbols-outlined text-[28px]">add_photo_alternate</span>
              <span className="text-[13px]">Choose a photo</span>
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label="Photo of the look"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
              previewUrl.current = chosen ? URL.createObjectURL(chosen) : null;
              setPreview(previewUrl.current);
              // A different picture after a failed save: the one already up has
              // nothing pointing at it, so take it back out rather than leave it.
              if (photoPath.current) {
                void createBrowserSupabaseClient().storage.from("job-photos").remove([photoPath.current]);
                photoPath.current = null;
              }
            }}
          />
        </label>
        <p className="text-[12px] text-[#5e5e67]">Kept private to your team. Shrunk before it uploads.</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Name of the look</span>
        <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Smoky mocha melt" />
      </label>

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Category</span>
          <input className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} list="lookbook-categories" placeholder="Balayage" />
          <datalist id="lookbook-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Lift level</span>
          <input className={FIELD} value={level} onChange={(e) => setLevel(e.target.value)} maxLength={12} placeholder="6.1" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Done by</span>
        <select className={FIELD} value={stylistId} onChange={(e) => setStylistId(e.target.value)}>
          <option value="">No one in particular</option>
          {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Formula</span>
        <textarea
          className={FIELD + " h-auto min-h-24 py-2 font-mono text-[12.5px] leading-5 resize-y"}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          maxLength={1000}
          placeholder="Majirel 6.1 (35g) + 20 vol · gloss 8.34"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>One line about it</span>
        <input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Cool ash finish, low regrowth" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Tags</span>
        <input className={FIELD} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Warm undertone, Fine hair" />
        <span className="text-[12px] text-[#5e5e67]">Separate with commas, up to 8. &ldquo;Cool&rdquo;, &ldquo;Neutral&rdquo; or &ldquo;Warm&rdquo; makes it show up under Skin Undertone Match.</span>
      </label>

      {error && <p role="alert" data-testid="lookbook-add-error" className="text-[12.5px] font-medium text-[#ba1a1a]">{error}</p>}
    </Sheet>
  );
}
