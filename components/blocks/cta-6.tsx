export default function CtaBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Take Acme with you
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-pretty text-muted-foreground">
          Download the app and pick up right where you left off — on iOS and
          Android, free to start.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#"
            className="inline-flex items-center gap-3 rounded-md border border-border bg-foreground px-4 py-2.5 text-background transition-opacity hover:opacity-90"
          >
            <AppleMark className="size-6" aria-hidden="true" />
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[10px]">Download on the</span>
              <span className="text-sm font-semibold">App Store</span>
            </span>
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-3 rounded-md border border-border bg-foreground px-4 py-2.5 text-background transition-opacity hover:opacity-90"
          >
            <GooglePlayMark className="size-5" aria-hidden="true" />
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[10px]">Get it on</span>
              <span className="text-sm font-semibold">Google Play</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}

// Brand marks are inlined rather than imported from an icon library, which
// would drag a whole extra package into the consumer's install for a handful
// of glyphs.
type MarkProps = React.ComponentProps<"svg"> & { size?: number | string }

function AppleMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M11.6734 7.22198C10.7974 7.22198 9.44138 6.22598 8.01338 6.26198C6.12938 6.28598 4.40138 7.35397 3.42938 9.04597C1.47338 12.442 2.92538 17.458 4.83338 20.218C5.76938 21.562 6.87338 23.074 8.33738 23.026C9.74138 22.966 10.2694 22.114 11.9734 22.114C13.6654 22.114 14.1454 23.026 15.6334 22.99C17.1454 22.966 18.1054 21.622 19.0294 20.266C20.0974 18.706 20.5414 17.194 20.5654 17.11C20.5294 17.098 17.6254 15.982 17.5894 12.622C17.5654 9.81397 19.8814 8.46998 19.9894 8.40998C18.6694 6.47798 16.6414 6.26198 15.9334 6.21398C14.0854 6.06998 12.5374 7.22198 11.6734 7.22198ZM14.7934 4.38998C15.5734 3.45398 16.0894 2.14598 15.9454 0.849976C14.8294 0.897976 13.4854 1.59398 12.6814 2.52998C11.9614 3.35798 11.3374 4.68998 11.5054 5.96198C12.7414 6.05798 14.0134 5.32598 14.7934 4.38998Z" />
    </svg>
  )
}

function GooglePlayMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.60972 1.81396L13.793 12L3.61082 22.1864C3.41776 22.1048 3.24866 21.962 3.13555 21.7667C3.0474 21.6144 3.00098 21.4416 3.00098 21.2656V2.73453C3.00098 2.32109 3.25188 1.96625 3.60972 1.81396ZM14.5 12.707L16.802 15.009L5.86498 21.342L14.5 12.707ZM17.699 9.50896L20.5061 11.1347C20.9841 11.4114 21.1473 12.0232 20.8705 12.5011C20.783 12.6523 20.6574 12.778 20.5061 12.8655L17.698 14.491L15.207 12L17.699 9.50896ZM5.86498 2.65796L16.803 8.98996L14.5 11.293L5.86498 2.65796Z" />
    </svg>
  )
}
