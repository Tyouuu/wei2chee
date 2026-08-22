import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Event = {
  id: string
  actor: string
  initials: string
  avatar: string
  action: string
  target: string
  time: string
}

const events: Event[] = [
  {
    id: "merge-main",
    actor: "Mara Ellis",
    initials: "ME",
    avatar: "https://i.pravatar.cc/80?img=47",
    action: "merged a pull request into",
    target: "main",
    time: "12 Min Ago",
  },
  {
    id: "deploy-v241",
    actor: "Leo Tanaka",
    initials: "LT",
    avatar: "https://i.pravatar.cc/80?img=12",
    action: "deployed",
    target: "v2.4.1 to production",
    time: "1 Hour Ago",
  },
  {
    id: "comment-roadmap",
    actor: "Priya Nair",
    initials: "PN",
    avatar: "https://i.pravatar.cc/80?img=32",
    action: "commented on",
    target: "Q3 Roadmap",
    time: "3 Hours Ago",
  },
  {
    id: "invite-members",
    actor: "Owen Brooks",
    initials: "OB",
    avatar: "https://i.pravatar.cc/80?img=53",
    action: "invited",
    target: "two new members",
    time: "5 Hours Ago",
  },
  {
    id: "close-482",
    actor: "Sasha Kim",
    initials: "SK",
    avatar: "https://i.pravatar.cc/80?img=48",
    action: "closed issue",
    target: "#482",
    time: "Yesterday",
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
export const copy = { events }
export type Copy = typeof copy


export default function ActivityBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { events } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Recent actions across your workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar className="size-8 border border-border">
                  <AvatarImage
                    src={event.avatar}
                    alt={event.actor}
                    className="grayscale"
                  />
                  <AvatarFallback className="text-xs">
                    {event.initials}
                  </AvatarFallback>
                </Avatar>
                <p className="flex-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {event.actor}
                  </span>{" "}
                  {event.action}{" "}
                  <span className="font-medium text-foreground">
                    {event.target}
                  </span>
                </p>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {event.time}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
