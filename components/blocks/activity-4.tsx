import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

type ActivityType = "mention" | "comment" | "review"

type Item = {
  id: number
  type: ActivityType
  actor: { name: string; initials: string; avatar: string }
  action: string
  target: string
  time: string
  unread: boolean
}

const typeIcon = {
  mention: (p: IconProps) => (
    <IconPlaceholder
      lucide="AtSign"
      tabler="IconAt"
      hugeicons="AtIcon"
      phosphor="At"
      remixicon="RiAtLine"
      {...p}
    />
  ),
  comment: (p: IconProps) => (
    <IconPlaceholder
      lucide="MessageCircle"
      tabler="IconMessageCircle"
      hugeicons="Message01Icon"
      phosphor="ChatCircle"
      remixicon="RiChat3Line"
      {...p}
    />
  ),
  review: (p: IconProps) => (
    <IconPlaceholder
      lucide="GitPullRequest"
      tabler="IconGitPullRequest"
      hugeicons="GitPullRequestIcon"
      phosphor="GitPullRequest"
      remixicon="RiGitPullRequestLine"
      {...p}
    />
  ),
}

const items: Item[] = [
  {
    id: 1,
    type: "mention",
    actor: {
      name: "Mara Lin",
      initials: "ML",
      avatar: "https://i.pravatar.cc/64?img=32",
    },
    action: "mentioned you in",
    target: "Q3 Launch Plan",
    time: "9:42 AM",
    unread: true,
  },
  {
    id: 2,
    type: "review",
    actor: {
      name: "Leo Tanaka",
      initials: "LT",
      avatar: "https://i.pravatar.cc/64?img=12",
    },
    action: "requested your review on",
    target: "PR #418",
    time: "9:15 AM",
    unread: true,
  },
  {
    id: 3,
    type: "comment",
    actor: {
      name: "Priya Nair",
      initials: "PN",
      avatar: "https://i.pravatar.cc/64?img=45",
    },
    action: "commented on",
    target: "Dark Theme Tokens",
    time: "Yesterday",
    unread: false,
  },
  {
    id: 4,
    type: "mention",
    actor: {
      name: "Owen Reyes",
      initials: "OR",
      avatar: "https://i.pravatar.cc/64?img=53",
    },
    action: "mentioned you in",
    target: "Standup Notes",
    time: "Yesterday",
    unread: false,
  },
]

const tabs: { value: string; label: string; filter?: ActivityType }[] = [
  { value: "all", label: "All" },
  { value: "mentions", label: "Mentions", filter: "mention" },
  { value: "comments", label: "Comments", filter: "comment" },
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
export const copy = { items, tabs }
export type Copy = typeof copy


function ActivityRow({ item }: { item: Item }) {
  const Icon = typeIcon[item.type]
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="relative">
        <Avatar className="size-9">
          <AvatarImage
            src={item.actor.avatar}
            alt={item.actor.name}
            className="grayscale"
          />
          <AvatarFallback>{item.actor.initials}</AvatarFallback>
        </Avatar>
        <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-background">
          <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-pretty">
          <span className="font-medium">{item.actor.name}</span>{" "}
          <span className="text-muted-foreground">{item.action}</span>{" "}
          <span className="font-medium">{item.target}</span>
        </p>
        <span className="text-xs text-muted-foreground">{item.time}</span>
      </div>
      {item.unread && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-info"
          aria-label="Unread"
        />
      )}
    </li>
  )
}

/* `items` is a PROP now. It used to be read straight off the module, while
   ActivityBlock destructured the merged copy and used it for exactly one thing
   -- the unread COUNT in the badge. So an edited activity list produced a
   number that changed above a list that did not: the section disagreeing with
   itself, which is worse than ignoring the edit outright because the badge
   tells you it worked. Same shape as blog-2, found the same way. */
function ActivityList({ filter, items }: { filter?: ActivityType; items: Item[] }) {
  const list = filter ? items.filter((item) => item.type === filter) : items
  return (
    <ul className="divide-y divide-border">
      {list.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

export default function ActivityBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { items, tabs } = { ...copy, ...override }
  const unread = items.filter((item) => item.unread).length

  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card ring-1 ring-foreground/5">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="font-heading text-sm font-semibold">Activity</h2>
          <Badge variant="secondary">{unread} New</Badge>
        </div>
        <Tabs defaultValue="all">
          <div className="px-4 pt-3">
            <TabsList className="w-full">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-2">
              <ActivityList filter={tab.filter} items={items} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
