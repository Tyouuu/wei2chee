"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { FormSection } from "./form-section";

/**
 * 工地的照片。
 *
 * ── 谁在按这颗按钮 ────────────────────────────────────────────────────────
 *
 * 不是老板，是**站在工地上的那个师傅**，用手机，戴着手套。所以：
 *   · `capture="environment"` —— 按下去直接开后镜头，不是先开相簿
 *   · 打击面 44px 起跳
 *   · 一次一张，传完就在画面上 —— 不用他再按一次「保存」
 *
 * ── 🔴 为什么在浏览器里先缩小 ─────────────────────────────────────────────
 *
 * 一张手机照片 3–5MB，一张单二十张就是 80MB —— 而他在工地上用的是 4G。
 * canvas 缩到 1600px 之后大概 200–400KB，**不用装任何东西**，
 * 而官网那条路（app/api/photos）是在伺服器上用 sharp 转的：
 * 那一条走得通是因为图是我们去图库抓的，这一条的档案在他手机里。
 *
 * ⚠️ 缩不动就传原图（HEIC、坏掉的 EXIF、老浏览器）。
 * **一个传不上去的照片，比一张大照片糟得多。**
 *
 * ── 网址是签出来的，而且不存 ──────────────────────────────────────────────
 *
 * 桶是 private 的（那是他客户家里，不是官网），所以每一张的网址是伺服器
 * 签出来的、会过期的。资料库里存的是**路径**，不是网址 ——
 * 存一个会过期的字串，等於存一个明天变成假的东西。
 */

export type JobPhoto = {
  id: string;
  /** 签出来的网址，一小时。伺服器那边签的。 */
  url: string;
  caption: string;
  path: string;
};

/** 最长边缩到这里。1600 够老板在电脑上看清楚一条裂缝，而 4G 传得动。 */
const MAX_EDGE = 1600;
/** 缩完还超过这个就拒绝 —— 桶自己的上限是 8MB，在这里先讲比较不吓人。 */
const MAX_BYTES = 7_000_000;

async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", 0.82),
    );
    if (blob && blob.size < file.size) return { blob, ext: "webp" };
  } catch {
    /* HEIC · 坏掉的 EXIF · 老浏览器。传原图，见档头。 */
  }
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return { blob: file, ext };
}

export function JobPhotos({
  recordId,
  projectId,
  photos,
  copy,
}: {
  /** null = 这一单还没存过，所以还没有地方挂照片。 */
  recordId: string | null;
  projectId: string;
  photos: readonly JobPhoto[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(file: File) {
    if (!recordId) return;
    setError(null);
    setBusy(true);
    try {
      const { blob, ext } = await shrink(file);
      if (blob.size > MAX_BYTES) {
        setError(copy.photoTooBig);
        setBusy(false);
        return;
      }
      const path = `${projectId}/${recordId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createBrowserSupabaseClient();
      /* 用他自己的 session 传，所以桶那边的 RLS 才是真的边界 ——
         而那一条问的是 works_here：拍照的本来就是工地上那一个。 */
      const { error: upErr } = await supabase.storage
        .from("job-photos")
        .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (upErr) {
        setError(upErr.message);
        setBusy(false);
        return;
      }
      /* 🔴 档案上去了、这一行没写进去，就是一个没有人看得到的孤儿档。
         所以这一句失败要讲出来，不可以吞掉。 */
      const { error: rowErr } = await supabase.rpc("add_record_photo", {
        in_record_id: recordId,
        in_path: path,
      });
      if (rowErr) {
        setError(rowErr.message);
        setBusy(false);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(photo: JobPhoto) {
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      /* 先删档案，再删这一行。反过来的话，一张照片会留在画面上而它的档案
         已经没了 —— 一张破掉的照片比一个没有人看得到的孤儿档吓人。 */
      await supabase.storage.from("job-photos").remove([photo.path]);
      const { error: rowErr } = await supabase.rpc("remove_record_photo", { in_id: photo.id });
      if (rowErr) {
        setError(rowErr.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title={copy.photos}>

      {/* 🔴 还没存过的单，讲出来为什么不能挂，不要画一颗按下去会失败的按钮。 */}
      {!recordId ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.photoOnlySaved}
        </p>
      ) : (
        <>
          {photos.length === 0 ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {copy.photoNone}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p) => (
                <figure
                  key={p.id}
                  className="relative overflow-hidden [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      a signed URL from our own bucket, and next/image would
                      need the host allow-listed for a URL that expires. */}
                  <img
                    src={p.url}
                    alt={p.caption || copy.photos}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={copy.photoRemove}
                    disabled={busy}
                    onClick={() => void remove(p)}
                    /* 44px，而且压在照片右上角 —— 工地上戴着手套的拇指
                       按不准一个 20px 的 ×。 */
                    className="absolute right-1 top-1 grid h-11 w-11 place-items-center [border-radius:var(--radius-md)] [background-color:color-mix(in_oklab,var(--color-paper)_70%,transparent)] [font-size:var(--text-sm)] [color:var(--color-canvas)] disabled:opacity-50"
                  >
                    ×
                  </button>
                  {p.caption ? (
                    <figcaption className="px-2 py-1 [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
                      {p.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          )}

          <label className="self-start">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              /* 手机上直接开后镜头。他站在工地上，要拍的是眼前那面墙，
                 不是相簿里上个月的照片。 */
              capture="environment"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void add(f);
              }}
              className="sr-only"
            />
            <span
              className={`inline-flex min-h-11 cursor-pointer items-center [border-radius:var(--radius-md)] border border-dashed px-3 py-2 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)] ${
                busy ? "opacity-60" : ""
              }`}
            >
              {busy ? copy.photoAdding : `＋ ${copy.photoAdd}`}
            </span>
          </label>
        </>
      )}

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}
    </FormSection>
  );
}
