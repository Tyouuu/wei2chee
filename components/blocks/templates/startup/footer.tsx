const NAV_LINKS = [
  { label: "Product", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
]

export default function Footer() {
  return (
    <section className="flex w-full flex-col items-stretch">
      <footer className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="size-6 shrink-0 text-primary"
            >
              <rect
                x="3"
                y="3"
                width="8"
                height="8"
                transform="rotate(-6 7 7)"
              />
              <rect
                x="3"
                y="13"
                width="8"
                height="8"
                transform="rotate(5 7 17)"
              />
              <rect
                x="13"
                y="13"
                width="8"
                height="8"
                transform="rotate(-4 17 17)"
              />
              <rect
                x="13"
                y="3"
                width="8"
                height="8"
                transform="rotate(15 17 7)"
              />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight">Acme</span>
              <span className="text-xs text-muted-foreground">
                Build fast. Ship faster.
              </span>
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-1"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="shrink-0 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Acme, Inc.
          </p>
        </div>
      </footer>
    </section>
  )
}
