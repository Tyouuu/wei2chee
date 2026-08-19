/**
 * Passive, best-effort local safety net for free-tier customers, who have
 * no server-side save (see save_project_page's payment-required check).
 * Never a substitute for the real save -- it doesn't sync across devices
 * and is silently dropped if localStorage is unavailable (private
 * browsing, quota exceeded, etc.).
 */
export function localDraftKey(projectId: string, pageKey: string): string {
  return `formae-portal-draft:${projectId}:${pageKey}`;
}

export function readLocalDraft(projectId: string, pageKey: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localDraftKey(projectId, pageKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(projectId: string, pageKey: string, data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localDraftKey(projectId, pageKey), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable -- this is a best-effort safety
    // net, not a guarantee, so fail silently rather than interrupting
    // the customer's editing.
  }
}

/**
 * Drops the local draft for one project/page. Called after a successful
 * paid save (editor-client.tsx's handleSaveClick), where the server row is
 * now authoritative and a leftover draft would only ever be staler than it.
 * Same best-effort contract as the two functions above: silent no-op when
 * localStorage is unavailable.
 */
export function clearLocalDraft(projectId: string, pageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(localDraftKey(projectId, pageKey));
  } catch {
    // Same best-effort contract as writeLocalDraft above -- a draft we
    // couldn't remove is not worth interrupting the customer over.
  }
}
