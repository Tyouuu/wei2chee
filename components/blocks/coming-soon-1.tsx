import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const waitlistAvatars = [
  "https://i.pravatar.cc/64?img=12",
  "https://i.pravatar.cc/64?img=32",
  "https://i.pravatar.cc/64?img=45",
  "https://i.pravatar.cc/64?img=5",
]

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
export const copy = { waitlistAvatars }
export type Copy = typeof copy


export default function ComingSoonBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { waitlistAvatars } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center text-foreground">
      <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted/30">
        <IconPlaceholder
          lucide="Rocket"
          tabler="IconRocket"
          hugeicons="RocketIcon"
          phosphor="Rocket"
          remixicon="RiRocket2Line"
          className="size-6"
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Something great is coming
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We are putting the finishing touches on it. Leave your email and be
          the first to know when we launch.
        </p>
      </div>

      <form
        action="#"
        className="flex w-full max-w-sm flex-col gap-2 sm:flex-row"
      >
        <Input
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
        />
        <Button type="submit" className="shrink-0">
          Notify me
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {waitlistAvatars.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              className="size-7 rounded-full border-2 border-background object-cover grayscale"
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Join 2,000+ on the waitlist
        </span>
      </div>

      <div className="flex items-center gap-4 text-muted-foreground">
        <a href="#" aria-label="GitHub" className="hover:text-foreground">
          <GithubMark className="size-5" aria-hidden="true" />
        </a>
        <a href="#" aria-label="X" className="hover:text-foreground">
          <XMark className="size-5" aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

// Brand marks are inlined rather than imported from an icon library: the rest
// of this file uses IconPlaceholder, which resolves to whichever icon set the
// consumer already has, and one brand import would drag a whole extra package
// into their install for a handful of glyphs.
type MarkProps = React.ComponentProps<"svg"> & { size?: number | string }

function GithubMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z" />
    </svg>
  )
}

function XMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M17.6874 3.0625L12.6907 8.77425L8.37045 3.0625H2.11328L9.58961 12.8387L2.50378 20.9375H5.53795L11.0068 14.6886L15.7863 20.9375H21.8885L14.095 10.6342L20.7198 3.0625H17.6874ZM16.6232 19.1225L5.65436 4.78217H7.45745L18.3034 19.1225H16.6232Z" />
    </svg>
  )
}
