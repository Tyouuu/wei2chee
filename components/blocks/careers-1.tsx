import { Badge } from "@/components/ui/badge"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Role = { title: string; location: string; type: string }

const departments: { name: string; roles: Role[] }[] = [
  {
    name: "Engineering",
    roles: [
      {
        title: "Senior Frontend Engineer",
        location: "Remote",
        type: "Full-time",
      },
      { title: "Backend Engineer", location: "Berlin", type: "Full-time" },
      { title: "Platform Engineer", location: "Remote", type: "Full-time" },
    ],
  },
  {
    name: "Design",
    roles: [
      { title: "Product Designer", location: "Remote", type: "Full-time" },
      { title: "Brand Designer", location: "London", type: "Contract" },
    ],
  },
  {
    name: "Marketing",
    roles: [{ title: "Content Lead", location: "Remote", type: "Full-time" }],
  },
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
export const copy = { departments }
export type Copy = typeof copy


const total = departments.reduce((sum, d) => sum + d.roles.length, 0)

export default function CareersBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { departments } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <Badge variant="outline" className="mb-4">
            Careers
          </Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight">
            Open positions
          </h2>
          <p className="mt-3 text-muted-foreground">
            We are a remote-first team with {total} open roles and growing. Come
            build with us.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {departments.map((department) => (
            <div key={department.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {department.name}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {department.roles.length}
                </span>
              </div>

              <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
                {department.roles.map((role, i) => (
                  <li
                    key={role.title}
                    className={i > 0 ? "border-t border-border" : ""}
                  >
                    <a
                      href="#"
                      className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold">
                          {role.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconPlaceholder
                              lucide="MapPin"
                              tabler="IconMapPin"
                              hugeicons="MapPinIcon"
                              phosphor="MapPin"
                              remixicon="RiMapPinLine"
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {role.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconPlaceholder
                              lucide="Briefcase"
                              tabler="IconBriefcase"
                              hugeicons="BriefcaseIcon"
                              phosphor="Briefcase"
                              remixicon="RiBriefcaseLine"
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {role.type}
                          </span>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium">
                        Apply
                        <IconPlaceholder
                          lucide="ArrowRight"
                          tabler="IconArrowRight"
                          hugeicons="ArrowRightIcon"
                          phosphor="ArrowRight"
                          remixicon="RiArrowRightLine"
                          className="size-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
