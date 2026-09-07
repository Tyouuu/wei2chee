/**
 * The loading state for every screen inside the shell.
 *
 * There wasn't one. These routes all do a Supabase round trip before they can
 * render, and without a `loading.tsx` Next holds the previous screen on-screen
 * until the new one is ready — so clicking a rail item did nothing visible for
 * a second or more, which reads as a dead link rather than as a page loading.
 *
 * Deliberately a skeleton of THIS layout (a page bar, a stat strip, a card
 * grid) rather than a spinner: it shows the shape that is coming, so the
 * transition is a page filling in rather than a flash of something unrelated.
 */
export default function Loading() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="border-b px-8 py-3 [border-color:var(--color-ink-800)]">
        <div className="h-4 w-32 rounded [background-color:var(--color-ink-850)]" />
      </div>
      <div className="px-8 py-7">
        <div className="h-7 w-80 max-w-full rounded [background-color:var(--color-ink-850)]" />
        <div className="mt-3 h-4 w-1/2 rounded [background-color:var(--color-ink-900)]" />

        <div className="mt-7 grid gap-px overflow-hidden rounded-[var(--radius-md)] [background-color:var(--color-ink-800)] sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[92px] [background-color:var(--color-ink-900)]"
            />
          ))}
        </div>

        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[260px] rounded-[var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
