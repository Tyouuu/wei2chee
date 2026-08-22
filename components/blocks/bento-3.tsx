import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const tags = ["TypeScript", "Go", "Python", "Rust", "CLI", "REST"]

/**
 * EVERY WORD THIS SECTION SHOWS, IN ONE OBJECT.
 *
 * The section was pulled from the @7Ovr registry with its own copy baked in as
 * module-level consts. That made it un-editable: the editor's AI writes into
 * PROPS (`set_text` in lib/portal/layout-ops.ts), and a block whose words live
 * in its source has no prop to write into. Selecting one and pressing 改文字
 * opened a panel with a single dropdown -- change the whole section, or nothing.
 *
 * Lifting the consts here changes nothing on screen: the component falls back
 * to exactly these values when no `copy` is passed. What it adds is a surface
 * the AI can reach, so a customer can say "put my own prices in" and get their
 * own prices rather than Acme's.
 *
 * GENERATED. Re-run the opener rather than editing this block by hand.
 */
export const copy = { tags }
export type Copy = typeof copy


export default function BentoBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { tags } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Why teams switch
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-3 text-muted-foreground">
            A focused toolkit that scales from your first commit to your
            millionth request.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {/* Lead tile: feature + terminal snippet */}
          <div className="flex flex-col justify-between gap-8 bg-background p-8 md:col-span-2 md:row-span-2">
            <div>
              <span className="flex size-14 items-center justify-center rounded-lg border border-border bg-muted">
                <IconPlaceholder
                  lucide="Sparkles"
                  tabler="IconSparkles"
                  hugeicons="SparklesIcon"
                  phosphor="Sparkle"
                  remixicon="RiSparkling2Line"
                  className="size-7"
                  aria-hidden="true"
                />
              </span>
              <h3 className="mt-6 font-heading text-2xl font-semibold tracking-tight">
                Intelligent build pipeline
              </h3>
              <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                Caching, parallelism, and preview environments work out of the
                box. Push a branch and get a live URL in seconds.
              </p>
            </div>

            <div
              className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed"
              aria-hidden="true"
            >
              <p className="text-muted-foreground">
                <span className="text-foreground">$</span> acme deploy
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-3.5 text-foreground"
                />
                Built in 8.2s
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-3.5 text-foreground"
                />
                Live at acme.app
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 bg-background p-8">
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
              <IconPlaceholder
                lucide="Activity"
                tabler="IconActivity"
                hugeicons="PulseIcon"
                phosphor="Pulse"
                remixicon="RiPulseLine"
                className="size-5"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="text-4xl font-bold tracking-tight tabular-nums">
                99.99%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Uptime over the last 90 days
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-background p-8">
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
              <IconPlaceholder
                lucide="Shield"
                tabler="IconShieldLock"
                hugeicons="ShieldKeyIcon"
                phosphor="ShieldChevron"
                remixicon="RiShieldKeyholeLine"
                className="size-5"
                aria-hidden="true"
              />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold">
                Secure by default
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Automatic TLS, secrets, and access controls.
              </p>
            </div>
          </div>

          {/* Full-width tile: feature + tech tags */}
          <div className="flex flex-col gap-5 bg-background p-8 md:col-span-3">
            <div>
              <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                <IconPlaceholder
                  lucide="FileCode"
                  tabler="IconFileCode"
                  hugeicons="FileCodeIcon"
                  phosphor="FileCode"
                  remixicon="RiCodeBoxLine"
                  className="size-5"
                  aria-hidden="true"
                />
              </span>
              <h3 className="mt-4 font-heading text-base font-semibold">
                A developer experience you will not fight
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Typed SDKs, a fast CLI, and clear logs mean less time reading
                docs and more time building.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
