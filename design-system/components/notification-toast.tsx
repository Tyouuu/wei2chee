"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"

export type ToastVariant = "warning" | "negative" | "info" | "neutral"

export type ToastNotification = {
  id: string
  title: string
  subtitle: string
  variant: ToastVariant
  /** Where clicking the toast body should navigate. */
  href: string
}

const SEEN_KEY = "design-system-seen-notification-ids"
const AUTO_DISMISS_MS = 6000

const VARIANT_BAR: Record<ToastVariant, string> = {
  warning: "before:[background-color:var(--color-brass-bright)]",
  negative: "before:[background-color:var(--color-clay-bright)]",
  info: "before:[background-color:var(--color-info)]",
  neutral: "before:[background-color:var(--color-slate-bright)]",
}

/**
 * A stack of dismissable toast cards, bottom-left, for notifications that
 * appeared since the last time this ran.
 *
 * Notifications here are assumed to be recomputed fresh on every page load
 * (no push/event stream) — "new" means "an id that wasn't in the set seen
 * last time this ran," checked once per navigation rather than the instant
 * the underlying condition changes server-side. The first-ever run just
 * seeds the seen-set silently, so nobody gets a toast storm for every
 * notification that already existed the moment this feature ships.
 *
 * Ported and generalized from a real client codebase's
 * `notification-toast.tsx`. The brief for this port guessed it composed
 * `Modal`; the real source doesn't — it renders its own fixed-position
 * stack directly, with no portal and no backdrop, which is preserved here.
 * The real source's four variant names were raw token identifiers
 * (`brass`/`clay`/`info`/`slate`); renamed to the same semantic
 * `warning`/`negative`/`info`/`neutral` vocabulary `StatusDot` already
 * established, so callers reason in meaning rather than in a token set's
 * literal color names. The hardcoded `/notifications` destination and the
 * real source's own app-prefixed localStorage key are both generalized:
 * each notification now carries its own `href`, and the storage key is a
 * generic, design-system-scoped name instead.
 */
export function NotificationToast({ notifications }: { notifications: ToastNotification[] }) {
  const [queue, setQueue] = useState<ToastNotification[]>([])

  useEffect(() => {
    const currentIds = notifications.map((n) => n.id)
    let seenRaw: string | null = null
    try {
      seenRaw = localStorage.getItem(SEEN_KEY)
    } catch {
      return
    }

    if (seenRaw === null) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(currentIds))
      } catch {
        // ignore — storage may be unavailable (private browsing, quota)
      }
      return
    }

    const seen = new Set<string>(JSON.parse(seenRaw))
    const fresh = notifications.filter((n) => !seen.has(n.id))
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(currentIds))
    } catch {
      // ignore
    }
    if (fresh.length > 0) {
      setQueue((prev) => [...prev, ...fresh].slice(-3))
    }
    // Only re-check when the set of notification ids actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.map((n) => n.id).join(",")])

  function dismiss(id: string) {
    setQueue((prev) => prev.filter((n) => n.id !== id))
  }

  if (queue.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[min(340px,calc(100vw-2rem))] flex-col-reverse gap-2.5">
      {queue.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  )
}

function Toast({ notification, onDismiss }: { notification: ToastNotification; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-2xl [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] before:absolute before:inset-y-0 before:left-0 before:w-[3.5px] ${VARIANT_BAR[notification.variant]}`}
    >
      <Link href={notification.href} onClick={onDismiss} className="flex-1 text-left">
        <div className="text-[13px] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{notification.title}</div>
        <div className="mt-0.5 text-[12px] text-[color:var(--color-paper-dim)]">{notification.subtitle}</div>
        <div className="mt-1.5 text-[12px] text-[color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]">View →</div>
      </Link>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-[color:color-mix(in_srgb,var(--color-paper-dim)_70%,transparent)] transition-colors hover:text-[color:var(--color-paper)]"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
