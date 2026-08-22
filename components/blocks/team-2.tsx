import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const members = [
  {
    name: "Clara Hoffmann",
    role: "Chief Executive Officer",
    department: "Leadership",
    bio: "20 years scaling enterprise software from seed to IPO across three continents.",
    avatar: "https://i.pravatar.cc/300?u=clara-h",
  },
  {
    name: "Marcus Tran",
    role: "Chief Technology Officer",
    department: "Engineering",
    bio: "Former Staff Engineer at Google. Obsessed with distributed systems and developer experience.",
    avatar: "https://i.pravatar.cc/300?u=marcus-t",
  },
  {
    name: "Amara Osei",
    role: "Head of Design",
    department: "Design",
    bio: "Crafts interfaces that win awards and convert users, rarely a coincidence.",
    avatar: "https://i.pravatar.cc/300?u=amara-o",
  },
  {
    name: "Lena Kovač",
    role: "VP of Engineering",
    department: "Engineering",
    bio: "Led platform migrations at Stripe and Figma. Turns technical debt into roadmap wins.",
    avatar: "https://i.pravatar.cc/300?u=lena-k",
  },
  {
    name: "Daniel Reyes",
    role: "Head of Product",
    department: "Product",
    bio: "Zero-to-one product thinker. Launched features now used by 4 million people.",
    avatar: "https://i.pravatar.cc/300?u=daniel-r",
  },
  {
    name: "Sophie Laurent",
    role: "Head of Marketing",
    department: "Marketing",
    bio: "Turned brand storytelling into a growth engine, twice, at companies you know.",
    avatar: "https://i.pravatar.cc/300?u=sophie-l",
  },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

export default function TeamBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <Badge
            variant="outline"
            className="mb-5 px-3 py-1 text-xs tracking-widest uppercase"
          >
            Meet The Team
          </Badge>
          <h2 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            The people behind Acme
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Founders and leaders who have shipped products used by millions.
            Relentlessly focused on craft, speed, and customer impact.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 md:grid-cols-3">
          {members.map(({ name, role, department, bio, avatar }) => (
            <div
              key={name}
              className="group flex flex-col gap-5 bg-card p-6 transition-colors duration-200 hover:bg-muted/40 sm:p-8"
            >
              <div className="flex items-center gap-4">
                <Avatar className="size-16 border border-border">
                  <AvatarImage
                    src={avatar}
                    alt={name}
                    className="grayscale transition-all duration-300 group-hover:grayscale-0"
                  />
                  <AvatarFallback className="text-sm font-semibold">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start gap-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {department}
                  </Badge>
                  <span className="text-sm leading-snug font-semibold text-foreground">
                    {name}
                  </span>
                  <span className="text-xs text-muted-foreground">{role}</span>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
