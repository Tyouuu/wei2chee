import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const steps = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="UserPlus"
        tabler="IconUserPlus"
        hugeicons="UserAddIcon"
        phosphor="UserPlus"
        remixicon="RiUserAddLine"
        {...p}
      />
    ),
    title: "Create your account",
    copy: "Sign up in under two minutes, no credit card required. Your workspace is ready the moment you confirm your email.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Settings"
        tabler="IconSettings"
        hugeicons="SettingsIcon"
        phosphor="GearSix"
        remixicon="RiSettings4Line"
        {...p}
      />
    ),
    title: "Configure your workflow",
    copy: "Choose from pre-built templates or define your own pipeline. Acme adapts to how your team already works.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Users"
        tabler="IconUsersGroup"
        hugeicons="UserGroupIcon"
        phosphor="UsersThree"
        remixicon="RiTeamLine"
        {...p}
      />
    ),
    title: "Invite your team",
    copy: "Send role-based invites in bulk. Colleagues join with a single click and inherit the right permissions automatically.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Rocket"
        tabler="IconRocket"
        hugeicons="RocketIcon"
        phosphor="Rocket"
        remixicon="RiRocketLine"
        {...p}
      />
    ),
    title: "Ship with confidence",
    copy: "Run automated checks, review the audit trail, and deploy, knowing Acme has your back at every stage.",
  },
]

export default function HowItWorks() {
  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 md:grid-cols-[1fr_1.3fr] md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <Badge variant="secondary" className="mb-4 tracking-widest uppercase">
            How It Works
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Up and running in four steps
          </h2>
          <p className="mt-4 text-muted-foreground">
            Acme is designed for momentum. Go from sign-up to full team
            collaboration without a single support ticket.
          </p>
        </div>

        <ol className="flex flex-col">
          {steps.map(({ icon: Icon, title, copy }, index) => {
            const isLast = index === steps.length - 1
            return (
              <li key={title} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    <Icon
                      className="size-4 text-foreground"
                      aria-hidden="true"
                    />
                  </span>
                  {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>

                <div className={isLast ? "pb-0" : "pb-10"}>
                  <h3 className="font-heading text-base font-semibold">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{copy}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
