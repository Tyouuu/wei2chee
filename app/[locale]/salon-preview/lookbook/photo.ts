/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * A phone photo is 3-5 MB; a lookbook of forty of them is 160 MB, and the stylist
 * is uploading from the shop's wifi or a phone's data. Drawing it onto a canvas
 * at 1600px on the long edge gives 200-400 KB with nothing installed. This is the
 * same approach as the job photos in portal/[pageKey]/new/job-photos.tsx (that
 * file keeps its copy private; a lookbook photo is a finished look shown at
 * tablet size, so the same 1600px is right).
 *
 * If it cannot be shrunk (HEIC, a broken EXIF block, an old browser) the
 * original goes up instead: a photo that will not upload is worse than a large one.
 */

/** Longest edge after shrinking. */
export const MAX_EDGE = 1600;
/** The bucket allows 8 MB; say so here, before the upload, in plain words. */
export const MAX_BYTES = 7_000_000;

export async function shrinkPhoto(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.82));
    if (blob && blob.size < file.size) return { blob, ext: "webp" };
  } catch {
    /* fall through to the original */
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return { blob: file, ext };
}
