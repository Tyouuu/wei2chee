/**
 * WHAT EVERY PULLED SECTION SAYS BY DEFAULT — AS DATA, WITH NO IMPORTS.
 *
 * ── WHY THIS FILE IS NOT A SET OF IMPORTS ─────────────────────────────────
 *
 * The first version imported `copy` from each section. Every test passed and
 * the product did not work: the sections carry "use client", and a SERVER
 * module importing a non-component export from a client module receives a
 * client REFERENCE rather than the object. lib/portal/layout-ops.ts runs on the
 * server when the assistant asks what a page says, so the lookup came back
 * opaque and describeLayout printed no paths — and the model answered
 * 「价目段未提供可编辑的方案名称路径」, correctly, about sections that had them.
 * vitest has no RSC boundary, which is why 146 tests were green about it.
 *
 * The second attempt moved each `copy` into a sibling .copy.ts. That produced
 * 404 type errors, because the lifted consts carry types that live in the .tsx.
 *
 * So the values are INLINED here. No imports means no boundary to cross and no
 * types to resolve, on the server or anywhere else.
 *
 * ── WHAT IS NOT HERE ──────────────────────────────────────────────────────
 *
 * A const that names an imported icon or a helper cannot be evaluated to plain
 * data and is dropped. That is correct rather than a limitation: `set_copy`
 * only ever writes STRINGS, so a value this generator cannot read is a value
 * the editor could never have edited.
 *
 * GENERATED — 152 sections, 223 objects (11 dropped as non-literal).
 * Re-run the generator; do not edit.
 */
export const BLOCK_COPY: Record<string, Record<string, unknown>> = {
  "about-1": {
    "stats": [
      {
        "value": "2019",
        "label": "Founded"
      },
      {
        "value": "12K+",
        "label": "Customers"
      },
      {
        "value": "40",
        "label": "Countries"
      },
      {
        "value": "85",
        "label": "Team members"
      }
    ]
  },
  "about-2": {
    "stats": [
      {
        "value": "12K+",
        "label": "Teams onboard"
      },
      {
        "value": "99.9%",
        "label": "Uptime"
      },
      {
        "value": "40+",
        "label": "Countries"
      }
    ]
  },
  "activity-1": {
    "events": [
      {
        "id": "merge-main",
        "actor": "Mara Ellis",
        "initials": "ME",
        "avatar": "https://i.pravatar.cc/80?img=47",
        "action": "merged a pull request into",
        "target": "main",
        "time": "12 Min Ago"
      },
      {
        "id": "deploy-v241",
        "actor": "Leo Tanaka",
        "initials": "LT",
        "avatar": "https://i.pravatar.cc/80?img=12",
        "action": "deployed",
        "target": "v2.4.1 to production",
        "time": "1 Hour Ago"
      },
      {
        "id": "comment-roadmap",
        "actor": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "action": "commented on",
        "target": "Q3 Roadmap",
        "time": "3 Hours Ago"
      },
      {
        "id": "invite-members",
        "actor": "Owen Brooks",
        "initials": "OB",
        "avatar": "https://i.pravatar.cc/80?img=53",
        "action": "invited",
        "target": "two new members",
        "time": "5 Hours Ago"
      },
      {
        "id": "close-482",
        "actor": "Sasha Kim",
        "initials": "SK",
        "avatar": "https://i.pravatar.cc/80?img=48",
        "action": "closed issue",
        "target": "#482",
        "time": "Yesterday"
      }
    ]
  },
  "activity-4": {
    "items": [
      {
        "id": 1,
        "type": "mention",
        "actor": {
          "name": "Mara Lin",
          "initials": "ML",
          "avatar": "https://i.pravatar.cc/64?img=32"
        },
        "action": "mentioned you in",
        "target": "Q3 Launch Plan",
        "time": "9:42 AM",
        "unread": true
      },
      {
        "id": 2,
        "type": "review",
        "actor": {
          "name": "Leo Tanaka",
          "initials": "LT",
          "avatar": "https://i.pravatar.cc/64?img=12"
        },
        "action": "requested your review on",
        "target": "PR #418",
        "time": "9:15 AM",
        "unread": true
      },
      {
        "id": 3,
        "type": "comment",
        "actor": {
          "name": "Priya Nair",
          "initials": "PN",
          "avatar": "https://i.pravatar.cc/64?img=45"
        },
        "action": "commented on",
        "target": "Dark Theme Tokens",
        "time": "Yesterday",
        "unread": false
      },
      {
        "id": 4,
        "type": "mention",
        "actor": {
          "name": "Owen Reyes",
          "initials": "OR",
          "avatar": "https://i.pravatar.cc/64?img=53"
        },
        "action": "mentioned you in",
        "target": "Standup Notes",
        "time": "Yesterday",
        "unread": false
      }
    ],
    "tabs": [
      {
        "value": "all",
        "label": "All"
      },
      {
        "value": "mentions",
        "label": "Mentions",
        "filter": "mention"
      },
      {
        "value": "comments",
        "label": "Comments",
        "filter": "comment"
      }
    ]
  },
  "announcement-2": {
    "UPDATE": {
      "label": "New",
      "version": "v2.5",
      "headline": "Acme Workflows just got a major upgrade",
      "detail": "Parallel branching, conditional logic, and real-time run history are now generally available, with no feature flag required.",
      "cta": "See What's New",
      "date": "Released June 12, 2026",
      "platform": "Acme Platform"
    }
  },
  "app-shell-1": {
    "stats": [
      {
        "label": "Total revenue",
        "value": "$48,240",
        "delta": "+12.5%",
        "positive": true
      },
      {
        "label": "Active users",
        "value": "8,941",
        "delta": "+4.3%",
        "positive": true
      },
      {
        "label": "Conversion",
        "value": "3.24%",
        "delta": "-0.8%",
        "positive": false
      }
    ],
    "currentUser": {
      "name": "Alex Morton",
      "initials": "AM",
      "email": "alex@acme.com",
      "avatar": "https://i.pravatar.cc/150?img=12"
    },
    "projects": [
      {
        "name": "Horizon Rebrand",
        "progress": 72,
        "status": "On Track"
      },
      {
        "name": "API v3 Migration",
        "progress": 38,
        "status": "At Risk"
      },
      {
        "name": "Mobile App Launch",
        "progress": 91,
        "status": "On Track"
      }
    ]
  },
  "app-shell-2": {
    "members": {
      "KS": {
        "name": "Kenji Sato",
        "avatar": "https://i.pravatar.cc/150?img=11"
      },
      "LM": {
        "name": "Layla Mori",
        "avatar": "https://i.pravatar.cc/150?img=23"
      },
      "TP": {
        "name": "Tariq Patel",
        "avatar": "https://i.pravatar.cc/150?img=14"
      },
      "RM": {
        "name": "Roma Müller",
        "avatar": "https://i.pravatar.cc/150?img=32"
      },
      "SJ": {
        "name": "Sofia Jiménez",
        "avatar": "https://i.pravatar.cc/150?img=44"
      },
      "NW": {
        "name": "Noa Weiss",
        "avatar": "https://i.pravatar.cc/150?img=5"
      },
      "AL": {
        "name": "André Lefèvre",
        "avatar": "https://i.pravatar.cc/150?img=68"
      },
      "CB": {
        "name": "Chloe Byrne",
        "avatar": "https://i.pravatar.cc/150?img=47"
      }
    },
    "projects": [
      {
        "name": "Website Redesign",
        "description": "Revamp the public-facing marketing site and docs hub.",
        "status": "In Progress",
        "dueDate": "Jun 30",
        "progress": 68,
        "memberKeys": [
          "KS",
          "LM",
          "TP"
        ],
        "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
        "imageAlt": "Analytics dashboard on a laptop screen"
      },
      {
        "name": "Mobile App v2",
        "description": "Next major release with offline sync and push notifications.",
        "status": "Planning",
        "dueDate": "Jul 15",
        "progress": 24,
        "memberKeys": [
          "RM",
          "SJ"
        ],
        "image": "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80",
        "imageAlt": "Source code on a dark editor screen"
      },
      {
        "name": "API Gateway",
        "description": "Unified gateway layer across all internal microservices.",
        "status": "Review",
        "dueDate": "Jun 22",
        "progress": 91,
        "memberKeys": [
          "NW",
          "AL",
          "CB"
        ],
        "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
        "imageAlt": "Server racks in a data center"
      }
    ],
    "tasks": [
      {
        "title": "Finalize design tokens",
        "assigneeKey": "KS",
        "priority": "High",
        "done": false
      },
      {
        "title": "Write integration tests",
        "assigneeKey": "RM",
        "priority": "Medium",
        "done": false
      },
      {
        "title": "Deploy staging environment",
        "assigneeKey": "LM",
        "priority": "High",
        "done": true
      },
      {
        "title": "Update API documentation",
        "assigneeKey": "NW",
        "priority": "Low",
        "done": false
      },
      {
        "title": "Accessibility audit",
        "assigneeKey": "TP",
        "priority": "Medium",
        "done": true
      }
    ],
    "activity": [
      {
        "actorKey": "KS",
        "action": "merged",
        "target": "#241 Add dark mode support",
        "time": "2 Min Ago",
        "icon": "merge"
      },
      {
        "actorKey": "LM",
        "action": "commented on",
        "target": "Website Redesign milestone",
        "time": "18 Min Ago",
        "icon": "comment"
      },
      {
        "actorKey": "RM",
        "action": "closed issue",
        "target": "#198 Button focus ring",
        "time": "1 Hour Ago",
        "icon": "close"
      },
      {
        "actorKey": "TP",
        "action": "opened pull request",
        "target": "#242 Tabs refactor",
        "time": "3 Hours Ago",
        "icon": "pr"
      },
      {
        "actorKey": "NW",
        "action": "created task",
        "target": "Update API documentation",
        "time": "5 Hours Ago",
        "icon": "task"
      }
    ],
    "statusConfig": {
      "In Progress": {
        "variant": "default",
        "dot": "bg-primary-foreground"
      },
      "Planning": {
        "variant": "outline",
        "dot": "bg-muted-foreground"
      },
      "Review": {
        "variant": "secondary",
        "dot": "bg-foreground"
      }
    },
    "priorityConfig": {
      "High": {
        "variant": "destructive"
      },
      "Medium": {
        "variant": "secondary"
      },
      "Low": {
        "variant": "outline"
      }
    }
  },
  "article-1": {
    "tags": [
      "Engineering",
      "Performance",
      "Databases"
    ]
  },
  "article-2": {
    "sections": [
      {
        "id": "overview",
        "title": "Overview",
        "body": [
          "Design tokens are the single source of truth for the visual language of a product. Instead of hard-coding colors and spacing in components, you reference named values that can change in one place.",
          "This guide walks through how we structure tokens, how they map to themes, and how to adopt them without a disruptive migration."
        ]
      },
      {
        "id": "structure",
        "title": "Token structure",
        "body": [
          "We split tokens into three tiers: primitives, semantic tokens, and component tokens. Primitives are raw values, semantic tokens describe intent, and component tokens bind intent to a specific part.",
          "Keeping these tiers separate means a rebrand touches primitives only, while component code keeps referring to the same semantic names."
        ]
      },
      {
        "id": "theming",
        "title": "Theming",
        "body": [
          "Each theme remaps the semantic tier. A dark theme overrides background and foreground tokens, and every component that reads those names updates automatically with no per-component work.",
          "Because the contract is the token name, you can ship a new theme without touching a single component file."
        ]
      },
      {
        "id": "adoption",
        "title": "Adoption",
        "body": [
          "Roll out tokens incrementally. Start with color, then spacing, then typography, shipping each tier behind the same review process you already use.",
          "Within a few sprints the hard-coded values are gone and every surface speaks the same visual language."
        ]
      }
    ]
  },
  "article-4": {
    "tags": [
      "Culture",
      "Remote Work",
      "Leadership"
    ]
  },
  "article-5": {
    "related": [
      {
        "title": "Designing for the first five minutes",
        "read": "5 min"
      },
      {
        "title": "A practical guide to design tokens",
        "read": "8 min"
      },
      {
        "title": "How we test accessible components",
        "read": "6 min"
      }
    ]
  },
  "auth-2": {
    "FEATURES": [
      "Real-time project dashboards",
      "Role-based access control",
      "Audit logs & compliance reports"
    ]
  },
  "auth-3": {
    "PLANS": [
      {
        "label": "Free",
        "detail": "Up to 3 projects, 1 GB storage",
        "popular": false
      },
      {
        "label": "Pro",
        "detail": "Unlimited projects, 50 GB storage",
        "popular": true
      },
      {
        "label": "Team",
        "detail": "Everything in Pro + admin controls",
        "popular": false
      }
    ]
  },
  "bento-3": {
    "tags": [
      "TypeScript",
      "Go",
      "Python",
      "Rust",
      "CLI",
      "REST"
    ]
  },
  "billing-1": {
    "PLANS": [
      {
        "id": "starter",
        "name": "Starter",
        "price": "$19",
        "seats": 5,
        "description": "For small teams getting started."
      },
      {
        "id": "pro",
        "name": "Pro",
        "price": "$49",
        "seats": 25,
        "description": "For growing teams that need more seats."
      },
      {
        "id": "scale",
        "name": "Scale",
        "price": "$99",
        "seats": 100,
        "description": "For organizations operating at scale."
      }
    ]
  },
  "billing-2": {
    "INVOICES": [
      {
        "id": "INV-2026-0047",
        "date": "Jun 1, 2026",
        "amount": "$149.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0031",
        "date": "May 1, 2026",
        "amount": "$149.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0018",
        "date": "Apr 1, 2026",
        "amount": "$99.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0009",
        "date": "Mar 1, 2026",
        "amount": "$99.00",
        "status": "Failed"
      },
      {
        "id": "INV-2026-0004",
        "date": "Feb 1, 2026",
        "amount": "$99.00",
        "status": "Paid"
      },
      {
        "id": "INV-2025-0089",
        "date": "Jan 1, 2026",
        "amount": "$49.00",
        "status": "Pending"
      },
      {
        "id": "INV-2025-0074",
        "date": "Dec 1, 2025",
        "amount": "$49.00",
        "status": "Paid"
      }
    ],
    "STATUS_VARIANT": {
      "Paid": "secondary",
      "Pending": "outline",
      "Failed": "destructive"
    }
  },
  "billing-3": {
    "PLAN": {
      "name": "Pro",
      "price": "$49",
      "interval": "/ Month",
      "renewalDate": "July 14, 2026",
      "storage": {
        "used": 162,
        "total": 250
      }
    },
    "PAYMENT": {
      "brand": "Visa",
      "last4": "4242",
      "expiry": "08 / 28",
      "holder": "Jordan Rivera"
    },
    "INVOICES": [
      {
        "id": "INV-2026-0047",
        "date": "Jun 1, 2026",
        "amount": "$49.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0031",
        "date": "May 1, 2026",
        "amount": "$49.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0018",
        "date": "Apr 1, 2026",
        "amount": "$49.00",
        "status": "Pending"
      },
      {
        "id": "INV-2026-0009",
        "date": "Mar 1, 2026",
        "amount": "$49.00",
        "status": "Paid"
      },
      {
        "id": "INV-2026-0004",
        "date": "Feb 1, 2026",
        "amount": "$49.00",
        "status": "Failed"
      },
      {
        "id": "INV-2026-0001",
        "date": "Jan 1, 2026",
        "amount": "$49.00",
        "status": "Paid"
      },
      {
        "id": "INV-2025-0142",
        "date": "Dec 1, 2025",
        "amount": "$49.00",
        "status": "Paid"
      },
      {
        "id": "INV-2025-0128",
        "date": "Nov 1, 2025",
        "amount": "$49.00",
        "status": "Paid"
      }
    ],
    "STATUS_VARIANT": {
      "Paid": "secondary",
      "Pending": "outline",
      "Failed": "destructive"
    },
    "UPGRADE_PLANS": [
      {
        "name": "Team",
        "price": "$99",
        "detail": "Everything in Pro + admin controls"
      },
      {
        "name": "Enterprise",
        "price": "Custom",
        "detail": "SSO, audit logs, and a dedicated success manager"
      }
    ]
  },
  "billing-4": {
    "meters": [
      {
        "label": "Seats",
        "used": 9,
        "limit": 10,
        "unit": "seats",
        "display": "9 / 10"
      },
      {
        "label": "Storage",
        "used": 42,
        "limit": 50,
        "unit": "GB",
        "display": "42 / 50 GB"
      },
      {
        "label": "API Requests",
        "used": 1.24,
        "limit": 2,
        "unit": "M",
        "display": "1.24M / 2M"
      },
      {
        "label": "Bandwidth",
        "used": 96,
        "limit": 250,
        "unit": "GB",
        "display": "96 / 250 GB"
      }
    ]
  },
  "billing-5": {
    "initialCards": [
      {
        "id": "c1",
        "brand": "Visa",
        "last4": "4242",
        "expiry": "08/27"
      },
      {
        "id": "c2",
        "brand": "Mastercard",
        "last4": "5100",
        "expiry": "01/26"
      }
    ]
  },
  "blog-1": {
    "posts": [
      {
        "category": "Engineering",
        "title": "How we cut API latency by 60% with edge caching",
        "excerpt": "Our monolith was fast enough, until it wasn't. We traced the bottleneck to cold database reads on every request and rearchitected our caching layer in three weeks.",
        "author": {
          "name": "Lena Park",
          "initials": "LP",
          "avatar": "https://i.pravatar.cc/150?img=45"
        },
        "date": "Jun 9, 2026",
        "readTime": "7 Min Read",
        "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
        "imageAlt": "Server rack with blinking lights in a data center"
      },
      {
        "category": "Design",
        "title": "Building a token system that survives a rebrand",
        "excerpt": "Semantic tokens feel abstract until the day your brand color changes. We share the naming conventions and tooling that let us ship a full rebrand in under two days.",
        "author": {
          "name": "Marcus Webb",
          "initials": "MW",
          "avatar": "https://i.pravatar.cc/150?img=12"
        },
        "date": "May 28, 2026",
        "readTime": "5 Min Read",
        "image": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
        "imageAlt": "Colour swatches and design tokens spread on a desk"
      },
      {
        "category": "Product",
        "title": "What 1,200 user interviews taught us about onboarding",
        "excerpt": "Drop-off at step two turned out to have nothing to do with the UI. Listening to customers revealed a mismatch between our mental model and theirs. Here's how we fixed it.",
        "author": {
          "name": "Sofia Andrade",
          "initials": "SA",
          "avatar": "https://i.pravatar.cc/150?img=32"
        },
        "date": "May 14, 2026",
        "readTime": "9 Min Read",
        "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80",
        "imageAlt": "Two people in a user research interview session"
      }
    ]
  },
  "blog-2": {
    "posts": [
      {
        "category": "Engineering",
        "title": "Migrating 40 million rows to a new schema without downtime",
        "excerpt": "Zero-downtime migrations sound impossible at scale, until you break them into reversible, backfill-first steps. Here is the playbook we used to move our largest table live in production.",
        "author": {
          "name": "James Okafor",
          "initials": "JO",
          "avatar": "https://i.pravatar.cc/150?u=james-okafor"
        },
        "date": "Jun 12, 2026",
        "readTime": "9 Min Read",
        "featured": true
      },
      {
        "category": "Design",
        "title": "Why we ditched our icon font and never looked back",
        "excerpt": "Icon fonts were convenient in 2014. Today they introduce accessibility gaps, inconsistent rendering, and painful bundle overhead. We switched to inline SVGs and measured every tradeoff.",
        "author": {
          "name": "Priya Nair",
          "initials": "PN",
          "avatar": "https://i.pravatar.cc/150?u=priya-nair"
        },
        "date": "May 30, 2026",
        "readTime": "6 Min Read",
        "featured": false
      },
      {
        "category": "Security",
        "title": "How we responded to a third-party supply-chain incident",
        "excerpt": "When a dependency we trusted was compromised upstream, we had 90 minutes to assess impact, isolate affected services, and communicate clearly with customers. A candid post-mortem.",
        "author": {
          "name": "Tobias Schulz",
          "initials": "TS",
          "avatar": "https://i.pravatar.cc/150?u=tobias-schulz"
        },
        "date": "May 19, 2026",
        "readTime": "11 Min Read",
        "featured": false
      },
      {
        "category": "Culture",
        "title": "Async-first does not mean no meetings, it means intentional ones",
        "excerpt": "We went fully async two years ago and learned that the hard problems were never about time zones. They were about trust, decision ownership, and knowing when synchronous is worth the cost.",
        "author": {
          "name": "Amara Diallo",
          "initials": "AD",
          "avatar": "https://i.pravatar.cc/150?u=amara-diallo"
        },
        "date": "May 5, 2026",
        "readTime": "7 Min Read",
        "featured": false
      },
      {
        "category": "Product",
        "title": "Shipping a feature in three languages on day one",
        "excerpt": "Internationalisation is usually treated as a phase-two concern. We made it a launch requirement and restructured how designers, engineers, and translators collaborate from the very first sprint.",
        "author": {
          "name": "Cleo Martinez",
          "initials": "CM",
          "avatar": "https://i.pravatar.cc/150?u=cleo-martinez"
        },
        "date": "Apr 22, 2026",
        "readTime": "8 Min Read",
        "featured": false
      }
    ]
  },
  "blog-3": {
    "featured": {
      "category": "Engineering",
      "title": "How we cut API latency by 60% with edge caching",
      "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
      "excerpt": "Our monolith was fast enough, until it wasn't. We traced the bottleneck to cold database reads on every request and rearchitected the caching layer in three weeks.",
      "author": {
        "name": "Lena Park",
        "initials": "LP",
        "img": 47
      },
      "date": "Jun 9, 2026",
      "readTime": "7 Min Read"
    },
    "categories": [
      "All",
      "Engineering",
      "Design",
      "Product",
      "Company"
    ],
    "posts": [
      {
        "category": "Design",
        "title": "Building a token system that survives a rebrand",
        "image": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
        "excerpt": "Semantic tokens feel abstract until your brand color changes overnight.",
        "author": {
          "name": "Marcus Webb",
          "initials": "MW",
          "img": 12
        },
        "date": "May 28, 2026",
        "readTime": "5 Min Read"
      },
      {
        "category": "Product",
        "title": "What 1,200 user interviews taught us about onboarding",
        "image": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
        "excerpt": "Drop-off at step two had nothing to do with the UI, it was a mental model gap.",
        "author": {
          "name": "Sofia Andrade",
          "initials": "SA",
          "img": 45
        },
        "date": "May 14, 2026",
        "readTime": "9 Min Read"
      },
      {
        "category": "Engineering",
        "title": "Shipping a type-safe API layer without a build step",
        "image": "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80",
        "excerpt": "We replaced our codegen pipeline with inferred types and never looked back.",
        "author": {
          "name": "Devon Ross",
          "initials": "DR",
          "img": 13
        },
        "date": "May 2, 2026",
        "readTime": "6 Min Read"
      },
      {
        "category": "Company",
        "title": "Why Acme is going remote-first in 2026",
        "image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
        "excerpt": "Three years of hybrid taught us where collaboration actually happens.",
        "author": {
          "name": "Priya Nair",
          "initials": "PN",
          "img": 44
        },
        "date": "Apr 19, 2026",
        "readTime": "4 Min Read"
      },
      {
        "category": "Design",
        "title": "A practical guide to accessible color contrast",
        "image": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80",
        "excerpt": "Pass WCAG without sacrificing the palette your brand team fought for.",
        "author": {
          "name": "Theo Lambert",
          "initials": "TL",
          "img": 15
        },
        "date": "Apr 5, 2026",
        "readTime": "8 Min Read"
      },
      {
        "category": "Product",
        "title": "Pricing experiments that doubled our trial conversion",
        "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80",
        "excerpt": "Small framing changes on the pricing page moved the needle more than discounts.",
        "author": {
          "name": "Hana Kim",
          "initials": "HK",
          "img": 41
        },
        "date": "Mar 22, 2026",
        "readTime": "5 Min Read"
      }
    ]
  },
  "blog-4": {
    "posts": [
      {
        "title": "Designing for the first five minutes",
        "excerpt": "Onboarding is the only part of your product every user sees. We rebuilt ours around a single question: what is the smallest win we can deliver today?",
        "category": "Product",
        "readTime": "6 Min Read",
        "date": "Jul 2, 2026",
        "image": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=80",
        "author": {
          "name": "Devon Reyes",
          "initials": "DR",
          "avatar": "https://i.pravatar.cc/64?img=12"
        }
      },
      {
        "title": "The case for boring infrastructure",
        "excerpt": "Every exciting outage starts with an exciting technology choice. Here is why our platform team keeps reaching for the least novel option on the table.",
        "category": "Engineering",
        "readTime": "9 Min Read",
        "date": "Jun 24, 2026",
        "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80",
        "author": {
          "name": "Priya Nair",
          "initials": "PN",
          "avatar": "https://i.pravatar.cc/64?img=45"
        }
      },
      {
        "title": "How we price without a sales team",
        "excerpt": "Self-serve pricing sounds simple until you write the page. A look at the experiments, the mistakes, and the framework we landed on.",
        "category": "Growth",
        "readTime": "5 Min Read",
        "date": "Jun 15, 2026",
        "image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
        "author": {
          "name": "Sam Whitfield",
          "initials": "SW",
          "avatar": "https://i.pravatar.cc/64?img=59"
        }
      }
    ]
  },
  "blog-5": {
    "posts": [
      {
        "category": "Engineering",
        "title": "How we cut our build times in half",
        "excerpt": "A deep dive into the caching strategy and dependency graph work that made our CI dramatically faster.",
        "author": "Dana Wu",
        "date": "Jul 18, 2026",
        "read": "6 min read"
      },
      {
        "category": "Design",
        "title": "Designing empty states that guide, not block",
        "excerpt": "Empty states are a first impression. Here's the system we use to turn dead ends into next steps.",
        "author": "Mia Cho",
        "date": "Jul 11, 2026",
        "read": "4 min read"
      },
      {
        "category": "Product",
        "title": "Shipping scheduled reports to every plan",
        "excerpt": "Why we moved a former enterprise feature into the free tier, and what we learned from the rollout.",
        "author": "Ravi Patel",
        "date": "Jul 3, 2026",
        "read": "5 min read"
      }
    ],
    "categories": [
      {
        "name": "Engineering",
        "count": 24
      },
      {
        "name": "Design",
        "count": 18
      },
      {
        "name": "Product",
        "count": 15
      },
      {
        "name": "Company",
        "count": 9
      }
    ],
    "popular": [
      "A field guide to design tokens",
      "Our approach to accessible components",
      "Scaling Postgres past a billion rows"
    ],
    "tags": [
      "React",
      "Tailwind",
      "TypeScript",
      "Design systems",
      "DX",
      "CI"
    ]
  },
  "calendar-1": {
    "WEEKDAYS": [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ],
    "MONTH_NAMES": [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ],
    "EVENTS": {
      "2025-5-5": {
        "label": "Team sync",
        "variant": "secondary",
        "time": "10:00 – 10:30",
        "location": "Zoom",
        "description": "Weekly cross-functional sync to align on priorities."
      },
      "2025-5-12": {
        "label": "Q2 review",
        "variant": "secondary",
        "time": "14:00 – 15:30",
        "location": "Conf room A",
        "description": "Quarterly business review with leadership."
      },
      "2025-5-17": {
        "label": "Launch",
        "variant": "default",
        "time": "All day",
        "location": "Company-wide",
        "description": "Public launch of the new platform release."
      },
      "2025-5-23": {
        "label": "Design sprint",
        "variant": "secondary",
        "time": "11:00 – 17:00",
        "location": "Studio 2",
        "description": "Full-day design sprint for the onboarding flow."
      },
      "2025-5-28": {
        "label": "Board meeting",
        "variant": "outline",
        "time": "15:00 – 16:00",
        "location": "Main boardroom",
        "description": "Monthly board meeting and financial review."
      },
      "2025-6-3": {
        "label": "All-hands",
        "variant": "default",
        "time": "16:00 – 17:00",
        "location": "Auditorium",
        "description": "Company all-hands with Q3 kickoff."
      },
      "2025-6-15": {
        "label": "Offsite",
        "variant": "secondary",
        "time": "All day",
        "location": "Lakeside resort",
        "description": "Annual team offsite and strategy planning."
      }
    }
  },
  "calendar-2": {
    "STANDUP": {
      "time": "09:00",
      "duration": "30 min",
      "title": "Daily standup",
      "location": "Zoom",
      "status": "confirmed"
    }
  },
  "calendar-3": {
    "WEEKDAYS": [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat"
    ],
    "MONTH_NAMES": [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ],
    "EVENTS": {
      "2026-5-3": [
        {
          "id": "e1",
          "title": "Team sync",
          "time": "9:00 AM",
          "tone": "secondary"
        },
        {
          "id": "e2",
          "title": "1:1 with Dana",
          "time": "11:30 AM",
          "tone": "outline"
        }
      ],
      "2026-5-10": [
        {
          "id": "e3",
          "title": "Q2 review",
          "time": "2:00 PM",
          "tone": "secondary"
        }
      ],
      "2026-5-18": [
        {
          "id": "e4",
          "title": "Acme launch",
          "time": "All day",
          "tone": "default"
        },
        {
          "id": "e5",
          "title": "Press briefing",
          "time": "4:00 PM",
          "tone": "outline"
        },
        {
          "id": "e6",
          "title": "Launch party",
          "time": "6:30 PM",
          "tone": "secondary"
        }
      ],
      "2026-5-23": [
        {
          "id": "e7",
          "title": "Design sprint",
          "time": "10:00 AM",
          "tone": "secondary"
        }
      ],
      "2026-5-29": [
        {
          "id": "e8",
          "title": "Board meeting",
          "time": "1:00 PM",
          "tone": "outline"
        }
      ]
    }
  },
  "careers-1": {
    "departments": [
      {
        "name": "Engineering",
        "roles": [
          {
            "title": "Senior Frontend Engineer",
            "location": "Remote",
            "type": "Full-time"
          },
          {
            "title": "Backend Engineer",
            "location": "Berlin",
            "type": "Full-time"
          },
          {
            "title": "Platform Engineer",
            "location": "Remote",
            "type": "Full-time"
          }
        ]
      },
      {
        "name": "Design",
        "roles": [
          {
            "title": "Product Designer",
            "location": "Remote",
            "type": "Full-time"
          },
          {
            "title": "Brand Designer",
            "location": "London",
            "type": "Contract"
          }
        ]
      },
      {
        "name": "Marketing",
        "roles": [
          {
            "title": "Content Lead",
            "location": "Remote",
            "type": "Full-time"
          }
        ]
      }
    ]
  },
  "careers-2": {
    "responsibilities": [
      "Build and own customer-facing features across the web app, end to end.",
      "Shape the design system and raise the quality bar for the frontend.",
      "Partner with design and product to turn ideas into shipped work.",
      "Mentor engineers and help set our frontend technical direction."
    ],
    "requirements": [
      "5+ years building production web apps with React and TypeScript.",
      "A strong eye for detail, accessibility, and interaction design.",
      "Comfort working autonomously in a remote-first, async team."
    ]
  },
  "careers-3": {
    "photos": [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&q=80",
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&q=80",
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=500&q=80"
    ]
  },
  "careers-4": {
    "jobs": [
      {
        "title": "Senior Frontend Engineer",
        "department": "Engineering",
        "location": "Remote",
        "type": "Full-time"
      },
      {
        "title": "Backend Engineer, Platform",
        "department": "Engineering",
        "location": "Berlin",
        "type": "Full-time"
      },
      {
        "title": "Product Designer",
        "department": "Design",
        "location": "Remote",
        "type": "Full-time"
      },
      {
        "title": "Design Systems Lead",
        "department": "Design",
        "location": "London",
        "type": "Full-time"
      },
      {
        "title": "Growth Marketing Manager",
        "department": "Marketing",
        "location": "Remote",
        "type": "Full-time"
      },
      {
        "title": "Content Strategist",
        "department": "Marketing",
        "location": "Remote",
        "type": "Contract"
      },
      {
        "title": "Customer Success Manager",
        "department": "Operations",
        "location": "New York",
        "type": "Full-time"
      }
    ],
    "departments": [
      "All",
      "Engineering",
      "Design",
      "Marketing",
      "Operations"
    ]
  },
  "changelog-1": {
    "releases": [
      {
        "version": "2.4.0",
        "date": "Jun 18, 2026",
        "summary": "Faster search and a refreshed billing experience.",
        "groups": [
          {
            "type": "Added",
            "items": [
              "Command palette now searches across projects, members, and files.",
              "Export any table to CSV from the toolbar."
            ]
          },
          {
            "type": "Improved",
            "items": [
              "Billing page loads roughly twice as fast on large workspaces.",
              "Clearer empty states across the dashboard."
            ]
          },
          {
            "type": "Fixed",
            "items": [
              "Resolved a rare sync error when renaming a workspace."
            ]
          }
        ]
      },
      {
        "version": "2.3.0",
        "date": "May 30, 2026",
        "summary": "Team workspaces and role-based access.",
        "groups": [
          {
            "type": "Added",
            "items": [
              "Invite teammates with Admin, Editor, or Viewer roles.",
              "Shared component libraries scoped to a workspace."
            ]
          },
          {
            "type": "Fixed",
            "items": [
              "Dark mode contrast on secondary buttons.",
              "Pagination on the activity feed no longer skips a page."
            ]
          }
        ]
      },
      {
        "version": "2.2.1",
        "date": "May 12, 2026",
        "summary": "Stability and polish.",
        "groups": [
          {
            "type": "Improved",
            "items": [
              "Keyboard navigation in dialogs and menus."
            ]
          },
          {
            "type": "Fixed",
            "items": [
              "A layout shift when toggling the sidebar."
            ]
          }
        ]
      }
    ]
  },
  "changelog-2": {
    "entries": [
      {
        "version": "2.4.0",
        "date": "Jun 18, 2026",
        "type": "Added",
        "title": "Global command palette",
        "description": "Press Command K anywhere to jump to projects, members, or files."
      },
      {
        "version": "2.4.0",
        "date": "Jun 18, 2026",
        "type": "Improved",
        "title": "Faster billing page",
        "description": "Large workspaces now load the billing view about twice as fast."
      },
      {
        "version": "2.3.2",
        "date": "Jun 06, 2026",
        "type": "Fixed",
        "title": "Workspace rename sync",
        "description": "Resolved a rare error when renaming a busy workspace."
      },
      {
        "version": "2.3.0",
        "date": "May 30, 2026",
        "type": "Added",
        "title": "Role-based access",
        "description": "Invite teammates as Admin, Editor, or Viewer."
      },
      {
        "version": "2.3.0",
        "date": "May 30, 2026",
        "type": "Improved",
        "title": "Keyboard navigation",
        "description": "Dialogs and menus are now fully keyboard accessible."
      },
      {
        "version": "2.2.1",
        "date": "May 12, 2026",
        "type": "Fixed",
        "title": "Sidebar layout shift",
        "description": "Toggling the sidebar no longer nudges page content."
      }
    ],
    "tabs": [
      {
        "value": "all",
        "label": "All"
      },
      {
        "value": "added",
        "label": "Added",
        "match": "Added"
      },
      {
        "value": "improved",
        "label": "Improved",
        "match": "Improved"
      },
      {
        "value": "fixed",
        "label": "Fixed",
        "match": "Fixed"
      }
    ]
  },
  "changelog-4": {
    "releases": [
      {
        "version": "3.4.0",
        "date": "Jul 9, 2026",
        "title": "Saved views and faster search",
        "changes": [
          {
            "type": "Added",
            "text": "Save any filtered view and pin it to the sidebar"
          },
          {
            "type": "Improved",
            "text": "Search now returns results in under 100ms"
          },
          {
            "type": "Fixed",
            "text": "Keyboard shortcuts no longer fire while typing"
          }
        ]
      },
      {
        "version": "3.3.0",
        "date": "Jun 28, 2026",
        "title": "Team roles and audit log",
        "changes": [
          {
            "type": "Added",
            "text": "Granular member roles for owners and editors"
          },
          {
            "type": "Added",
            "text": "Exportable audit log for the last ninety days"
          },
          {
            "type": "Improved",
            "text": "Invitations now expire after seven days"
          }
        ]
      },
      {
        "version": "3.2.1",
        "date": "Jun 12, 2026",
        "title": "Stability and polish",
        "changes": [
          {
            "type": "Fixed",
            "text": "Resolved a rare crash when reordering columns"
          },
          {
            "type": "Improved",
            "text": "Reduced initial bundle size by roughly 18%"
          }
        ]
      }
    ]
  },
  "charts-1": {
    "MONTHS": [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ],
    "DATASETS": {
      "2022": [
        14200,
        17800,
        16500,
        21300,
        24900,
        22600,
        29400,
        31200,
        28800,
        35500,
        39100,
        47300
      ],
      "2023": [
        28400,
        33100,
        39800,
        36500,
        44200,
        51900,
        48700,
        57300,
        61800,
        59400,
        68100,
        82500
      ],
      "2024": [
        42000,
        58300,
        51700,
        74200,
        68900,
        91400,
        83600,
        107500,
        98100,
        121300,
        113800,
        139600
      ]
    },
    "chartConfig": {
      "revenue": {
        "label": "Revenue",
        "color": "var(--primary)"
      }
    }
  },
  "charts-2": {
    "chartData": [
      {
        "month": "Jan",
        "users": 11240
      },
      {
        "month": "Feb",
        "users": 13870
      },
      {
        "month": "Mar",
        "users": 12580
      },
      {
        "month": "Apr",
        "users": 16340
      },
      {
        "month": "May",
        "users": 19120
      },
      {
        "month": "Jun",
        "users": 22490
      },
      {
        "month": "Jul",
        "users": 20870
      },
      {
        "month": "Aug",
        "users": 25630
      },
      {
        "month": "Sep",
        "users": 28140
      },
      {
        "month": "Oct",
        "users": 31760
      },
      {
        "month": "Nov",
        "users": 29980
      },
      {
        "month": "Dec",
        "users": 35210
      }
    ],
    "chartConfig": {
      "users": {
        "label": "Active Users",
        "color": "var(--primary)"
      }
    }
  },
  "charts-3": {
    "ranges": [
      {
        "key": "7d",
        "label": "7 Days"
      },
      {
        "key": "30d",
        "label": "30 Days"
      },
      {
        "key": "90d",
        "label": "90 Days"
      }
    ],
    "chartConfig": {
      "visitors": {
        "label": "Visitors",
        "color": "var(--primary)"
      },
      "signups": {
        "label": "Signups",
        "color": "var(--muted-foreground)"
      }
    }
  },
  "charts-4": {
    "chartData": [
      {
        "month": "Jan",
        "visitors": 4200
      },
      {
        "month": "Feb",
        "visitors": 5100
      },
      {
        "month": "Mar",
        "visitors": 4800
      },
      {
        "month": "Apr",
        "visitors": 6300
      },
      {
        "month": "May",
        "visitors": 7200
      },
      {
        "month": "Jun",
        "visitors": 6900
      },
      {
        "month": "Jul",
        "visitors": 8400
      },
      {
        "month": "Aug",
        "visitors": 9100
      },
      {
        "month": "Sep",
        "visitors": 8700
      },
      {
        "month": "Oct",
        "visitors": 10200
      },
      {
        "month": "Nov",
        "visitors": 11300
      },
      {
        "month": "Dec",
        "visitors": 12600
      }
    ],
    "chartConfig": {
      "visitors": {
        "label": "Visitors",
        "color": "var(--primary)"
      }
    }
  },
  "charts-5": {
    "chartData": [
      {
        "source": "Organic",
        "visitors": 4820,
        "fill": "var(--color-organic)"
      },
      {
        "source": "Referral",
        "visitors": 3110,
        "fill": "var(--color-referral)"
      },
      {
        "source": "Social",
        "visitors": 2240,
        "fill": "var(--color-social)"
      },
      {
        "source": "Direct",
        "visitors": 1680,
        "fill": "var(--color-direct)"
      },
      {
        "source": "Email",
        "visitors": 940,
        "fill": "var(--color-email)"
      }
    ],
    "chartConfig": {
      "visitors": {
        "label": "Visitors"
      },
      "organic": {
        "label": "Organic",
        "color": "var(--chart-1)"
      },
      "referral": {
        "label": "Referral",
        "color": "var(--chart-2)"
      },
      "social": {
        "label": "Social",
        "color": "var(--chart-3)"
      },
      "direct": {
        "label": "Direct",
        "color": "var(--chart-4)"
      },
      "email": {
        "label": "Email",
        "color": "var(--chart-5)"
      }
    }
  },
  "coming-soon-1": {
    "waitlistAvatars": [
      "https://i.pravatar.cc/64?img=12",
      "https://i.pravatar.cc/64?img=32",
      "https://i.pravatar.cc/64?img=45",
      "https://i.pravatar.cc/64?img=5"
    ]
  },
  "coming-soon-3": {
    "tiles": [
      {
        "key": "days",
        "label": "Days"
      },
      {
        "key": "hours",
        "label": "Hours"
      },
      {
        "key": "minutes",
        "label": "Minutes"
      },
      {
        "key": "seconds",
        "label": "Seconds"
      }
    ]
  },
  "coming-soon-5": {
    "milestones": [
      {
        "label": "Design",
        "done": true
      },
      {
        "label": "Beta",
        "done": true
      },
      {
        "label": "Launch",
        "done": false
      }
    ]
  },
  "command-palette-3": {
    "groupOrder": [
      "Navigation",
      "Actions",
      "Preferences"
    ]
  },
  "command-palette-4": {
    "groups": [
      "Navigation",
      "Documents",
      "Actions"
    ]
  },
  "comparison-1": {
    "FEATURES": [
      {
        "category": "Core",
        "rows": [
          {
            "label": "Projects",
            "starter": "Up to 3",
            "pro": "Unlimited"
          },
          {
            "label": "Storage",
            "starter": "1 GB",
            "pro": {
              "monthly": "100 GB",
              "annual": "200 GB"
            }
          },
          {
            "label": "API access",
            "starter": true,
            "pro": true
          },
          {
            "label": "Custom domains",
            "starter": false,
            "pro": true
          }
        ]
      },
      {
        "category": "Collaboration",
        "rows": [
          {
            "label": "Team members",
            "starter": "1",
            "pro": "Unlimited"
          },
          {
            "label": "Role-based permissions",
            "starter": false,
            "pro": true
          },
          {
            "label": "Shared workspaces",
            "starter": false,
            "pro": true
          },
          {
            "label": "Activity log",
            "starter": false,
            "pro": true
          }
        ]
      },
      {
        "category": "Security & Compliance",
        "rows": [
          {
            "label": "Two-factor authentication",
            "starter": true,
            "pro": true
          },
          {
            "label": "SSO / SAML",
            "starter": false,
            "pro": true
          },
          {
            "label": "Audit logs",
            "starter": false,
            "pro": true
          },
          {
            "label": "Data residency controls",
            "starter": false,
            "pro": true
          }
        ]
      },
      {
        "category": "Support",
        "rows": [
          {
            "label": "Community forum",
            "starter": true,
            "pro": true
          },
          {
            "label": "Email support",
            "starter": false,
            "pro": true
          },
          {
            "label": "Priority response SLA",
            "starter": false,
            "pro": {
              "monthly": "< 4 h",
              "annual": "< 2 h"
            }
          },
          {
            "label": "Dedicated account manager",
            "starter": false,
            "pro": true
          }
        ]
      }
    ]
  },
  "comparison-2": {
    "acmePoints": [
      "Onboarding completed in under 10 minutes",
      "Real-time sync across all devices and team members",
      "Granular role-based access control included",
      "99.99 % uptime SLA with status page",
      "Dedicated Slack channel for Pro customers",
      "SOC 2 Type II certified infrastructure",
      "One-click data export in any format",
      "No per-seat fees, unlimited collaborators"
    ],
    "othersPoints": [
      "Complex setup requires engineering resources",
      "Sync delays of up to 15 minutes on free tiers",
      "Permissions locked behind enterprise plan",
      "SLA only available on custom contracts",
      "Email-only support with 48 h response time",
      "Compliance docs behind sales call",
      "Data export limited to CSV on lower plans",
      "Per-seat pricing adds up fast at scale"
    ]
  },
  "comparison-3": {
    "plans": [
      {
        "name": "Starter",
        "price": "$0",
        "cadence": "Free Forever",
        "highlighted": false
      },
      {
        "name": "Growth",
        "price": "$24",
        "cadence": "Per User / Month",
        "highlighted": true
      },
      {
        "name": "Enterprise",
        "price": "Custom",
        "cadence": "Talk To Sales",
        "highlighted": false
      }
    ],
    "groups": [
      {
        "section": "Core",
        "features": [
          {
            "label": "Projects",
            "values": [
              "3",
              "Unlimited",
              "Unlimited"
            ]
          },
          {
            "label": "Storage",
            "values": [
              "2 GB",
              "100 GB",
              "1 TB+"
            ]
          },
          {
            "label": "API access",
            "values": [
              false,
              true,
              true
            ]
          },
          {
            "label": "Custom workflows",
            "values": [
              false,
              true,
              true
            ]
          }
        ]
      },
      {
        "section": "Collaboration",
        "features": [
          {
            "label": "Team members",
            "values": [
              "Up to 3",
              "Up to 50",
              "Unlimited"
            ]
          },
          {
            "label": "Real-time editing",
            "values": [
              true,
              true,
              true
            ]
          },
          {
            "label": "Guest access",
            "values": [
              false,
              true,
              true
            ]
          },
          {
            "label": "Roles & permissions",
            "values": [
              "Basic",
              "Advanced",
              "Granular"
            ]
          }
        ]
      },
      {
        "section": "Support",
        "features": [
          {
            "label": "Response time",
            "values": [
              "Community",
              "Under 24h",
              "Under 1h"
            ]
          },
          {
            "label": "Priority queue",
            "values": [
              false,
              true,
              true
            ]
          },
          {
            "label": "Dedicated manager",
            "values": [
              false,
              false,
              true
            ]
          },
          {
            "label": "99.99% uptime SLA",
            "values": [
              false,
              false,
              true
            ]
          }
        ]
      }
    ]
  },
  "comparison-4": {
    "vendors": [
      "Acme",
      "Notion",
      "Trello",
      "Asana"
    ]
  },
  "contact-1": {
    "TOPICS": [
      "General inquiry",
      "Sales",
      "Support",
      "Partnership",
      "Other"
    ]
  },
  "contact-2": {
    "TOPICS": [
      "General inquiry",
      "Sales",
      "Support",
      "Partnership",
      "Other"
    ]
  },
  "contact-3": {
    "TOPICS": [
      "General inquiry",
      "Sales",
      "Support",
      "Partnership",
      "Other"
    ],
    "OFFICES": [
      {
        "city": "San Francisco",
        "address": "548 Market St, Suite 200, CA 94104",
        "phone": "+1 (415) 555-0188"
      },
      {
        "city": "Berlin",
        "address": "Torstraße 35, 10119 Berlin, Germany",
        "phone": "+49 30 555 0142"
      },
      {
        "city": "Singapore",
        "address": "12 Marina Blvd, #18-01, 018982",
        "phone": "+65 6555 0117"
      }
    ]
  },
  "cookie-consent-5": {
    "categories": [
      {
        "id": "necessary",
        "label": "Strictly necessary",
        "description": "Required for the site to function. Always on.",
        "required": true
      },
      {
        "id": "analytics",
        "label": "Analytics",
        "description": "Help us understand how the product is used.",
        "required": false
      },
      {
        "id": "marketing",
        "label": "Marketing",
        "description": "Used to personalize ads and measure campaigns.",
        "required": false
      }
    ]
  },
  "dashboard-1": {
    "RANGES": [
      {
        "value": "7d",
        "label": "Last 7 Days"
      },
      {
        "value": "30d",
        "label": "Last 30 Days"
      },
      {
        "value": "90d",
        "label": "Last 90 Days"
      },
      {
        "value": "12m",
        "label": "Last 12 Months"
      }
    ],
    "STATS_BY_RANGE": {
      "7d": [
        {
          "label": "Revenue",
          "value": "$11.4k",
          "delta": "+3.1%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "2,140",
          "delta": "+1.2%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.31%",
          "delta": "+0.2%",
          "up": true
        },
        {
          "label": "Avg. Session",
          "value": "4m 02s",
          "delta": "-0.4%",
          "up": false
        }
      ],
      "30d": [
        {
          "label": "Revenue",
          "value": "$48.2k",
          "delta": "+12.5%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "8,941",
          "delta": "+4.3%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.24%",
          "delta": "-0.8%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 12s",
          "delta": "+1.1%",
          "up": true
        }
      ],
      "90d": [
        {
          "label": "Revenue",
          "value": "$142.7k",
          "delta": "+9.8%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "26,304",
          "delta": "+7.6%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.18%",
          "delta": "-1.4%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 26s",
          "delta": "+2.3%",
          "up": true
        }
      ],
      "12m": [
        {
          "label": "Revenue",
          "value": "$571.0k",
          "delta": "+22.1%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "98,612",
          "delta": "+18.4%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.02%",
          "delta": "-2.9%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 41s",
          "delta": "+5.0%",
          "up": true
        }
      ]
    },
    "chartData": [
      {
        "month": "Jan",
        "sessions": 1840
      },
      {
        "month": "Feb",
        "sessions": 2120
      },
      {
        "month": "Mar",
        "sessions": 1760
      },
      {
        "month": "Apr",
        "sessions": 2580
      },
      {
        "month": "May",
        "sessions": 2340
      },
      {
        "month": "Jun",
        "sessions": 3120
      },
      {
        "month": "Jul",
        "sessions": 2210
      },
      {
        "month": "Aug",
        "sessions": 2860
      },
      {
        "month": "Sep",
        "sessions": 2480
      },
      {
        "month": "Oct",
        "sessions": 3340
      },
      {
        "month": "Nov",
        "sessions": 2720
      },
      {
        "month": "Dec",
        "sessions": 3010
      }
    ],
    "chartConfig": {
      "sessions": {
        "label": "Sessions",
        "color": "var(--primary)"
      }
    }
  },
  "dashboard-2": {
    "PERIODS": [
      {
        "value": "jun-2026",
        "label": "June 2026"
      },
      {
        "value": "may-2026",
        "label": "May 2026"
      },
      {
        "value": "apr-2026",
        "label": "April 2026"
      },
      {
        "value": "q2-2026",
        "label": "Q2 2026"
      }
    ],
    "STATS_BY_PERIOD": {
      "jun-2026": [
        {
          "label": "Monthly Revenue",
          "value": "$94,310",
          "delta": "+8.2%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "New Signups",
          "value": "1,482",
          "delta": "+23.5%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Churn Rate",
          "value": "1.7%",
          "delta": "+0.4%",
          "trend": "up",
          "good": false,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Support Tickets",
          "value": "38",
          "delta": "-14.9%",
          "trend": "down",
          "good": true,
          "sub": "Vs. Last Month"
        }
      ],
      "may-2026": [
        {
          "label": "Monthly Revenue",
          "value": "$87,140",
          "delta": "+5.1%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "New Signups",
          "value": "1,199",
          "delta": "+11.2%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Churn Rate",
          "value": "1.6%",
          "delta": "-0.2%",
          "trend": "down",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Support Tickets",
          "value": "45",
          "delta": "-8.0%",
          "trend": "down",
          "good": true,
          "sub": "Vs. Last Month"
        }
      ],
      "apr-2026": [
        {
          "label": "Monthly Revenue",
          "value": "$82,920",
          "delta": "+3.4%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "New Signups",
          "value": "1,078",
          "delta": "+6.7%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Churn Rate",
          "value": "1.8%",
          "delta": "+0.3%",
          "trend": "up",
          "good": false,
          "sub": "Vs. Last Month"
        },
        {
          "label": "Support Tickets",
          "value": "49",
          "delta": "+4.2%",
          "trend": "up",
          "good": false,
          "sub": "Vs. Last Month"
        }
      ],
      "q2-2026": [
        {
          "label": "Quarterly Revenue",
          "value": "$264,370",
          "delta": "+6.0%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Quarter"
        },
        {
          "label": "New Signups",
          "value": "3,759",
          "delta": "+14.1%",
          "trend": "up",
          "good": true,
          "sub": "Vs. Last Quarter"
        },
        {
          "label": "Churn Rate",
          "value": "1.7%",
          "delta": "+0.1%",
          "trend": "up",
          "good": false,
          "sub": "Vs. Last Quarter"
        },
        {
          "label": "Support Tickets",
          "value": "132",
          "delta": "-9.3%",
          "trend": "down",
          "good": true,
          "sub": "Vs. Last Quarter"
        }
      ]
    }
  },
  "dashboard-3": {
    "QUARTERS": [
      {
        "value": "q2-2026",
        "label": "Q2 2026"
      },
      {
        "value": "q1-2026",
        "label": "Q1 2026"
      },
      {
        "value": "q4-2025",
        "label": "Q4 2025"
      },
      {
        "value": "q3-2025",
        "label": "Q3 2025"
      }
    ],
    "KPIS_BY_QUARTER": {
      "q2-2026": [
        {
          "label": "Total Revenue",
          "value": "$128,450",
          "delta": "+11.4%",
          "good": true
        },
        {
          "label": "Active Accounts",
          "value": "3,872",
          "delta": "+6.8%",
          "good": true
        },
        {
          "label": "Avg. Order Value",
          "value": "$248",
          "delta": "-2.1%",
          "good": false
        },
        {
          "label": "Net Promoter Score",
          "value": "67",
          "delta": "+4 pts",
          "good": true
        },
        {
          "label": "Refund Rate",
          "value": "0.9%",
          "delta": "-0.3%",
          "good": true
        },
        {
          "label": "Support CSAT",
          "value": "94.2%",
          "delta": "+1.7%",
          "good": true
        }
      ],
      "q1-2026": [
        {
          "label": "Total Revenue",
          "value": "$115,300",
          "delta": "+7.2%",
          "good": true
        },
        {
          "label": "Active Accounts",
          "value": "3,625",
          "delta": "+4.1%",
          "good": true
        },
        {
          "label": "Avg. Order Value",
          "value": "$253",
          "delta": "+1.2%",
          "good": true
        },
        {
          "label": "Net Promoter Score",
          "value": "63",
          "delta": "+2 pts",
          "good": true
        },
        {
          "label": "Refund Rate",
          "value": "1.2%",
          "delta": "+0.1%",
          "good": false
        },
        {
          "label": "Support CSAT",
          "value": "92.5%",
          "delta": "+0.8%",
          "good": true
        }
      ],
      "q4-2025": [
        {
          "label": "Total Revenue",
          "value": "$107,540",
          "delta": "+9.6%",
          "good": true
        },
        {
          "label": "Active Accounts",
          "value": "3,482",
          "delta": "+5.5%",
          "good": true
        },
        {
          "label": "Avg. Order Value",
          "value": "$250",
          "delta": "-0.8%",
          "good": false
        },
        {
          "label": "Net Promoter Score",
          "value": "61",
          "delta": "+5 pts",
          "good": true
        },
        {
          "label": "Refund Rate",
          "value": "1.1%",
          "delta": "-0.2%",
          "good": true
        },
        {
          "label": "Support CSAT",
          "value": "91.7%",
          "delta": "+2.3%",
          "good": true
        }
      ],
      "q3-2025": [
        {
          "label": "Total Revenue",
          "value": "$98,120",
          "delta": "+4.3%",
          "good": true
        },
        {
          "label": "Active Accounts",
          "value": "3,301",
          "delta": "+3.2%",
          "good": true
        },
        {
          "label": "Avg. Order Value",
          "value": "$252",
          "delta": "+0.5%",
          "good": true
        },
        {
          "label": "Net Promoter Score",
          "value": "56",
          "delta": "+1 pt",
          "good": true
        },
        {
          "label": "Refund Rate",
          "value": "1.3%",
          "delta": "+0.2%",
          "good": false
        },
        {
          "label": "Support CSAT",
          "value": "89.4%",
          "delta": "+1.1%",
          "good": true
        }
      ]
    }
  },
  "dashboard-4": {
    "orders": [
      {
        "id": "#3312",
        "name": "Elena Duarte",
        "initials": "ED",
        "avatar": "https://i.pravatar.cc/80?img=45",
        "amount": "$420.00",
        "status": "Paid",
        "date": "Jul 21"
      },
      {
        "id": "#3311",
        "name": "Marcus Feld",
        "initials": "MF",
        "avatar": "https://i.pravatar.cc/80?img=13",
        "amount": "$180.50",
        "status": "Processing",
        "date": "Jul 21"
      },
      {
        "id": "#3310",
        "name": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "amount": "$650.00",
        "status": "Paid",
        "date": "Jul 20"
      },
      {
        "id": "#3309",
        "name": "Tomás Rivera",
        "initials": "TR",
        "avatar": "https://i.pravatar.cc/80?img=52",
        "amount": "$92.00",
        "status": "Refunded",
        "date": "Jul 20"
      },
      {
        "id": "#3308",
        "name": "Hannah Osei",
        "initials": "HO",
        "avatar": "https://i.pravatar.cc/80?img=27",
        "amount": "$1,240.00",
        "status": "Paid",
        "date": "Jul 19"
      }
    ]
  },
  "error-2": {
    "popularPages": [
      "Getting started",
      "Installation guide",
      "Components reference",
      "Theming and tokens"
    ]
  },
  "faqs-1": {
    "faqs": [
      {
        "q": "What is included in each plan?",
        "a": "Every plan includes the core platform, unlimited projects, and access to the component library. Higher tiers add advanced analytics, priority support, and SSO."
      },
      {
        "q": "Can I change my plan later?",
        "a": "Yes. You can upgrade or downgrade at any time from your billing settings, and changes are prorated automatically."
      },
      {
        "q": "Do you offer a free trial?",
        "a": "All paid plans come with a 14-day free trial. No credit card is required to get started."
      },
      {
        "q": "How does billing work?",
        "a": "We bill monthly or annually, and annual plans save you two months. You can cancel anytime with no hidden fees."
      },
      {
        "q": "Is my data secure?",
        "a": "Your data is encrypted in transit and at rest, and we run regular third-party security audits to keep it safe."
      }
    ]
  },
  "faqs-2": {
    "faqs": [
      {
        "q": "How do I invite teammates to my workspace?",
        "a": "Open Settings, navigate to the Members tab, and enter your teammate's email address. They will receive an invitation link valid for 72 hours. You can resend or revoke invitations at any time."
      },
      {
        "q": "Which authentication methods are supported?",
        "a": "Acme supports email and password, magic-link sign-in, Google OAuth, and SAML SSO for enterprise plans. Two-factor authentication is available on all tiers."
      },
      {
        "q": "Can I export my data at any time?",
        "a": "Yes. From your account settings you can request a full JSON export of all your projects, assets, and activity logs. Exports are processed within minutes and delivered to your registered email."
      },
      {
        "q": "What happens when I reach my storage limit?",
        "a": "You will receive email alerts at 80% and 95% usage. Once the limit is reached, uploads are paused until you upgrade your plan or remove existing files."
      },
      {
        "q": "Is there a sandbox environment for testing?",
        "a": "Every workspace includes a Sandbox environment that mirrors production but never affects live data. API calls made in Sandbox are free and excluded from your usage quota."
      },
      {
        "q": "How are API rate limits enforced?",
        "a": "Requests are metered per minute and per day at the workspace level. Exceeding either threshold returns a 429 response with a Retry-After header indicating when capacity resets."
      },
      {
        "q": "Do you offer SLA guarantees?",
        "a": "Business and Enterprise plans include a 99.9% monthly uptime SLA backed by financial credits. Our status page at status.acme.io provides real-time incident updates."
      },
      {
        "q": "How do I contact support?",
        "a": "You can reach our team through the in-app chat, by emailing support@acme.io, or by opening a ticket in your dashboard. Enterprise customers also have access to a dedicated Slack channel."
      }
    ]
  },
  "faqs-3": {
    "faqs": [
      {
        "q": "How do I get started with Acme?",
        "a": "Sign up for a free account, create your first workspace, and follow the onboarding checklist. You will be up and running in under five minutes."
      },
      {
        "q": "Can I use Acme for multiple projects?",
        "a": "Yes. Every account supports unlimited projects. You can organise them into separate workspaces and control access permissions per workspace."
      },
      {
        "q": "What payment methods do you accept?",
        "a": "We accept all major credit and debit cards as well as ACH bank transfers for annual plans. Invoiced billing is available for Enterprise customers."
      },
      {
        "q": "How do I cancel my subscription?",
        "a": "You can cancel at any time from Billing in your account settings. Your plan remains active until the end of the current billing period and will not renew."
      },
      {
        "q": "Is my data portable?",
        "a": "Absolutely. You can export all your data as JSON or CSV from the Settings page at any time, with no restrictions or exit fees."
      },
      {
        "q": "Do you offer discounts for non-profits?",
        "a": "We offer a 40% discount for verified non-profit organisations. Reach out to our team with your registration documents to apply."
      }
    ]
  },
  "faqs-4": {
    "faqs": [
      {
        "q": "How do I install a block from the registry?",
        "a": "Copy the install command from any block page and run it with the shadcn CLI. The block, its dependencies, and required primitives are added straight to your project."
      },
      {
        "q": "Do the blocks work with my existing theme?",
        "a": "Yes. Every block is built on shadcn theme tokens, so it inherits your colors, radius, and typography automatically and renders correctly in both light and dark mode."
      },
      {
        "q": "Can I customize a block after installing it?",
        "a": "Absolutely. Blocks are copied directly into your codebase as plain, editable source, so you own the code and can change markup, styles, and logic however you like."
      },
      {
        "q": "What is the difference between free and Pro blocks?",
        "a": "Free blocks are open and installable by anyone. Pro blocks unlock advanced layouts, dashboards, and full-page templates, served through your authenticated Acme account."
      },
      {
        "q": "Will updates to a block overwrite my changes?",
        "a": "No. Because blocks live in your repository, reinstalling a newer version is opt-in. You decide when to pull updates and how to merge them with your edits."
      },
      {
        "q": "Which frameworks are supported?",
        "a": "Blocks target React 19 and Next.js with the App Router, styled using Tailwind CSS. Most are framework-agnostic enough to drop into any modern React setup."
      }
    ]
  },
  "features-3": {
    "ITEMS": [
      {
        "label": "Unlimited workspaces",
        "detail": "Create as many projects as your team needs with no per-workspace fees."
      },
      {
        "label": "Role-based access control",
        "detail": "Assign viewer, editor, or admin permissions down to the resource level."
      },
      {
        "label": "SSO via SAML 2.0 & OIDC",
        "detail": "Connect your identity provider in minutes: Okta, Azure AD, and more."
      },
      {
        "label": "Real-time sync",
        "detail": "Changes propagate across all clients in under 50 ms on average."
      },
      {
        "label": "Audit log & SIEM export",
        "detail": "Every action is timestamped, immutable, and exportable to your SIEM."
      },
      {
        "label": "99.99% uptime SLA",
        "detail": "Geo-redundant infrastructure backed by a contractual availability guarantee."
      },
      {
        "label": "REST & GraphQL APIs",
        "detail": "Build on top of Acme with fully documented, versioned API endpoints."
      },
      {
        "label": "Webhooks & event streams",
        "detail": "Push real-time events to your own endpoints the moment something changes."
      },
      {
        "label": "CSV, JSON & Parquet export",
        "detail": "Take your data anywhere, with no lock-in or extraction fees."
      },
      {
        "label": "Scheduled reports",
        "detail": "Deliver PDF or email digests to stakeholders on any cadence you set."
      },
      {
        "label": "End-to-end encryption",
        "detail": "Data is encrypted in transit with TLS 1.3 and at rest with AES-256."
      },
      {
        "label": "EU & US data residency",
        "detail": "Choose which region stores your data to meet local compliance requirements."
      }
    ]
  },
  "features-5": {
    "checklist": [
      "Role-based access with per-workspace permissions",
      "SAML and SCIM for automated provisioning",
      "Audit logs exported to your warehouse",
      "Regional data residency on every plan"
    ]
  },
  "file-upload-4": {
    "seed": [
      {
        "id": 1,
        "src": "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&q=80",
        "name": "facade.jpg"
      },
      {
        "id": 2,
        "src": "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&q=80",
        "name": "skyline.jpg"
      },
      {
        "id": 3,
        "src": "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&q=80",
        "name": "stairs.jpg"
      },
      {
        "id": 4,
        "src": "https://images.unsplash.com/photo-1481253127861-534498168948?w=400&q=80",
        "name": "bridge.jpg"
      },
      {
        "id": 5,
        "src": "https://images.unsplash.com/photo-1470723710355-95304d8aece4?w=400&q=80",
        "name": "atrium.jpg"
      }
    ]
  },
  "footer-1": {
    "columns": [
      {
        "title": "Product",
        "links": [
          "Blocks",
          "Templates",
          "Pricing",
          "Changelog"
        ]
      },
      {
        "title": "Resources",
        "links": [
          "Docs",
          "Guides",
          "Support",
          "API"
        ]
      },
      {
        "title": "Company",
        "links": [
          "About",
          "Blog",
          "Careers",
          "Contact"
        ]
      }
    ]
  },
  "footer-2": {
    "NAV_LINKS": [
      {
        "label": "Product",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Docs",
        "href": "#"
      },
      {
        "label": "Blog",
        "href": "#"
      },
      {
        "label": "Privacy",
        "href": "#"
      },
      {
        "label": "Terms",
        "href": "#"
      }
    ]
  },
  "footer-3": {
    "columns": [
      {
        "title": "Product",
        "links": [
          "Blocks",
          "Templates",
          "Pricing",
          "Changelog",
          "Roadmap"
        ]
      },
      {
        "title": "Resources",
        "links": [
          "Documentation",
          "Guides",
          "API Reference",
          "Support"
        ]
      },
      {
        "title": "Company",
        "links": [
          "About",
          "Blog",
          "Careers",
          "Contact"
        ]
      }
    ]
  },
  "footer-5": {
    "columns": [
      {
        "heading": "Product",
        "links": [
          "Features",
          "Pricing",
          "Changelog",
          "Roadmap"
        ]
      },
      {
        "heading": "Company",
        "links": [
          "About",
          "Blog",
          "Careers",
          "Contact"
        ]
      },
      {
        "heading": "Resources",
        "links": [
          "Docs",
          "Support",
          "Status",
          "Community"
        ]
      }
    ]
  },
  "gallery-1": {
    "tiles": [
      {
        "id": 1,
        "label": "Mountain sunrise",
        "location": "Rocky Mountains, CO",
        "contributor": {
          "name": "Maya Osei",
          "initials": "MO",
          "avatar": "https://i.pravatar.cc/40?img=1"
        },
        "tag": "Landscape",
        "featured": true,
        "src": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80"
      },
      {
        "id": 2,
        "label": "City skyline",
        "location": "Chicago, IL",
        "contributor": {
          "name": "Leo Farris",
          "initials": "LF",
          "avatar": "https://i.pravatar.cc/40?img=2"
        },
        "tag": "Urban",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80"
      },
      {
        "id": 3,
        "label": "Forest trail",
        "location": "Olympic NP, WA",
        "contributor": {
          "name": "Sara Kim",
          "initials": "SK",
          "avatar": "https://i.pravatar.cc/40?img=5"
        },
        "tag": "Nature",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&q=80"
      },
      {
        "id": 4,
        "label": "Ocean waves",
        "location": "Big Sur, CA",
        "contributor": {
          "name": "Dante Ruiz",
          "initials": "DR",
          "avatar": "https://i.pravatar.cc/40?img=7"
        },
        "tag": "Coastal",
        "featured": true,
        "src": "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1200&q=80"
      },
      {
        "id": 5,
        "label": "Desert dunes",
        "location": "Sahara, Morocco",
        "contributor": {
          "name": "Nadia Voss",
          "initials": "NV",
          "avatar": "https://i.pravatar.cc/40?img=9"
        },
        "tag": "Landscape",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&q=80"
      },
      {
        "id": 6,
        "label": "Snowy peaks",
        "location": "Lauterbrunnen, CH",
        "contributor": {
          "name": "Jin Park",
          "initials": "JP",
          "avatar": "https://i.pravatar.cc/40?img=11"
        },
        "tag": "Alpine",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&q=80"
      },
      {
        "id": 7,
        "label": "Autumn leaves",
        "location": "Vermont, USA",
        "contributor": {
          "name": "Fiona Blake",
          "initials": "FB",
          "avatar": "https://i.pravatar.cc/40?img=13"
        },
        "tag": "Seasonal",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1507371341162-763b5e419408?w=1200&q=80"
      },
      {
        "id": 8,
        "label": "Wildflower field",
        "location": "Tuscany, Italy",
        "contributor": {
          "name": "Arjun Mehta",
          "initials": "AM",
          "avatar": "https://i.pravatar.cc/40?img=15"
        },
        "tag": "Nature",
        "featured": true,
        "src": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80"
      },
      {
        "id": 9,
        "label": "Coastal cliffs",
        "location": "Moher, Ireland",
        "contributor": {
          "name": "Cleo Torres",
          "initials": "CT",
          "avatar": "https://i.pravatar.cc/40?img=17"
        },
        "tag": "Coastal",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&q=80&crop=edges"
      },
      {
        "id": 10,
        "label": "River valley",
        "location": "Columbia Gorge, OR",
        "contributor": {
          "name": "Eli Grant",
          "initials": "EG",
          "avatar": "https://i.pravatar.cc/40?img=19"
        },
        "tag": "Landscape",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200&q=80&crop=edges"
      },
      {
        "id": 11,
        "label": "Jungle canopy",
        "location": "Amazon Basin, BR",
        "contributor": {
          "name": "Amara Diop",
          "initials": "AD",
          "avatar": "https://i.pravatar.cc/40?img=21"
        },
        "tag": "Nature",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1445264718234-a623be589d37?w=800&q=80&crop=edges",
        "full": "https://images.unsplash.com/photo-1445264718234-a623be589d37?w=1200&q=80&crop=edges"
      },
      {
        "id": 12,
        "label": "Lakeside dawn",
        "location": "Lake Bled, SI",
        "contributor": {
          "name": "Theo Hartmann",
          "initials": "TH",
          "avatar": "https://i.pravatar.cc/40?img=23"
        },
        "tag": "Landscape",
        "featured": false,
        "src": "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80&crop=entropy",
        "full": "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200&q=80&crop=entropy"
      }
    ]
  },
  "gallery-2": {
    "screens": [
      {
        "id": 1,
        "label": "Acme Dashboard: Overview",
        "url": "app.acme.io/dashboard",
        "version": "v2.4",
        "description": "A unified command center for monitoring pipeline health, active deployments, and real-time system metrics across all environments.",
        "src": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        "alt": "Acme dashboard overview showing pipeline metrics"
      },
      {
        "id": 2,
        "label": "Analytics",
        "url": "app.acme.io/analytics",
        "description": "Deep-dive into usage trends, funnel conversion, and retention cohorts.",
        "src": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=75",
        "alt": "Analytics charts and metrics"
      },
      {
        "id": 3,
        "label": "Deployments",
        "url": "app.acme.io/deployments",
        "description": "Track every release: status, rollback controls, and canary traffic splits.",
        "src": "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=75",
        "alt": "Deployment pipeline and release status"
      },
      {
        "id": 4,
        "label": "Team Settings",
        "url": "app.acme.io/team",
        "description": "Manage members, roles, SSO configuration, and access policies.",
        "src": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=75",
        "alt": "Team settings and member management"
      },
      {
        "id": 5,
        "label": "Audit Logs",
        "url": "app.acme.io/audit",
        "description": "Immutable event history with filtering, export, and alert rules.",
        "src": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=75",
        "alt": "Audit log event timeline"
      },
      {
        "id": 6,
        "label": "API Keys",
        "url": "app.acme.io/api-keys",
        "description": "Generate, rotate, and scope API credentials with fine-grained permissions.",
        "src": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=75",
        "alt": "API key management interface"
      }
    ]
  },
  "gallery-3": {
    "tiles": [
      {
        "id": 1,
        "title": "Mountain sunrise",
        "meta": "Rocky Mountains, CO",
        "tag": "Landscape",
        "ratio": "aspect-[4/5]",
        "src": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80"
      },
      {
        "id": 2,
        "title": "City skyline",
        "meta": "Chicago, IL",
        "tag": "Urban",
        "ratio": "aspect-square",
        "src": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80"
      },
      {
        "id": 3,
        "title": "Forest trail",
        "meta": "Olympic NP, WA",
        "tag": "Nature",
        "ratio": "aspect-[3/4]",
        "src": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200&q=80"
      },
      {
        "id": 4,
        "title": "Ocean waves",
        "meta": "Big Sur, CA",
        "tag": "Coastal",
        "ratio": "aspect-[4/3]",
        "src": "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1200&q=80"
      },
      {
        "id": 5,
        "title": "Desert dunes",
        "meta": "Sahara, Morocco",
        "tag": "Landscape",
        "ratio": "aspect-[5/6]",
        "src": "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&q=80"
      },
      {
        "id": 6,
        "title": "Snowy peaks",
        "meta": "Lauterbrunnen, CH",
        "tag": "Alpine",
        "ratio": "aspect-square",
        "src": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&q=80"
      },
      {
        "id": 7,
        "title": "Wildflower field",
        "meta": "Tuscany, Italy",
        "tag": "Nature",
        "ratio": "aspect-[4/5]",
        "src": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80"
      },
      {
        "id": 8,
        "title": "Coastal cliffs",
        "meta": "Moher, Ireland",
        "tag": "Coastal",
        "ratio": "aspect-[3/4]",
        "src": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80",
        "full": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200&q=80"
      }
    ]
  },
  "gallery-4": {
    "photos": [
      {
        "id": 1,
        "src": "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80",
        "title": "Financial District",
        "location": "New York, USA"
      },
      {
        "id": 2,
        "src": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=700&q=80",
        "title": "Alpine Fog",
        "location": "Grindelwald, CH"
      },
      {
        "id": 3,
        "src": "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=700&q=80",
        "title": "Coastal Dunes",
        "location": "Jutland, DK"
      },
      {
        "id": 4,
        "src": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=700&q=80",
        "title": "Pine Canopy",
        "location": "Bavaria, DE"
      },
      {
        "id": 5,
        "src": "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=700&q=80",
        "title": "Still Water",
        "location": "Hallstatt, AT"
      }
    ]
  },
  "header-1": {
    "navLinks": [
      "Blocks",
      "Docs",
      "Pricing",
      "Changelog"
    ]
  },
  "header-14": {
    "sections": [
      {
        "id": "overview",
        "label": "Overview"
      },
      {
        "id": "features",
        "label": "Features"
      },
      {
        "id": "pricing",
        "label": "Pricing"
      },
      {
        "id": "faq",
        "label": "FAQ"
      }
    ]
  },
  "header-2": {
    "navLinks": [
      {
        "label": "Products",
        "href": "#"
      },
      {
        "label": "Solutions",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Docs",
        "href": "#"
      },
      {
        "label": "Blog",
        "href": "#"
      }
    ]
  },
  "header-3": {
    "navLinks": [
      {
        "label": "Product",
        "href": "#"
      },
      {
        "label": "Solutions",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Resources",
        "href": "#"
      }
    ]
  },
  "header-4": {
    "productLinks": [
      {
        "title": "Analytics",
        "description": "Understand your traffic"
      },
      {
        "title": "Automations",
        "description": "Put workflows on autopilot"
      },
      {
        "title": "Integrations",
        "description": "Connect your stack"
      }
    ],
    "navLinks": [
      "Docs",
      "Pricing",
      "Customers"
    ]
  },
  "hero-1": {
    "LOGOS": [
      "Northwind",
      "Vertex",
      "Lumina",
      "Cascade",
      "Quantel"
    ]
  },
  "hero-2": {
    "TRUST_ITEMS": [
      "No credit card required",
      "14-day free trial",
      "Cancel anytime"
    ],
    "SCREENSHOT_ROWS": [
      {
        "label": "Revenue",
        "value": "$48,290",
        "change": "+12.4%",
        "positive": true
      },
      {
        "label": "Users",
        "value": "3,841",
        "change": "+8.1%",
        "positive": true
      },
      {
        "label": "Churn",
        "value": "1.7%",
        "change": "-0.3%",
        "positive": true
      },
      {
        "label": "Session",
        "value": "4m 22s",
        "change": "+0.9%",
        "positive": true
      }
    ]
  },
  "hero-6": {
    "avatars": [
      {
        "src": "https://i.pravatar.cc/80?img=45",
        "name": "Elena",
        "initials": "E"
      },
      {
        "src": "https://i.pravatar.cc/80?img=13",
        "name": "Marcus",
        "initials": "M"
      },
      {
        "src": "https://i.pravatar.cc/80?img=32",
        "name": "Priya",
        "initials": "P"
      },
      {
        "src": "https://i.pravatar.cc/80?img=52",
        "name": "Tomás",
        "initials": "T"
      },
      {
        "src": "https://i.pravatar.cc/80?img=27",
        "name": "Hannah",
        "initials": "H"
      }
    ]
  },
  "integrations-3": {
    "filters": [
      "All",
      "Communication",
      "Analytics",
      "Payments",
      "Dev Tools"
    ]
  },
  "kanban-1": {
    "labelVariant": {
      "Bug": "destructive",
      "Feature": "default",
      "Docs": "secondary",
      "Design": "secondary",
      "Infra": "outline",
      "Research": "outline"
    },
    "initialColumns": [
      {
        "id": "todo",
        "title": "To Do",
        "accent": "bg-muted-foreground/20",
        "tasks": [
          {
            "id": "t1",
            "title": "Audit accessibility across all form components",
            "label": "Docs",
            "assignee": "Morgan Lee",
            "initials": "ML",
            "avatarSrc": "https://i.pravatar.cc/32?img=47",
            "priority": "medium"
          },
          {
            "id": "t2",
            "title": "Investigate memory leak in background worker",
            "label": "Bug",
            "assignee": "Sam Rivera",
            "initials": "SR",
            "avatarSrc": "https://i.pravatar.cc/32?img=12",
            "priority": "high"
          },
          {
            "id": "t3",
            "title": "Add dark-mode support to email templates",
            "label": "Design",
            "assignee": "Jamie Park",
            "initials": "JP",
            "avatarSrc": "https://i.pravatar.cc/32?img=33",
            "priority": "low"
          },
          {
            "id": "t4",
            "title": "Define quarterly OKRs with product team",
            "label": "Research",
            "assignee": "Alex Chen",
            "initials": "AC",
            "avatarSrc": "https://i.pravatar.cc/32?img=68",
            "priority": "medium"
          }
        ]
      },
      {
        "id": "in-progress",
        "title": "In Progress",
        "accent": "bg-primary",
        "tasks": [
          {
            "id": "t5",
            "title": "Migrate CI/CD pipeline to GitHub Actions",
            "label": "Infra",
            "assignee": "Jordan Kim",
            "initials": "JK",
            "avatarSrc": "https://i.pravatar.cc/32?img=51",
            "priority": "high"
          },
          {
            "id": "t6",
            "title": "Build multi-step onboarding wizard",
            "label": "Feature",
            "assignee": "Taylor Obi",
            "initials": "TO",
            "avatarSrc": "https://i.pravatar.cc/32?img=22",
            "priority": "high"
          },
          {
            "id": "t7",
            "title": "Fix pagination on the invoices list view",
            "label": "Bug",
            "assignee": "Sam Rivera",
            "initials": "SR",
            "avatarSrc": "https://i.pravatar.cc/32?img=12",
            "priority": "medium"
          }
        ]
      },
      {
        "id": "done",
        "title": "Done",
        "accent": "bg-muted-foreground/30",
        "tasks": [
          {
            "id": "t8",
            "title": "Set up error monitoring with Sentry",
            "label": "Infra",
            "assignee": "Alex Chen",
            "initials": "AC",
            "avatarSrc": "https://i.pravatar.cc/32?img=68",
            "priority": "medium"
          },
          {
            "id": "t9",
            "title": "Write API reference for webhooks endpoint",
            "label": "Docs",
            "assignee": "Jamie Park",
            "initials": "JP",
            "avatarSrc": "https://i.pravatar.cc/32?img=33",
            "priority": "low"
          },
          {
            "id": "t10",
            "title": "Redesign settings page layout",
            "label": "Design",
            "assignee": "Morgan Lee",
            "initials": "ML",
            "avatarSrc": "https://i.pravatar.cc/32?img=47",
            "priority": "low"
          }
        ]
      }
    ]
  },
  "kanban-2": {
    "assigneeAvatars": {
      "Sam Rivera": "https://i.pravatar.cc/150?img=15",
      "Jordan Kim": "https://i.pravatar.cc/150?img=8",
      "Morgan Lee": "https://i.pravatar.cc/150?img=26",
      "Taylor Obi": "https://i.pravatar.cc/150?img=59",
      "Jamie Park": "https://i.pravatar.cc/150?img=12",
      "Alex Chen": "https://i.pravatar.cc/150?img=33"
    },
    "initialTasks": [
      {
        "id": "ACM-412",
        "title": "Resolve CORS error on the upload endpoint",
        "description": "POST /api/v2/files returns 403 for cross-origin requests; preflight OPTIONS never reaches the handler.",
        "priority": "critical",
        "labels": [
          "Backend",
          "API"
        ],
        "dueDate": "Jun 18",
        "assignees": [
          {
            "name": "Sam Rivera",
            "initials": "SR"
          },
          {
            "name": "Jordan Kim",
            "initials": "JK"
          }
        ],
        "commentCount": 7
      },
      {
        "id": "ACM-398",
        "title": "Redesign the account settings page",
        "description": "Consolidate billing, profile, and notification preferences into a single tabbed layout using the new design tokens.",
        "priority": "high",
        "labels": [
          "Frontend",
          "Design"
        ],
        "dueDate": "Jun 23",
        "assignees": [
          {
            "name": "Morgan Lee",
            "initials": "ML"
          },
          {
            "name": "Taylor Obi",
            "initials": "TO"
          },
          {
            "name": "Jamie Park",
            "initials": "JP"
          }
        ],
        "commentCount": 4
      },
      {
        "id": "ACM-385",
        "title": "Add rate limiting to the public REST API",
        "description": "Implement a sliding-window limiter (100 req/min per key) with proper Retry-After headers on 429 responses.",
        "priority": "high",
        "labels": [
          "Backend",
          "API",
          "DevOps"
        ],
        "dueDate": "Jun 26",
        "assignees": [
          {
            "name": "Alex Chen",
            "initials": "AC"
          }
        ],
        "commentCount": 2
      },
      {
        "id": "ACM-371",
        "title": "Write end-to-end tests for the checkout flow",
        "description": "Cover happy path, declined card, and coupon-code scenarios using Playwright against the staging environment.",
        "priority": "medium",
        "labels": [
          "QA",
          "Frontend"
        ],
        "dueDate": "Jul 2",
        "assignees": [
          {
            "name": "Sam Rivera",
            "initials": "SR"
          },
          {
            "name": "Morgan Lee",
            "initials": "ML"
          }
        ],
        "commentCount": 0
      },
      {
        "id": "ACM-360",
        "title": "Document the webhook payload schema",
        "description": "Add OpenAPI 3.1 schemas for all event types and publish the spec to the developer portal.",
        "priority": "low",
        "labels": [
          "Backend",
          "API"
        ],
        "dueDate": "Jul 8",
        "assignees": [
          {
            "name": "Jamie Park",
            "initials": "JP"
          }
        ],
        "commentCount": 1
      }
    ]
  },
  "kanban-3": {
    "initialColumns": [
      {
        "id": "todo",
        "title": "To Do",
        "tasks": [
          {
            "id": "k1",
            "title": "Draft Q3 launch announcement",
            "label": "Marketing",
            "assignee": "Ravi Patel",
            "initials": "RP",
            "avatarSrc": "https://i.pravatar.cc/32?img=15"
          },
          {
            "id": "k2",
            "title": "Design empty states for reports",
            "label": "Design",
            "assignee": "Mia Cho",
            "initials": "MC",
            "avatarSrc": "https://i.pravatar.cc/32?img=47"
          },
          {
            "id": "k3",
            "title": "Set up staging environment",
            "label": "Ops",
            "assignee": "Leo Fenn",
            "initials": "LF",
            "avatarSrc": "https://i.pravatar.cc/32?img=51"
          }
        ]
      },
      {
        "id": "in-progress",
        "title": "In Progress",
        "tasks": [
          {
            "id": "k4",
            "title": "Build billing usage endpoint",
            "label": "Engineering",
            "assignee": "Dana Wu",
            "initials": "DW",
            "avatarSrc": "https://i.pravatar.cc/32?img=32"
          },
          {
            "id": "k5",
            "title": "Rework onboarding checklist",
            "label": "Design",
            "assignee": "Mia Cho",
            "initials": "MC",
            "avatarSrc": "https://i.pravatar.cc/32?img=47"
          }
        ]
      },
      {
        "id": "review",
        "title": "Review",
        "tasks": [
          {
            "id": "k6",
            "title": "Audit tracking events",
            "label": "Marketing",
            "assignee": "Ravi Patel",
            "initials": "RP",
            "avatarSrc": "https://i.pravatar.cc/32?img=15"
          }
        ]
      },
      {
        "id": "done",
        "title": "Done",
        "tasks": [
          {
            "id": "k7",
            "title": "Migrate assets to CDN",
            "label": "Ops",
            "assignee": "Leo Fenn",
            "initials": "LF",
            "avatarSrc": "https://i.pravatar.cc/32?img=51"
          },
          {
            "id": "k8",
            "title": "Ship dark-mode tokens",
            "label": "Engineering",
            "assignee": "Dana Wu",
            "initials": "DW",
            "avatarSrc": "https://i.pravatar.cc/32?img=32"
          }
        ]
      }
    ]
  },
  "kanban-4": {
    "initialLanes": [
      {
        "id": "today",
        "title": "Today",
        "hint": "Due by end of day",
        "tasks": [
          {
            "id": "m1",
            "title": "Reply to design review comments",
            "project": "Web App",
            "priority": "high"
          },
          {
            "id": "m2",
            "title": "Finalize sprint retro notes",
            "project": "Team",
            "priority": "medium"
          },
          {
            "id": "m3",
            "title": "Approve new marketing copy",
            "project": "Website",
            "priority": "low"
          }
        ]
      },
      {
        "id": "week",
        "title": "This Week",
        "hint": "Planned for the next few days",
        "tasks": [
          {
            "id": "m4",
            "title": "Draft the analytics dashboard spec",
            "project": "Web App",
            "priority": "medium"
          },
          {
            "id": "m5",
            "title": "Pair on the billing migration",
            "project": "Platform",
            "priority": "high"
          }
        ]
      },
      {
        "id": "later",
        "title": "Later",
        "hint": "Backlog, not yet scheduled",
        "tasks": [
          {
            "id": "m6",
            "title": "Explore a mobile push strategy",
            "project": "Growth",
            "priority": "low"
          },
          {
            "id": "m7",
            "title": "Refactor the settings form",
            "project": "Web App",
            "priority": "low"
          }
        ]
      }
    ]
  },
  "newsletter-5": {
    "readers": [
      {
        "name": "Mara Lin",
        "initials": "ML",
        "avatar": "https://i.pravatar.cc/64?img=32"
      },
      {
        "name": "Leo Tanaka",
        "initials": "LT",
        "avatar": "https://i.pravatar.cc/64?img=12"
      },
      {
        "name": "Owen Reyes",
        "initials": "OR",
        "avatar": "https://i.pravatar.cc/64?img=53"
      },
      {
        "name": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/64?img=45"
      },
      {
        "name": "Sam Whitfield",
        "initials": "SW",
        "avatar": "https://i.pravatar.cc/64?img=59"
      }
    ]
  },
  "notifications-3": {
    "initialNotifications": [
      {
        "id": "n1",
        "kind": "mention",
        "actor": "Mara Ellis",
        "initials": "ME",
        "avatar": "https://i.pravatar.cc/150?img=44",
        "title": "Mara Ellis mentioned you",
        "snippet": "@you can you take a look at the new pricing copy before we ship the Acme launch page?",
        "timestamp": "2 Min Ago",
        "unread": true,
        "mention": true
      },
      {
        "id": "n2",
        "kind": "review",
        "actor": "Devon Park",
        "initials": "DP",
        "avatar": "https://i.pravatar.cc/150?img=33",
        "title": "Review requested on acme/web#482",
        "snippet": "Refactor checkout flow to use the new payment intents API. 14 files changed.",
        "timestamp": "18 Min Ago",
        "unread": true,
        "mention": false
      },
      {
        "id": "n3",
        "kind": "comment",
        "actor": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/150?img=45",
        "title": "New comment on “Q3 Roadmap”",
        "snippet": "Left a few notes on the onboarding milestone. Think we can pull it forward a sprint.",
        "timestamp": "1 Hour Ago",
        "unread": true,
        "mention": false
      },
      {
        "id": "n4",
        "kind": "mention",
        "actor": "Leo Tanaka",
        "initials": "LT",
        "avatar": "https://i.pravatar.cc/150?img=51",
        "title": "Leo Tanaka mentioned you in #design",
        "snippet": "thanks @you, pushed the updated tokens, dark mode contrast is fixed now.",
        "timestamp": "3 Hours Ago",
        "unread": false,
        "mention": true
      },
      {
        "id": "n5",
        "kind": "follow",
        "actor": "Sasha Kim",
        "initials": "SK",
        "avatar": "https://i.pravatar.cc/150?img=32",
        "title": "Sasha Kim started following you",
        "snippet": "You now share 12 workspaces across the Acme organization.",
        "timestamp": "5 Hours Ago",
        "unread": false,
        "mention": false
      },
      {
        "id": "n6",
        "kind": "security",
        "actor": "Acme Security",
        "initials": "AS",
        "title": "New sign-in from a new device",
        "snippet": "MacBook Pro • San Francisco, CA. If this wasn’t you, review your active sessions.",
        "timestamp": "Yesterday",
        "unread": false,
        "mention": false
      },
      {
        "id": "n7",
        "kind": "star",
        "actor": "Community",
        "initials": "AC",
        "title": "Your project hit 1,000 stars",
        "snippet": "acme/ui-kit just crossed 1k stars on the registry. Nice work.",
        "timestamp": "2 Days Ago",
        "unread": false,
        "mention": false
      }
    ]
  },
  "notifications-4": {
    "categories": [
      {
        "id": "comments",
        "label": "Comments",
        "description": "When someone comments on your work."
      },
      {
        "id": "mentions",
        "label": "Mentions",
        "description": "When someone @mentions you."
      },
      {
        "id": "deploys",
        "label": "Deployments",
        "description": "When a deploy succeeds or fails."
      },
      {
        "id": "digest",
        "label": "Weekly digest",
        "description": "A summary of activity every Monday."
      }
    ]
  },
  "onboarding-6": {
    "steps": [
      {
        "label": "Create your account",
        "done": true
      },
      {
        "label": "Set up your workspace",
        "done": true
      },
      {
        "label": "Invite your team",
        "done": false
      },
      {
        "label": "Connect an integration",
        "done": false
      },
      {
        "label": "Create your first project",
        "done": false
      }
    ]
  },
  "page-header-4": {
    "contributors": [
      {
        "name": "Mara Lin",
        "initials": "ML",
        "avatar": "https://i.pravatar.cc/64?img=32"
      },
      {
        "name": "Leo Tanaka",
        "initials": "LT",
        "avatar": "https://i.pravatar.cc/64?img=12"
      },
      {
        "name": "Owen Reyes",
        "initials": "OR",
        "avatar": "https://i.pravatar.cc/64?img=53"
      },
      {
        "name": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/64?img=45"
      }
    ]
  },
  "page-header-6": {
    "stats": [
      {
        "label": "Total revenue",
        "value": "$128.4k",
        "delta": "+12.4%"
      },
      {
        "label": "Active users",
        "value": "8,240",
        "delta": "+3.1%"
      },
      {
        "label": "Conversion",
        "value": "4.7%",
        "delta": "+0.6%"
      },
      {
        "label": "Churn",
        "value": "1.2%",
        "delta": "-0.3%"
      }
    ]
  },
  "pricing-1": {
    "tiers": [
      {
        "name": "Starter",
        "monthly": 0,
        "annual": 0,
        "description": "For side projects and getting started.",
        "features": [
          "Up to 3 projects",
          "Community support",
          "1 GB storage"
        ],
        "cta": "Get Started",
        "featured": false
      },
      {
        "name": "Pro",
        "monthly": 29,
        "annual": 23,
        "description": "For growing teams that ship every day.",
        "features": [
          "Unlimited projects",
          "Priority support",
          "50 GB storage",
          "Advanced analytics"
        ],
        "cta": "Start Free Trial",
        "featured": true
      },
      {
        "name": "Enterprise",
        "monthly": 99,
        "annual": 79,
        "description": "For organizations with advanced needs.",
        "features": [
          "Everything In Pro",
          "Dedicated support",
          "Unlimited storage",
          "SSO and audit logs"
        ],
        "cta": "Contact Sales",
        "featured": false
      }
    ]
  },
  "pricing-2": {
    "STARTER_FEATURES": [
      "1 workspace",
      "Up to 3 members",
      "5 GB storage",
      "Community support",
      "Basic analytics"
    ],
    "PRO_FEATURES": [
      "Unlimited workspaces",
      "Up to 50 members",
      "100 GB storage",
      "Priority email support",
      "Advanced analytics",
      "Custom domain",
      "Audit logs"
    ]
  },
  "pricing-3": {
    "PLAN": {
      "name": "Acme Pro",
      "tagline": "Everything you need to ship faster.",
      "monthly": 49,
      "annual": 39,
      "period": "Per Seat / Month",
      "trialNote": "14-day free trial, no credit card required.",
      "features": [
        "Unlimited projects and workspaces",
        "Up to 25 team members",
        "100 GB asset storage",
        "Priority support with 4-hour SLA",
        "Advanced analytics and reports",
        "Custom domain and branding",
        "SSO and role-based access control",
        "Audit logs and compliance exports"
      ],
      "cta": "Start Free Trial"
    }
  },
  "pricing-4": {
    "tiers": [
      {
        "name": "Starter",
        "monthly": 0,
        "annual": 0,
        "description": "For side projects and getting started.",
        "features": [
          "Up to 3 projects",
          "Community support",
          "1 GB storage"
        ],
        "cta": "Get Started",
        "featured": false
      },
      {
        "name": "Pro",
        "monthly": 29,
        "annual": 24,
        "description": "For growing teams that ship every day.",
        "features": [
          "Unlimited projects",
          "Priority support",
          "50 GB storage",
          "Advanced analytics"
        ],
        "cta": "Start Free Trial",
        "featured": true
      },
      {
        "name": "Enterprise",
        "monthly": 99,
        "annual": 82,
        "description": "For organizations with advanced needs.",
        "features": [
          "Everything In Pro",
          "Dedicated support",
          "Unlimited storage",
          "SSO and audit logs"
        ],
        "cta": "Contact Sales",
        "featured": false
      }
    ]
  },
  "pricing-5": {
    "plans": [
      {
        "name": "Starter",
        "price": "$0",
        "note": "Free forever"
      },
      {
        "name": "Pro",
        "price": "$29",
        "note": "Per month",
        "featured": true
      },
      {
        "name": "Enterprise",
        "price": "Custom",
        "note": "Contact us"
      }
    ]
  },
  "profile-1": {
    "stats": [
      {
        "label": "Posts",
        "value": "128"
      },
      {
        "label": "Followers",
        "value": "12.4k"
      },
      {
        "label": "Following",
        "value": "312"
      }
    ],
    "posts": [
      {
        "title": "Designing tokens that scale",
        "excerpt": "How we restructured our design tokens into three tiers and cut theme work to almost nothing.",
        "date": "Jun 14, 2026",
        "likes": 184,
        "comments": 23
      },
      {
        "title": "The case for boring infrastructure",
        "excerpt": "Reliability is a feature. A look at why we chose the least exciting option at every layer.",
        "date": "May 28, 2026",
        "likes": 142,
        "comments": 17
      }
    ]
  },
  "profile-2": {
    "stats": [
      {
        "label": "Projects",
        "value": "48"
      },
      {
        "label": "Followers",
        "value": "2.1k"
      },
      {
        "label": "Rating",
        "value": "4.9"
      }
    ]
  },
  "profile-3": {
    "stats": [
      {
        "label": "Clients",
        "value": "4k"
      },
      {
        "label": "Projects",
        "value": "126"
      },
      {
        "label": "Founded",
        "value": "2019"
      }
    ],
    "team": [
      {
        "name": "Ada",
        "src": "https://i.pravatar.cc/64?img=47"
      },
      {
        "name": "Leo",
        "src": "https://i.pravatar.cc/64?img=12"
      },
      {
        "name": "Mara",
        "src": "https://i.pravatar.cc/64?img=32"
      },
      {
        "name": "Owen",
        "src": "https://i.pravatar.cc/64?img=53"
      }
    ]
  },
  "roadmap-1": {
    "team": {
      "ada": {
        "name": "Ada",
        "src": "https://i.pravatar.cc/64?img=47"
      },
      "leo": {
        "name": "Leo",
        "src": "https://i.pravatar.cc/64?img=12"
      },
      "mara": {
        "name": "Mara",
        "src": "https://i.pravatar.cc/64?img=32"
      },
      "owen": {
        "name": "Owen",
        "src": "https://i.pravatar.cc/64?img=53"
      }
    }
  },
  "roadmap-2": {
    "team": {
      "ada": {
        "name": "Ada",
        "src": "https://i.pravatar.cc/64?img=47"
      },
      "leo": {
        "name": "Leo",
        "src": "https://i.pravatar.cc/64?img=12"
      },
      "mara": {
        "name": "Mara",
        "src": "https://i.pravatar.cc/64?img=32"
      },
      "owen": {
        "name": "Owen",
        "src": "https://i.pravatar.cc/64?img=53"
      }
    }
  },
  "roadmap-3": {
    "team": {
      "ada": {
        "name": "Ada",
        "src": "https://i.pravatar.cc/64?img=47"
      },
      "leo": {
        "name": "Leo",
        "src": "https://i.pravatar.cc/64?img=12"
      },
      "mara": {
        "name": "Mara",
        "src": "https://i.pravatar.cc/64?img=32"
      }
    }
  },
  "roadmap-4": {
    "quarters": [
      {
        "label": "Q1",
        "period": "Jan – Mar",
        "items": [
          {
            "title": "Saved Views",
            "description": "Pin filtered lists to the sidebar and share them.",
            "category": "Core",
            "status": "Shipped"
          },
          {
            "title": "Dark Theme",
            "description": "A full dark palette that follows the system setting.",
            "category": "Design",
            "status": "Shipped"
          }
        ]
      },
      {
        "label": "Q2",
        "period": "Apr – Jun",
        "items": [
          {
            "title": "Audit Log",
            "description": "An exportable record of every workspace action.",
            "category": "Security",
            "status": "Shipped"
          },
          {
            "title": "Team Roles",
            "description": "Granular owner, editor, and viewer permissions.",
            "category": "Core",
            "status": "Shipped"
          }
        ]
      },
      {
        "label": "Q3",
        "period": "Jul – Sep",
        "items": [
          {
            "title": "Public API v2",
            "description": "A faster REST API with typed SDKs and webhooks.",
            "category": "Platform",
            "status": "In Progress"
          },
          {
            "title": "Mobile App",
            "description": "Native iOS and Android apps for on-the-go access.",
            "category": "Apps",
            "status": "In Progress"
          },
          {
            "title": "Slack Integration",
            "description": "Post updates and create items straight from Slack.",
            "category": "Integrations",
            "status": "Planned"
          }
        ]
      },
      {
        "label": "Q4",
        "period": "Oct – Dec",
        "items": [
          {
            "title": "Custom Dashboards",
            "description": "Build your own views from any metric in the workspace.",
            "category": "Analytics",
            "status": "Planned"
          },
          {
            "title": "SSO and SCIM",
            "description": "Enterprise sign-on with automated user provisioning.",
            "category": "Security",
            "status": "Planned"
          }
        ]
      }
    ]
  },
  "search-1": {
    "types": [
      "Docs",
      "Guide",
      "Blog",
      "API"
    ],
    "results": [
      {
        "title": "Design tokens overview",
        "snippet": "Tokens are the single source of truth for color, spacing, and typography across your product.",
        "type": "Docs"
      },
      {
        "title": "Theming with tokens",
        "snippet": "A step-by-step walkthrough of remapping semantic tokens to build a dark theme.",
        "type": "Guide"
      },
      {
        "title": "Designing tokens that scale",
        "snippet": "How we restructured our tokens into three tiers and cut theme work to almost nothing.",
        "type": "Blog"
      },
      {
        "title": "Tokens API reference",
        "snippet": "Read, resolve, and override token values programmatically with the typed tokens client.",
        "type": "API"
      },
      {
        "title": "Migrating to design tokens",
        "snippet": "Adopt tokens incrementally, starting with color and shipping each tier behind review.",
        "type": "Guide"
      }
    ]
  },
  "search-2": {
    "results": [
      {
        "title": "Getting started with Acme",
        "snippet": "Install the CLI, create your first project, and ship a page in under five minutes with copy-paste blocks.",
        "type": "Docs",
        "updated": "Jun 12, 2026"
      },
      {
        "title": "Authentication and sessions",
        "snippet": "Connect a provider, protect your routes, and read the current session on the server or the client.",
        "type": "Guide",
        "updated": "May 30, 2026"
      },
      {
        "title": "Theming and design tokens",
        "snippet": "Every block is theme-aware. Override semantic tokens once and every component updates automatically.",
        "type": "Docs",
        "updated": "Jun 18, 2026"
      },
      {
        "title": "Deploying to production",
        "snippet": "A checklist for going live: environment variables, build caching, and zero-downtime releases.",
        "type": "Guide",
        "updated": "Jun 02, 2026"
      }
    ]
  },
  "search-4": {
    "RECENT": [
      {
        "id": "r1",
        "label": "Billing settings",
        "kind": "recent"
      },
      {
        "id": "r2",
        "label": "Invite teammates",
        "kind": "recent"
      }
    ],
    "SUGGESTIONS": [
      {
        "id": "s1",
        "label": "Getting started guide",
        "kind": "page"
      },
      {
        "id": "s2",
        "label": "API reference",
        "kind": "page"
      },
      {
        "id": "s3",
        "label": "Webhooks",
        "kind": "tag"
      },
      {
        "id": "s4",
        "label": "Two-factor authentication",
        "kind": "page"
      },
      {
        "id": "s5",
        "label": "Export data",
        "kind": "tag"
      },
      {
        "id": "s6",
        "label": "Keyboard shortcuts",
        "kind": "page"
      }
    ]
  },
  "settings-1": {
    "VISIBILITY_OPTIONS": [
      {
        "value": "everyone",
        "label": "Everyone"
      },
      {
        "value": "team",
        "label": "Only my team"
      },
      {
        "value": "private",
        "label": "Just me"
      }
    ],
    "notificationRows": [
      {
        "id": "product-updates",
        "label": "Product updates",
        "description": "News about features and improvements.",
        "on": true
      },
      {
        "id": "weekly-digest",
        "label": "Weekly digest",
        "description": "A summary of your activity every Monday.",
        "on": false
      },
      {
        "id": "mentions",
        "label": "Mentions",
        "description": "Get notified when someone mentions you.",
        "on": true
      }
    ]
  },
  "settings-2": {
    "profile": {
      "name": "Marcus Trent",
      "email": "marcus.trent@acme.com",
      "role": "Product Designer",
      "initials": "MT",
      "avatar": "https://i.pravatar.cc/150?img=13",
      "twoFactor": true
    },
    "TIMEZONES": [
      {
        "value": "pst",
        "label": "Pacific (UTC−8)"
      },
      {
        "value": "est",
        "label": "Eastern (UTC−5)"
      },
      {
        "value": "gmt",
        "label": "London (UTC+0)"
      },
      {
        "value": "cet",
        "label": "Central Europe (UTC+1)"
      },
      {
        "value": "jst",
        "label": "Tokyo (UTC+9)"
      }
    ],
    "DENSITIES": [
      {
        "value": "comfortable",
        "label": "Comfortable"
      },
      {
        "value": "compact",
        "label": "Compact"
      }
    ],
    "NOTIFICATION_PREFS": [
      {
        "id": "email-digest",
        "label": "Weekly email digest"
      },
      {
        "id": "mentions",
        "label": "Mentions and replies"
      },
      {
        "id": "product-news",
        "label": "Product news"
      }
    ]
  },
  "settings-3": {
    "planFeatures": [
      "Unlimited projects",
      "Priority support",
      "Advanced analytics"
    ]
  },
  "sidebar-1": {
    "stats": [
      {
        "label": "Open Tasks",
        "value": "24",
        "delta": "+3",
        "up": true,
        "note": "Vs. Last Week"
      },
      {
        "label": "Deployments",
        "value": "11",
        "delta": "-2",
        "up": false,
        "note": "Vs. Last Week"
      },
      {
        "label": "Team Members",
        "value": "8",
        "delta": "+1",
        "up": true,
        "note": "New This Month"
      },
      {
        "label": "Uptime",
        "value": "99.9%",
        "delta": "+0.1%",
        "up": true,
        "note": "30-Day Average"
      }
    ],
    "recentActivity": [
      {
        "user": "Marcus Holt",
        "initials": "MH",
        "avatar": "https://i.pravatar.cc/150?img=13",
        "action": "Merged pull request",
        "target": "feat/auth-refresh",
        "time": "2 Min Ago",
        "done": true
      },
      {
        "user": "Priya Nair",
        "initials": "PN",
        "avatar": "https://i.pravatar.cc/150?img=45",
        "action": "Opened issue",
        "target": "Dashboard: chart overflow on mobile",
        "time": "14 Min Ago",
        "done": false
      },
      {
        "user": "Leon Fischer",
        "initials": "LF",
        "avatar": "https://i.pravatar.cc/150?img=8",
        "action": "Deployed to production",
        "target": "v2.4.1",
        "time": "1 Hour Ago",
        "done": true
      },
      {
        "user": "Suki Tanaka",
        "initials": "ST",
        "avatar": "https://i.pravatar.cc/150?img=29",
        "action": "Created project",
        "target": "Rebrand: Q3",
        "time": "3 Hours Ago",
        "done": false
      }
    ]
  },
  "sidebar-2": {
    "tasks": [
      {
        "id": "T-104",
        "title": "Migrate auth service to OAuth 2.1",
        "project": "Platform",
        "priority": "high",
        "status": "In Progress",
        "due": "Jun 20"
      },
      {
        "id": "T-108",
        "title": "Write onboarding copy for new users",
        "project": "Marketing",
        "priority": "medium",
        "status": "Review",
        "due": "Jun 22"
      },
      {
        "id": "T-112",
        "title": "Fix pagination bug on reports page",
        "project": "Dashboard",
        "priority": "high",
        "status": "Blocked",
        "due": "Jun 19"
      },
      {
        "id": "T-117",
        "title": "Add CSV export to analytics view",
        "project": "Dashboard",
        "priority": "low",
        "status": "In Progress",
        "due": "Jun 28"
      },
      {
        "id": "T-121",
        "title": "Update API rate-limit documentation",
        "project": "Platform",
        "priority": "low",
        "status": "Done",
        "due": "Jun 15"
      },
      {
        "id": "T-125",
        "title": "Redesign notification preferences UI",
        "project": "Marketing",
        "priority": "medium",
        "status": "Review",
        "due": "Jun 30"
      }
    ],
    "statusVariant": {
      "In Progress": "secondary",
      "Review": "outline",
      "Done": "default",
      "Blocked": "destructive"
    }
  },
  "stats-1": {
    "stats": [
      {
        "value": "12k+",
        "label": "Active customers",
        "delta": "+18%"
      },
      {
        "value": "99.9%",
        "label": "Uptime guarantee",
        "delta": "+0.1%"
      },
      {
        "value": "4.9/5",
        "label": "Average rating",
        "delta": "+0.3"
      },
      {
        "value": "150+",
        "label": "Countries served",
        "delta": "+12"
      }
    ]
  },
  "stats-2": {
    "stats": [
      {
        "value": "$2.4B",
        "label": "Revenue processed"
      },
      {
        "value": "38 ms",
        "label": "Median latency"
      },
      {
        "value": "99.98%",
        "label": "Uptime last 12 mo"
      },
      {
        "value": "6,200+",
        "label": "Businesses onboarded"
      }
    ]
  },
  "stats-5": {
    "stats": [
      {
        "value": "99.99%",
        "label": "Uptime across all regions"
      },
      {
        "value": "12M+",
        "label": "Requests handled every day"
      },
      {
        "value": "180ms",
        "label": "Median global response time"
      },
      {
        "value": "40+",
        "label": "Countries with edge presence"
      }
    ]
  },
  "status-1": {
    "services": [
      {
        "name": "API",
        "status": "operational",
        "uptime": "99.99%"
      },
      {
        "name": "Dashboard",
        "status": "operational",
        "uptime": "99.98%"
      },
      {
        "name": "Webhooks",
        "status": "operational",
        "uptime": "99.95%"
      },
      {
        "name": "CDN",
        "status": "operational",
        "uptime": "100%"
      },
      {
        "name": "Database",
        "status": "operational",
        "uptime": "99.99%"
      }
    ]
  },
  "status-3": {
    "MONTHS": [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ],
    "legend": [
      "operational",
      "degraded",
      "outage"
    ]
  },
  "steps-1": {
    "steps": [
      {
        "label": "Cart",
        "status": "done"
      },
      {
        "label": "Details",
        "status": "done"
      },
      {
        "label": "Payment",
        "status": "current"
      },
      {
        "label": "Review",
        "status": "upcoming"
      }
    ]
  },
  "steps-2": {
    "steps": [
      {
        "title": "Create your account",
        "description": "Sign up with your email and choose a password.",
        "status": "done"
      },
      {
        "title": "Verify your email",
        "description": "Confirm your address from the link we sent you.",
        "status": "done"
      },
      {
        "title": "Set up your workspace",
        "description": "Name your workspace and pick a starting template.",
        "status": "current"
      },
      {
        "title": "Invite your team",
        "description": "Add teammates so you can start collaborating.",
        "status": "upcoming"
      }
    ]
  },
  "steps-3": {
    "steps": [
      {
        "title": "Create Your Account",
        "description": "Set your name, workspace URL, and a password. This is what your team will see when they join."
      },
      {
        "title": "Invite Your Team",
        "description": "Add teammates by email. You can always invite more people later from settings."
      },
      {
        "title": "Connect A Data Source",
        "description": "Link a database or upload a file so we can generate your first dashboard automatically."
      },
      {
        "title": "Review and Launch",
        "description": "Confirm everything looks right, then publish your workspace and start exploring."
      }
    ]
  },
  "table-1": {
    "COLUMN_LABELS": {
      "name": "Member",
      "status": "Status",
      "role": "Role",
      "joined": "Joined"
    },
    "members": [
      {
        "id": "m-01",
        "name": "Ada Lovelace",
        "initials": "AL",
        "avatar": "https://i.pravatar.cc/80?img=47",
        "email": "ada@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-06-12"
      },
      {
        "id": "m-02",
        "name": "Alan Turing",
        "initials": "AT",
        "avatar": "https://i.pravatar.cc/80?img=11",
        "email": "alan@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-06-10"
      },
      {
        "id": "m-03",
        "name": "Grace Hopper",
        "initials": "GH",
        "avatar": "https://i.pravatar.cc/80?img=45",
        "email": "grace@acme.io",
        "status": "Invited",
        "role": "Editor",
        "joined": "2026-06-08"
      },
      {
        "id": "m-04",
        "name": "Linus Pauling",
        "initials": "LP",
        "avatar": "https://i.pravatar.cc/80?img=12",
        "email": "linus@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-05-29"
      },
      {
        "id": "m-05",
        "name": "Katherine Johnson",
        "initials": "KJ",
        "avatar": "https://i.pravatar.cc/80?img=49",
        "email": "katherine@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-05-21"
      },
      {
        "id": "m-06",
        "name": "Edsger Dijkstra",
        "initials": "ED",
        "avatar": "https://i.pravatar.cc/80?img=13",
        "email": "edsger@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-05-18"
      },
      {
        "id": "m-07",
        "name": "Barbara Liskov",
        "initials": "BL",
        "avatar": "https://i.pravatar.cc/80?img=44",
        "email": "barbara@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-05-14"
      },
      {
        "id": "m-08",
        "name": "Tim Berners-Lee",
        "initials": "TB",
        "avatar": "https://i.pravatar.cc/80?img=14",
        "email": "tim@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-05-09"
      },
      {
        "id": "m-09",
        "name": "Margaret Hamilton",
        "initials": "MH",
        "avatar": "https://i.pravatar.cc/80?img=48",
        "email": "margaret@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-05-04"
      },
      {
        "id": "m-10",
        "name": "Donald Knuth",
        "initials": "DK",
        "avatar": "https://i.pravatar.cc/80?img=15",
        "email": "donald@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-04-28"
      },
      {
        "id": "m-11",
        "name": "Radia Perlman",
        "initials": "RP",
        "avatar": "https://i.pravatar.cc/80?img=43",
        "email": "radia@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-04-22"
      },
      {
        "id": "m-12",
        "name": "Ken Thompson",
        "initials": "KT",
        "avatar": "https://i.pravatar.cc/80?img=16",
        "email": "ken@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-04-19"
      },
      {
        "id": "m-13",
        "name": "Hedy Lamarr",
        "initials": "HL",
        "avatar": "https://i.pravatar.cc/80?img=41",
        "email": "hedy@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-04-15"
      },
      {
        "id": "m-14",
        "name": "Dennis Ritchie",
        "initials": "DR",
        "avatar": "https://i.pravatar.cc/80?img=17",
        "email": "dennis@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-04-11"
      },
      {
        "id": "m-15",
        "name": "Shafi Goldwasser",
        "initials": "SG",
        "avatar": "https://i.pravatar.cc/80?img=40",
        "email": "shafi@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-04-07"
      },
      {
        "id": "m-16",
        "name": "John McCarthy",
        "initials": "JM",
        "avatar": "https://i.pravatar.cc/80?img=18",
        "email": "john@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-04-02"
      },
      {
        "id": "m-17",
        "name": "Frances Allen",
        "initials": "FA",
        "avatar": "https://i.pravatar.cc/80?img=39",
        "email": "frances@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-03-29"
      },
      {
        "id": "m-18",
        "name": "Vint Cerf",
        "initials": "VC",
        "avatar": "https://i.pravatar.cc/80?img=19",
        "email": "vint@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-24"
      },
      {
        "id": "m-19",
        "name": "Adele Goldberg",
        "initials": "AG",
        "avatar": "https://i.pravatar.cc/80?img=38",
        "email": "adele@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-03-20"
      },
      {
        "id": "m-20",
        "name": "Bjarne Stroustrup",
        "initials": "BS",
        "avatar": "https://i.pravatar.cc/80?img=20",
        "email": "bjarne@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-16"
      },
      {
        "id": "m-21",
        "name": "Karen Spärck Jones",
        "initials": "KS",
        "avatar": "https://i.pravatar.cc/80?img=36",
        "email": "karen@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-03-11"
      },
      {
        "id": "m-22",
        "name": "Brian Kernighan",
        "initials": "BK",
        "avatar": "https://i.pravatar.cc/80?img=51",
        "email": "brian@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-03-06"
      },
      {
        "id": "m-23",
        "name": "Sophie Wilson",
        "initials": "SW",
        "avatar": "https://i.pravatar.cc/80?img=35",
        "email": "sophie@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-01"
      },
      {
        "id": "m-24",
        "name": "Guido van Rossum",
        "initials": "GR",
        "avatar": "https://i.pravatar.cc/80?img=52",
        "email": "guido@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-02-24"
      },
      {
        "id": "m-25",
        "name": "Lynn Conway",
        "initials": "LC",
        "avatar": "https://i.pravatar.cc/80?img=34",
        "email": "lynn@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-02-19"
      },
      {
        "id": "m-26",
        "name": "Ralph Merkle",
        "initials": "RM",
        "avatar": "https://i.pravatar.cc/80?img=53",
        "email": "ralph@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-02-13"
      },
      {
        "id": "m-27",
        "name": "Carol Shaw",
        "initials": "CS",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "email": "carol@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-02-08"
      },
      {
        "id": "m-28",
        "name": "Niklaus Wirth",
        "initials": "NW",
        "avatar": "https://i.pravatar.cc/80?img=54",
        "email": "niklaus@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-02-02"
      },
      {
        "id": "m-29",
        "name": "Mary Allen Wilkes",
        "initials": "MW",
        "avatar": "https://i.pravatar.cc/80?img=31",
        "email": "mary@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-01-27"
      },
      {
        "id": "m-30",
        "name": "Leslie Lamport",
        "initials": "LL",
        "avatar": "https://i.pravatar.cc/80?img=55",
        "email": "leslie@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-01-21"
      }
    ]
  },
  "table-2": {
    "statusConfig": {
      "Paid": {
        "variant": "default",
        "dot": "bg-primary-foreground"
      },
      "Pending": {
        "variant": "secondary",
        "dot": "bg-muted-foreground"
      },
      "Overdue": {
        "variant": "destructive",
        "dot": "bg-destructive"
      },
      "Refunded": {
        "variant": "outline",
        "dot": "bg-muted-foreground"
      }
    },
    "invoices": [
      {
        "id": "INV-0041",
        "client": "Miriam Okafor",
        "initials": "MO",
        "avatar": "https://i.pravatar.cc/80?img=1",
        "project": "Brand Refresh",
        "amount": 4200,
        "method": "Wire Transfer",
        "due": "2026-06-30",
        "status": "Pending"
      },
      {
        "id": "INV-0040",
        "client": "Theo Hartmann",
        "initials": "TH",
        "avatar": "https://i.pravatar.cc/80?img=12",
        "project": "API Integration",
        "amount": 1850,
        "method": "Credit Card",
        "due": "2026-06-15",
        "status": "Paid"
      },
      {
        "id": "INV-0039",
        "client": "Suki Nakamura",
        "initials": "SN",
        "avatar": "https://i.pravatar.cc/80?img=5",
        "project": "Dashboard UI",
        "amount": 6500,
        "method": "ACH",
        "due": "2026-06-01",
        "status": "Overdue"
      },
      {
        "id": "INV-0038",
        "client": "Elias Ferreira",
        "initials": "EF",
        "avatar": "https://i.pravatar.cc/80?img=3",
        "project": "Mobile App MVP",
        "amount": 9000,
        "method": "Wire Transfer",
        "due": "2026-05-28",
        "status": "Paid"
      },
      {
        "id": "INV-0037",
        "client": "Priya Menon",
        "initials": "PM",
        "avatar": "https://i.pravatar.cc/80?img=9",
        "project": "SEO Audit",
        "amount": 780,
        "method": "Credit Card",
        "due": "2026-05-10",
        "status": "Refunded"
      },
      {
        "id": "INV-0036",
        "client": "Dmitri Volkov",
        "initials": "DV",
        "avatar": "https://i.pravatar.cc/80?img=11",
        "project": "Data Pipeline",
        "amount": 3350,
        "method": "ACH",
        "due": "2026-04-25",
        "status": "Paid"
      },
      {
        "id": "INV-0035",
        "client": "Amara Diallo",
        "initials": "AD",
        "avatar": "https://i.pravatar.cc/80?img=16",
        "project": "Design System",
        "amount": 5400,
        "method": "Wire Transfer",
        "due": "2026-06-22",
        "status": "Pending"
      },
      {
        "id": "INV-0034",
        "client": "Noah Bergström",
        "initials": "NB",
        "avatar": "https://i.pravatar.cc/80?img=14",
        "project": "Marketing Site",
        "amount": 2100,
        "method": "Credit Card",
        "due": "2026-04-18",
        "status": "Paid"
      },
      {
        "id": "INV-0033",
        "client": "Lucia Romano",
        "initials": "LR",
        "avatar": "https://i.pravatar.cc/80?img=20",
        "project": "Onboarding Flow",
        "amount": 3950,
        "method": "ACH",
        "due": "2026-05-31",
        "status": "Overdue"
      },
      {
        "id": "INV-0032",
        "client": "Kwame Mensah",
        "initials": "KM",
        "avatar": "https://i.pravatar.cc/80?img=15",
        "project": "Analytics Setup",
        "amount": 1280,
        "method": "Credit Card",
        "due": "2026-04-09",
        "status": "Paid"
      },
      {
        "id": "INV-0031",
        "client": "Ingrid Larsen",
        "initials": "IL",
        "avatar": "https://i.pravatar.cc/80?img=24",
        "project": "Accessibility Pass",
        "amount": 2650,
        "method": "Wire Transfer",
        "due": "2026-06-12",
        "status": "Pending"
      },
      {
        "id": "INV-0030",
        "client": "Mateo Castillo",
        "initials": "MC",
        "avatar": "https://i.pravatar.cc/80?img=33",
        "project": "Checkout Rebuild",
        "amount": 7300,
        "method": "ACH",
        "due": "2026-03-30",
        "status": "Refunded"
      },
      {
        "id": "INV-0029",
        "client": "Yuki Tanaka",
        "initials": "YT",
        "avatar": "https://i.pravatar.cc/80?img=26",
        "project": "Email Templates",
        "amount": 940,
        "method": "Credit Card",
        "due": "2026-03-22",
        "status": "Paid"
      },
      {
        "id": "INV-0028",
        "client": "Fatima Zahra",
        "initials": "FZ",
        "avatar": "https://i.pravatar.cc/80?img=44",
        "project": "Localization",
        "amount": 4880,
        "method": "Wire Transfer",
        "due": "2026-05-19",
        "status": "Overdue"
      },
      {
        "id": "INV-0027",
        "client": "Oscar Lindqvist",
        "initials": "OL",
        "avatar": "https://i.pravatar.cc/80?img=51",
        "project": "CMS Migration",
        "amount": 6150,
        "method": "ACH",
        "due": "2026-06-05",
        "status": "Pending"
      },
      {
        "id": "INV-0026",
        "client": "Hana Novak",
        "initials": "HN",
        "avatar": "https://i.pravatar.cc/80?img=45",
        "project": "Component Audit",
        "amount": 1720,
        "method": "Credit Card",
        "due": "2026-03-14",
        "status": "Paid"
      },
      {
        "id": "INV-0025",
        "client": "Bilal Haddad",
        "initials": "BH",
        "avatar": "https://i.pravatar.cc/80?img=59",
        "project": "Search Revamp",
        "amount": 5230,
        "method": "Wire Transfer",
        "due": "2026-05-02",
        "status": "Overdue"
      },
      {
        "id": "INV-0024",
        "client": "Sienna Walsh",
        "initials": "SW",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "project": "Pricing Page",
        "amount": 1360,
        "method": "Credit Card",
        "due": "2026-02-26",
        "status": "Paid"
      }
    ]
  },
  "table-3": {
    "lineItems": [
      {
        "description": "Brand identity design",
        "category": "Design",
        "qty": 1,
        "unit": "project",
        "unitPrice": 3200
      },
      {
        "description": "UI component library",
        "category": "Development",
        "qty": 1,
        "unit": "project",
        "unitPrice": 5800
      },
      {
        "description": "Content strategy workshop",
        "category": "Consulting",
        "qty": 3,
        "unit": "session",
        "unitPrice": 450
      },
      {
        "description": "Copywriting: landing pages",
        "category": "Content",
        "qty": 5,
        "unit": "page",
        "unitPrice": 280
      },
      {
        "description": "QA & usability testing",
        "category": "Development",
        "qty": 8,
        "unit": "hour",
        "unitPrice": 95
      },
      {
        "description": "Project management",
        "category": "Consulting",
        "qty": 12,
        "unit": "hour",
        "unitPrice": 75
      }
    ]
  },
  "team-1": {
    "members": [
      {
        "name": "Clara Hoffmann",
        "role": "Co-founder & CEO",
        "avatar": "https://i.pravatar.cc/150?img=5",
        "bio": "Shapes strategy and culture. Previously founded two B2B SaaS companies and led growth at Stripe.",
        "social": {
          "linkedin": "#",
          "twitter": "#",
          "github": null
        }
      },
      {
        "name": "Marcus Tran",
        "role": "Co-founder & CTO",
        "avatar": "https://i.pravatar.cc/150?img=12",
        "bio": "Architect behind the platform. Open-source contributor with a decade of distributed-systems experience.",
        "social": {
          "linkedin": "#",
          "twitter": "#",
          "github": "#"
        }
      },
      {
        "name": "Amara Osei",
        "role": "Head of Design",
        "avatar": "https://i.pravatar.cc/150?img=49",
        "bio": "Crafts interfaces that feel inevitable. Former principal designer at Figma and Linear.",
        "social": {
          "linkedin": "#",
          "twitter": "#",
          "github": null
        }
      },
      {
        "name": "Lena Kovač",
        "role": "VP of Engineering",
        "avatar": "https://i.pravatar.cc/150?img=24",
        "bio": "Scales teams and codebases with equal care. Led engineering at three Series B startups.",
        "social": {
          "linkedin": "#",
          "twitter": null,
          "github": "#"
        }
      },
      {
        "name": "Daniel Reyes",
        "role": "Head of Product",
        "avatar": "https://i.pravatar.cc/150?img=33",
        "bio": "Turns customer problems into elegant solutions. Background in product management at Notion and Vercel.",
        "social": {
          "linkedin": "#",
          "twitter": "#",
          "github": null
        }
      },
      {
        "name": "Yuna Park",
        "role": "Head of Marketing",
        "avatar": "https://i.pravatar.cc/150?img=44",
        "bio": "Builds brand from zero to recognizable. Previously ran marketing at Loom through their acquisition by Atlassian.",
        "social": {
          "linkedin": "#",
          "twitter": "#",
          "github": null
        }
      }
    ]
  },
  "team-2": {
    "members": [
      {
        "name": "Clara Hoffmann",
        "role": "Chief Executive Officer",
        "department": "Leadership",
        "bio": "20 years scaling enterprise software from seed to IPO across three continents.",
        "avatar": "https://i.pravatar.cc/300?u=clara-h"
      },
      {
        "name": "Marcus Tran",
        "role": "Chief Technology Officer",
        "department": "Engineering",
        "bio": "Former Staff Engineer at Google. Obsessed with distributed systems and developer experience.",
        "avatar": "https://i.pravatar.cc/300?u=marcus-t"
      },
      {
        "name": "Amara Osei",
        "role": "Head of Design",
        "department": "Design",
        "bio": "Crafts interfaces that win awards and convert users, rarely a coincidence.",
        "avatar": "https://i.pravatar.cc/300?u=amara-o"
      },
      {
        "name": "Lena Kovač",
        "role": "VP of Engineering",
        "department": "Engineering",
        "bio": "Led platform migrations at Stripe and Figma. Turns technical debt into roadmap wins.",
        "avatar": "https://i.pravatar.cc/300?u=lena-k"
      },
      {
        "name": "Daniel Reyes",
        "role": "Head of Product",
        "department": "Product",
        "bio": "Zero-to-one product thinker. Launched features now used by 4 million people.",
        "avatar": "https://i.pravatar.cc/300?u=daniel-r"
      },
      {
        "name": "Sophie Laurent",
        "role": "Head of Marketing",
        "department": "Marketing",
        "bio": "Turned brand storytelling into a growth engine, twice, at companies you know.",
        "avatar": "https://i.pravatar.cc/300?u=sophie-l"
      }
    ]
  },
  "team-3": {
    "members": [
      {
        "name": "Clara Hoffmann",
        "role": "Chief Executive Officer",
        "bio": "Scaled three enterprise platforms from seed to IPO. Leads with clarity and an obsession for customer impact.",
        "img": "https://i.pravatar.cc/150?img=5"
      },
      {
        "name": "Marcus Tran",
        "role": "Chief Technology Officer",
        "bio": "Former staff engineer at Google. Builds resilient distributed systems and the teams that maintain them.",
        "img": "https://i.pravatar.cc/150?img=12"
      },
      {
        "name": "Amara Osei",
        "role": "Head of Design",
        "bio": "Crafts interfaces that win awards and convert users. Believes great design is invisible until it's gone.",
        "img": "https://i.pravatar.cc/150?img=20"
      },
      {
        "name": "Lena Kovac",
        "role": "VP of Engineering",
        "bio": "Led platform migrations at Stripe and Figma. Turns technical debt into roadmap wins quarter after quarter.",
        "img": "https://i.pravatar.cc/150?img=32"
      },
      {
        "name": "Daniel Reyes",
        "role": "Head of Product",
        "bio": "Zero-to-one product thinker. Shipped features now used by over four million people across the globe.",
        "img": "https://i.pravatar.cc/150?img=14"
      },
      {
        "name": "Sophie Laurent",
        "role": "Head of Marketing",
        "bio": "Turned brand storytelling into a growth engine twice, at companies you already know and trust.",
        "img": "https://i.pravatar.cc/150?img=45"
      },
      {
        "name": "Yuki Tanaka",
        "role": "Head of Data",
        "bio": "Built the analytics backbone powering every decision. Makes numbers tell stories executives act on.",
        "img": "https://i.pravatar.cc/150?img=60"
      },
      {
        "name": "Noah Bennett",
        "role": "Head of Operations",
        "bio": "Keeps the company running like clockwork. Scaled support and finance through three hypergrowth phases.",
        "img": "https://i.pravatar.cc/150?img=68"
      }
    ]
  },
  "dashboard/charts": {
    "ranges": [
      {
        "key": "7d",
        "label": "7 Days"
      },
      {
        "key": "30d",
        "label": "30 Days"
      },
      {
        "key": "90d",
        "label": "90 Days"
      }
    ],
    "chartConfig": {
      "visitors": {
        "label": "Visitors",
        "color": "var(--primary)"
      },
      "signups": {
        "label": "Signups",
        "color": "var(--muted-foreground)"
      }
    },
    "series": [
      {
        "key": "visitors",
        "label": "Visitors"
      },
      {
        "key": "signups",
        "label": "Signups"
      }
    ]
  },
  "dashboard/dashboard": {
    "RANGES": [
      {
        "value": "7d",
        "label": "Last 7 Days"
      },
      {
        "value": "30d",
        "label": "Last 30 Days"
      },
      {
        "value": "90d",
        "label": "Last 90 Days"
      },
      {
        "value": "12m",
        "label": "Last 12 Months"
      }
    ],
    "STATS_BY_RANGE": {
      "7d": [
        {
          "label": "Revenue",
          "value": "$11.4k",
          "delta": "+3.1%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "2,140",
          "delta": "+1.2%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.31%",
          "delta": "+0.2%",
          "up": true
        },
        {
          "label": "Avg. Session",
          "value": "4m 02s",
          "delta": "-0.4%",
          "up": false
        }
      ],
      "30d": [
        {
          "label": "Revenue",
          "value": "$48.2k",
          "delta": "+12.5%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "8,941",
          "delta": "+4.3%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.24%",
          "delta": "-0.8%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 12s",
          "delta": "+1.1%",
          "up": true
        }
      ],
      "90d": [
        {
          "label": "Revenue",
          "value": "$142.7k",
          "delta": "+9.8%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "26,304",
          "delta": "+7.6%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.18%",
          "delta": "-1.4%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 26s",
          "delta": "+2.3%",
          "up": true
        }
      ],
      "12m": [
        {
          "label": "Revenue",
          "value": "$571.0k",
          "delta": "+22.1%",
          "up": true
        },
        {
          "label": "Active Users",
          "value": "98,612",
          "delta": "+18.4%",
          "up": true
        },
        {
          "label": "Conversion",
          "value": "3.02%",
          "delta": "-2.9%",
          "up": false
        },
        {
          "label": "Avg. Session",
          "value": "4m 41s",
          "delta": "+5.0%",
          "up": true
        }
      ]
    },
    "chartData": [
      {
        "month": "Jan",
        "sessions": 1840
      },
      {
        "month": "Feb",
        "sessions": 2120
      },
      {
        "month": "Mar",
        "sessions": 1760
      },
      {
        "month": "Apr",
        "sessions": 2580
      },
      {
        "month": "May",
        "sessions": 2340
      },
      {
        "month": "Jun",
        "sessions": 3120
      },
      {
        "month": "Jul",
        "sessions": 2210
      },
      {
        "month": "Aug",
        "sessions": 2860
      },
      {
        "month": "Sep",
        "sessions": 2480
      },
      {
        "month": "Oct",
        "sessions": 3340
      },
      {
        "month": "Nov",
        "sessions": 2720
      },
      {
        "month": "Dec",
        "sessions": 3010
      }
    ],
    "chartConfig": {
      "sessions": {
        "label": "Sessions",
        "color": "var(--primary)"
      }
    }
  },
  "dashboard/table": {
    "COLUMN_LABELS": {
      "name": "Member",
      "status": "Status",
      "role": "Role",
      "joined": "Joined"
    },
    "members": [
      {
        "id": "m-01",
        "name": "Ada Lovelace",
        "initials": "AL",
        "avatar": "https://i.pravatar.cc/80?img=47",
        "email": "ada@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-06-12"
      },
      {
        "id": "m-02",
        "name": "Alan Turing",
        "initials": "AT",
        "avatar": "https://i.pravatar.cc/80?img=11",
        "email": "alan@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-06-10"
      },
      {
        "id": "m-03",
        "name": "Grace Hopper",
        "initials": "GH",
        "avatar": "https://i.pravatar.cc/80?img=45",
        "email": "grace@acme.io",
        "status": "Invited",
        "role": "Editor",
        "joined": "2026-06-08"
      },
      {
        "id": "m-04",
        "name": "Linus Pauling",
        "initials": "LP",
        "avatar": "https://i.pravatar.cc/80?img=12",
        "email": "linus@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-05-29"
      },
      {
        "id": "m-05",
        "name": "Katherine Johnson",
        "initials": "KJ",
        "avatar": "https://i.pravatar.cc/80?img=49",
        "email": "katherine@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-05-21"
      },
      {
        "id": "m-06",
        "name": "Edsger Dijkstra",
        "initials": "ED",
        "avatar": "https://i.pravatar.cc/80?img=13",
        "email": "edsger@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-05-18"
      },
      {
        "id": "m-07",
        "name": "Barbara Liskov",
        "initials": "BL",
        "avatar": "https://i.pravatar.cc/80?img=44",
        "email": "barbara@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-05-14"
      },
      {
        "id": "m-08",
        "name": "Tim Berners-Lee",
        "initials": "TB",
        "avatar": "https://i.pravatar.cc/80?img=14",
        "email": "tim@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-05-09"
      },
      {
        "id": "m-09",
        "name": "Margaret Hamilton",
        "initials": "MH",
        "avatar": "https://i.pravatar.cc/80?img=48",
        "email": "margaret@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-05-04"
      },
      {
        "id": "m-10",
        "name": "Donald Knuth",
        "initials": "DK",
        "avatar": "https://i.pravatar.cc/80?img=15",
        "email": "donald@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-04-28"
      },
      {
        "id": "m-11",
        "name": "Radia Perlman",
        "initials": "RP",
        "avatar": "https://i.pravatar.cc/80?img=43",
        "email": "radia@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-04-22"
      },
      {
        "id": "m-12",
        "name": "Ken Thompson",
        "initials": "KT",
        "avatar": "https://i.pravatar.cc/80?img=16",
        "email": "ken@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-04-19"
      },
      {
        "id": "m-13",
        "name": "Hedy Lamarr",
        "initials": "HL",
        "avatar": "https://i.pravatar.cc/80?img=41",
        "email": "hedy@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-04-15"
      },
      {
        "id": "m-14",
        "name": "Dennis Ritchie",
        "initials": "DR",
        "avatar": "https://i.pravatar.cc/80?img=17",
        "email": "dennis@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-04-11"
      },
      {
        "id": "m-15",
        "name": "Shafi Goldwasser",
        "initials": "SG",
        "avatar": "https://i.pravatar.cc/80?img=40",
        "email": "shafi@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-04-07"
      },
      {
        "id": "m-16",
        "name": "John McCarthy",
        "initials": "JM",
        "avatar": "https://i.pravatar.cc/80?img=18",
        "email": "john@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-04-02"
      },
      {
        "id": "m-17",
        "name": "Frances Allen",
        "initials": "FA",
        "avatar": "https://i.pravatar.cc/80?img=39",
        "email": "frances@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-03-29"
      },
      {
        "id": "m-18",
        "name": "Vint Cerf",
        "initials": "VC",
        "avatar": "https://i.pravatar.cc/80?img=19",
        "email": "vint@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-24"
      },
      {
        "id": "m-19",
        "name": "Adele Goldberg",
        "initials": "AG",
        "avatar": "https://i.pravatar.cc/80?img=38",
        "email": "adele@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-03-20"
      },
      {
        "id": "m-20",
        "name": "Bjarne Stroustrup",
        "initials": "BS",
        "avatar": "https://i.pravatar.cc/80?img=20",
        "email": "bjarne@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-16"
      },
      {
        "id": "m-21",
        "name": "Karen Spärck Jones",
        "initials": "KS",
        "avatar": "https://i.pravatar.cc/80?img=36",
        "email": "karen@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-03-11"
      },
      {
        "id": "m-22",
        "name": "Brian Kernighan",
        "initials": "BK",
        "avatar": "https://i.pravatar.cc/80?img=51",
        "email": "brian@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-03-06"
      },
      {
        "id": "m-23",
        "name": "Sophie Wilson",
        "initials": "SW",
        "avatar": "https://i.pravatar.cc/80?img=35",
        "email": "sophie@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-03-01"
      },
      {
        "id": "m-24",
        "name": "Guido van Rossum",
        "initials": "GR",
        "avatar": "https://i.pravatar.cc/80?img=52",
        "email": "guido@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-02-24"
      },
      {
        "id": "m-25",
        "name": "Lynn Conway",
        "initials": "LC",
        "avatar": "https://i.pravatar.cc/80?img=34",
        "email": "lynn@acme.io",
        "status": "Invited",
        "role": "Viewer",
        "joined": "2026-02-19"
      },
      {
        "id": "m-26",
        "name": "Ralph Merkle",
        "initials": "RM",
        "avatar": "https://i.pravatar.cc/80?img=53",
        "email": "ralph@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-02-13"
      },
      {
        "id": "m-27",
        "name": "Carol Shaw",
        "initials": "CS",
        "avatar": "https://i.pravatar.cc/80?img=32",
        "email": "carol@acme.io",
        "status": "Active",
        "role": "Viewer",
        "joined": "2026-02-08"
      },
      {
        "id": "m-28",
        "name": "Niklaus Wirth",
        "initials": "NW",
        "avatar": "https://i.pravatar.cc/80?img=54",
        "email": "niklaus@acme.io",
        "status": "Inactive",
        "role": "Viewer",
        "joined": "2026-02-02"
      },
      {
        "id": "m-29",
        "name": "Mary Allen Wilkes",
        "initials": "MW",
        "avatar": "https://i.pravatar.cc/80?img=31",
        "email": "mary@acme.io",
        "status": "Active",
        "role": "Admin",
        "joined": "2026-01-27"
      },
      {
        "id": "m-30",
        "name": "Leslie Lamport",
        "initials": "LL",
        "avatar": "https://i.pravatar.cc/80?img=55",
        "email": "leslie@acme.io",
        "status": "Active",
        "role": "Editor",
        "joined": "2026-01-21"
      }
    ]
  },
  "saas-landing/faqs": {
    "faqs": [
      {
        "q": "How do I get started with Acme?",
        "a": "Sign up for a free account, create your first workspace, and follow the onboarding checklist. You will be up and running in under five minutes."
      },
      {
        "q": "Can I use Acme for multiple projects?",
        "a": "Yes. Every account supports unlimited projects. You can organise them into separate workspaces and control access permissions per workspace."
      },
      {
        "q": "What payment methods do you accept?",
        "a": "We accept all major credit and debit cards as well as ACH bank transfers for annual plans. Invoiced billing is available for Enterprise customers."
      },
      {
        "q": "How do I cancel my subscription?",
        "a": "You can cancel at any time from Billing in your account settings. Your plan remains active until the end of the current billing period and will not renew."
      },
      {
        "q": "Is my data portable?",
        "a": "Absolutely. You can export all your data as JSON or CSV from the Settings page at any time, with no restrictions or exit fees."
      },
      {
        "q": "Do you offer discounts for non-profits?",
        "a": "We offer a 40% discount for verified non-profit organisations. Reach out to our team with your registration documents to apply."
      }
    ]
  },
  "saas-landing/footer": {
    "columns": [
      {
        "title": "Product",
        "links": [
          "Features",
          "Integrations",
          "Pricing",
          "Changelog",
          "Roadmap"
        ]
      },
      {
        "title": "Company",
        "links": [
          "About",
          "Careers",
          "Blog",
          "Press",
          "Contact"
        ]
      },
      {
        "title": "Resources",
        "links": [
          "Documentation",
          "Guides",
          "Help Center",
          "API Status",
          "Community"
        ]
      },
      {
        "title": "Legal",
        "links": [
          "Privacy",
          "Terms",
          "Security",
          "Cookies",
          "Licenses"
        ]
      }
    ],
    "locales": [
      {
        "code": "en",
        "label": "English"
      },
      {
        "code": "es",
        "label": "Español"
      },
      {
        "code": "de",
        "label": "Deutsch"
      },
      {
        "code": "fr",
        "label": "Français"
      },
      {
        "code": "ja",
        "label": "日本語"
      }
    ]
  },
  "saas-landing/header": {
    "navLinks": [
      {
        "label": "Product",
        "href": "#"
      },
      {
        "label": "Solutions",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Resources",
        "href": "#"
      }
    ]
  },
  "saas-landing/hero": {
    "TRUST_ITEMS": [
      "No credit card required",
      "14-day free trial",
      "Cancel anytime"
    ],
    "SCREENSHOT_ROWS": [
      {
        "label": "Revenue",
        "value": "$48,290",
        "change": "+12.4%"
      },
      {
        "label": "Users",
        "value": "3,841",
        "change": "+8.1%"
      },
      {
        "label": "Churn",
        "value": "1.7%",
        "change": "-0.3%"
      },
      {
        "label": "Session",
        "value": "4m 22s",
        "change": "+0.9%"
      }
    ],
    "TOP_CHANNELS": [
      {
        "name": "Organic search",
        "pct": 74,
        "sessions": "2,841"
      },
      {
        "name": "Direct",
        "pct": 53,
        "sessions": "2,032"
      },
      {
        "name": "Referral",
        "pct": 31,
        "sessions": "1,190"
      }
    ]
  },
  "saas-landing/pricing": {
    "tiers": [
      {
        "name": "Starter",
        "monthly": 0,
        "annual": 0,
        "description": "For side projects and getting started.",
        "features": [
          "Up to 3 projects",
          "Community support",
          "1 GB storage"
        ],
        "cta": "Get Started",
        "featured": false
      },
      {
        "name": "Pro",
        "monthly": 29,
        "annual": 24,
        "description": "For growing teams that ship every day.",
        "features": [
          "Unlimited projects",
          "Priority support",
          "50 GB storage",
          "Advanced analytics"
        ],
        "cta": "Start Free Trial",
        "featured": true
      },
      {
        "name": "Enterprise",
        "monthly": 99,
        "annual": 82,
        "description": "For organizations with advanced needs.",
        "features": [
          "Everything in Pro",
          "Dedicated support",
          "Unlimited storage",
          "SSO and audit logs"
        ],
        "cta": "Contact Sales",
        "featured": false
      }
    ]
  },
  "saas-landing/testimonials": {
    "testimonials": [
      {
        "quote": "We shipped a polished marketing site in a single afternoon. The blocks dropped in cleanly and looked right in both light and dark themes, exactly what our team needed without a single tweak.",
        "name": "Maya Chen",
        "role": "Founder",
        "company": "Northwind",
        "avatar": "https://i.pravatar.cc/150?img=47",
        "rating": 5
      },
      {
        "quote": "Accessible, sharp, and zero config. Our engineers stopped reinventing layouts and started shipping features again within days of adopting Acme. Onboarding went from weeks to a single morning.",
        "name": "Priya Nair",
        "role": "Engineering Manager",
        "company": "Vela",
        "avatar": "https://i.pravatar.cc/150?img=32",
        "rating": 5
      },
      {
        "quote": "Adopting Acme cut our component backlog in half by the end of the first sprint.",
        "name": "Tomás Herrera",
        "role": "Frontend Lead",
        "company": "Cobalt",
        "avatar": "https://i.pravatar.cc/150?img=13",
        "rating": 4
      },
      {
        "quote": "I expected to fight the defaults. Instead everything just composed: spacing, typography, focus states. It feels like it was designed by someone who actually ships product.",
        "name": "Sofia Lindqvist",
        "role": "Product Designer",
        "company": "Fernweh",
        "avatar": "https://i.pravatar.cc/150?img=45",
        "rating": 5
      },
      {
        "quote": "Our agency standardized on Acme across six client projects. Handoffs are clean and reviews are faster.",
        "name": "Marcus Bell",
        "role": "Creative Director",
        "company": "Studio Atlas",
        "avatar": "https://i.pravatar.cc/150?img=8",
        "rating": 5
      },
      {
        "quote": "The dark mode story alone paid for itself. No more one-off overrides scattered through the codebase, and our QA pass on theming dropped to almost nothing.",
        "name": "Aisha Rahman",
        "role": "Staff Engineer",
        "company": "Quanta",
        "avatar": "https://i.pravatar.cc/150?img=26",
        "rating": 5
      }
    ]
  },
  "saas-landing-2/comparison": {
    "acmePoints": [
      "Onboarding completed in under 10 minutes",
      "Real-time sync across all devices and team members",
      "Granular role-based access control included",
      "99.99 % uptime SLA with status page",
      "Dedicated Slack channel for Pro customers",
      "SOC 2 Type II certified infrastructure",
      "One-click data export in any format",
      "No per-seat fees, unlimited collaborators"
    ],
    "othersPoints": [
      "Complex setup requires engineering resources",
      "Sync delays of up to 15 minutes on free tiers",
      "Permissions locked behind enterprise plan",
      "SLA only available on custom contracts",
      "Email-only support with 48 h response time",
      "Compliance docs behind sales call",
      "Data export limited to CSV on lower plans",
      "Per-seat pricing adds up fast at scale"
    ]
  },
  "saas-landing-2/faqs": {
    "faqs": [
      {
        "q": "How do I install a block from the registry?",
        "a": "Copy the install command from any block page and run it with the shadcn CLI. The block, its dependencies, and required primitives are added straight to your project."
      },
      {
        "q": "Do the blocks work with my existing theme?",
        "a": "Yes. Every block is built on shadcn theme tokens, so it inherits your colors, radius, and typography automatically and renders correctly in both light and dark mode."
      },
      {
        "q": "Can I customize a block after installing it?",
        "a": "Absolutely. Blocks are copied directly into your codebase as plain, editable source, so you own the code and can change markup, styles, and logic however you like."
      },
      {
        "q": "What is the difference between free and Pro blocks?",
        "a": "Free blocks are open and installable by anyone. Pro blocks unlock advanced layouts, dashboards, and full-page templates, served through your authenticated Acme account."
      },
      {
        "q": "Will updates to a block overwrite my changes?",
        "a": "No. Because blocks live in your repository, reinstalling a newer version is opt-in. You decide when to pull updates and how to merge them with your edits."
      },
      {
        "q": "Which frameworks are supported?",
        "a": "Blocks target React 19 and Next.js with the App Router, styled using Tailwind CSS. Most are framework-agnostic enough to drop into any modern React setup."
      }
    ]
  },
  "saas-landing-2/footer": {
    "columns": [
      {
        "title": "Product",
        "links": [
          "Blocks",
          "Templates",
          "Pricing",
          "Changelog"
        ]
      },
      {
        "title": "Resources",
        "links": [
          "Docs",
          "Guides",
          "Support",
          "API"
        ]
      },
      {
        "title": "Company",
        "links": [
          "About",
          "Blog",
          "Careers",
          "Contact"
        ]
      }
    ]
  },
  "saas-landing-2/gallery": {
    "screens": [
      {
        "id": 1,
        "label": "Acme Dashboard: Overview",
        "url": "app.acme.io/dashboard",
        "version": "v2.4",
        "description": "A unified command center for monitoring pipeline health, active deployments, and real-time system metrics across all environments.",
        "src": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        "alt": "Acme dashboard overview showing pipeline metrics"
      },
      {
        "id": 2,
        "label": "Analytics",
        "url": "app.acme.io/analytics",
        "description": "Deep-dive into usage trends, funnel conversion, and retention cohorts.",
        "src": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=75",
        "alt": "Analytics charts and metrics"
      },
      {
        "id": 3,
        "label": "Deployments",
        "url": "app.acme.io/deployments",
        "description": "Track every release: status, rollback controls, and canary traffic splits.",
        "src": "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=75",
        "alt": "Deployment pipeline and release status"
      },
      {
        "id": 4,
        "label": "Team Settings",
        "url": "app.acme.io/team",
        "description": "Manage members, roles, SSO configuration, and access policies.",
        "src": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=75",
        "alt": "Team settings and member management"
      },
      {
        "id": 5,
        "label": "Audit Logs",
        "url": "app.acme.io/audit",
        "description": "Immutable event history with filtering, export, and alert rules.",
        "src": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=75",
        "alt": "Audit log event timeline"
      },
      {
        "id": 6,
        "label": "API Keys",
        "url": "app.acme.io/api-keys",
        "description": "Generate, rotate, and scope API credentials with fine-grained permissions.",
        "src": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=75",
        "alt": "API key management interface"
      }
    ]
  },
  "saas-landing-2/header": {
    "navLinks": [
      {
        "label": "Products",
        "href": "#"
      },
      {
        "label": "Solutions",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Docs",
        "href": "#"
      },
      {
        "label": "Blog",
        "href": "#"
      }
    ]
  },
  "saas-landing-2/hero": {
    "avatars": [
      {
        "src": "https://i.pravatar.cc/80?img=45",
        "name": "Elena",
        "initials": "E"
      },
      {
        "src": "https://i.pravatar.cc/80?img=13",
        "name": "Marcus",
        "initials": "M"
      },
      {
        "src": "https://i.pravatar.cc/80?img=32",
        "name": "Priya",
        "initials": "P"
      },
      {
        "src": "https://i.pravatar.cc/80?img=52",
        "name": "Tomás",
        "initials": "T"
      },
      {
        "src": "https://i.pravatar.cc/80?img=27",
        "name": "Hannah",
        "initials": "H"
      }
    ]
  },
  "saas-landing-2/pricing": {
    "STARTER_FEATURES": [
      "1 workspace",
      "Up to 3 members",
      "5 GB storage",
      "Community support",
      "Basic analytics"
    ],
    "PRO_FEATURES": [
      "Unlimited workspaces",
      "Up to 50 members",
      "100 GB storage",
      "Priority email support",
      "Advanced analytics",
      "Custom domain",
      "Audit logs"
    ]
  },
  "saas-landing-2/stats": {
    "stats": [
      {
        "value": "99.99%",
        "label": "Uptime across all regions"
      },
      {
        "value": "12M+",
        "label": "Requests handled every day"
      },
      {
        "value": "180ms",
        "label": "Median global response time"
      },
      {
        "value": "40+",
        "label": "Countries with edge presence"
      }
    ]
  },
  "saas-landing-2/testimonials": {
    "testimonial": {
      "quote": "Acme's platform compressed what used to be a six-week integration cycle down to a single sprint. Our engineers finally have breathing room to work on things that matter, and our customers felt the difference immediately.",
      "name": "Isabelle Fontaine",
      "role": "Chief Product Officer",
      "company": "Meridian Labs",
      "initials": "IF",
      "avatar": "https://i.pravatar.cc/150?img=45"
    },
    "metrics": [
      {
        "value": "6×",
        "label": "faster integrations"
      },
      {
        "value": "40%",
        "label": "less engineer toil"
      },
      {
        "value": "1 sprint",
        "label": "to full deployment"
      }
    ]
  },
  "startup/footer": {
    "NAV_LINKS": [
      {
        "label": "Product",
        "href": "#"
      },
      {
        "label": "Pricing",
        "href": "#"
      },
      {
        "label": "Docs",
        "href": "#"
      },
      {
        "label": "Blog",
        "href": "#"
      },
      {
        "label": "Privacy",
        "href": "#"
      },
      {
        "label": "Terms",
        "href": "#"
      }
    ]
  },
  "startup/header": {
    "navLinks": [
      "Blocks",
      "Docs",
      "Pricing",
      "Changelog"
    ]
  },
  "startup/stats": {
    "stats": [
      {
        "value": "$2.4B",
        "label": "Revenue processed"
      },
      {
        "value": "38 ms",
        "label": "Median latency"
      },
      {
        "value": "99.98%",
        "label": "Uptime last 12 mo"
      },
      {
        "value": "6,200+",
        "label": "Businesses onboarded"
      }
    ]
  },
  "startup/testimonials": {
    "testimonial": {
      "quote": "Acme's platform compressed what used to be a six-week integration cycle down to a single sprint. Our engineers finally have breathing room to work on things that matter, and our customers felt the difference immediately.",
      "name": "Isabelle Fontaine",
      "role": "Chief Product Officer",
      "company": "Meridian Labs",
      "initials": "IF",
      "avatar": "https://i.pravatar.cc/150?img=45"
    },
    "metrics": [
      {
        "value": "6×",
        "label": "faster integrations"
      },
      {
        "value": "40%",
        "label": "less engineer toil"
      },
      {
        "value": "1 sprint",
        "label": "to full deployment"
      }
    ]
  },
  "testimonials-1": {
    "testimonials": [
      {
        "quote": "We shipped a polished marketing site in a single afternoon. The blocks dropped in cleanly and looked right in both themes, exactly what our team needed.",
        "name": "Maya Chen",
        "role": "Founder",
        "company": "Northwind",
        "avatar": "https://i.pravatar.cc/150?img=47"
      },
      {
        "quote": "The consistency is what sold us. Every section feels like it belongs together, so our product looks intentional everywhere we deploy it.",
        "name": "Daniel Okafor",
        "role": "Design Lead",
        "company": "Loopline",
        "avatar": "https://i.pravatar.cc/150?img=12"
      },
      {
        "quote": "Accessible, sharp, and zero config. Our engineers stopped reinventing layouts and started shipping features again within days of adopting it.",
        "name": "Priya Nair",
        "role": "Engineering Manager",
        "company": "Vela",
        "avatar": "https://i.pravatar.cc/150?img=32"
      }
    ]
  },
  "testimonials-2": {
    "testimonial": {
      "quote": "Acme's platform compressed what used to be a six-week integration cycle down to a single sprint. Our engineers finally have breathing room to work on things that matter, and our customers felt the difference immediately.",
      "name": "Isabelle Fontaine",
      "role": "Chief Product Officer",
      "company": "Meridian Labs",
      "initials": "IF",
      "avatar": "https://i.pravatar.cc/150?img=45"
    },
    "metrics": [
      {
        "value": "6×",
        "label": "faster integrations"
      },
      {
        "value": "40%",
        "label": "less engineer toil"
      },
      {
        "value": "1 sprint",
        "label": "to full deployment"
      }
    ]
  },
  "testimonials-3": {
    "testimonials": [
      {
        "quote": "We shipped a polished marketing site in a single afternoon. The blocks dropped in cleanly and looked right in both light and dark themes, exactly what our team needed without a single tweak.",
        "name": "Maya Chen",
        "role": "Founder",
        "company": "Northwind",
        "avatar": "https://i.pravatar.cc/150?img=47",
        "rating": 5
      },
      {
        "quote": "Accessible, sharp, and zero config. Our engineers stopped reinventing layouts and started shipping features again within days of adopting Acme. Onboarding went from weeks to a single morning.",
        "name": "Priya Nair",
        "role": "Engineering Manager",
        "company": "Vela",
        "avatar": "https://i.pravatar.cc/150?img=32",
        "rating": 5
      },
      {
        "quote": "Adopting Acme cut our component backlog in half by the end of the first sprint.",
        "name": "Tomás Herrera",
        "role": "Frontend Lead",
        "company": "Cobalt",
        "avatar": "https://i.pravatar.cc/150?img=13",
        "rating": 4
      },
      {
        "quote": "I expected to fight the defaults. Instead everything just composed: spacing, typography, focus states. It feels like it was designed by someone who actually ships product.",
        "name": "Sofia Lindqvist",
        "role": "Product Designer",
        "company": "Fernweh",
        "avatar": "https://i.pravatar.cc/150?img=45",
        "rating": 5
      },
      {
        "quote": "Our agency standardized on Acme across six client projects. Handoffs are clean and reviews are faster.",
        "name": "Marcus Bell",
        "role": "Creative Director",
        "company": "Studio Atlas",
        "avatar": "https://i.pravatar.cc/150?img=8",
        "rating": 5
      },
      {
        "quote": "The dark mode story alone paid for itself. No more one-off overrides scattered through the codebase, and our QA pass on theming dropped to almost nothing.",
        "name": "Aisha Rahman",
        "role": "Staff Engineer",
        "company": "Quanta",
        "avatar": "https://i.pravatar.cc/150?img=26",
        "rating": 5
      }
    ]
  },
  "testimonials-4": {
    "testimonials": [
      {
        "rating": 5,
        "quote": "Setup took minutes, not days. Every block dropped in clean and matched our brand out of the box — our marketing site shipped a week early.",
        "name": "Elena Duarte",
        "role": "Head of Growth",
        "company": "Northwind",
        "avatar": "https://i.pravatar.cc/150?img=45"
      },
      {
        "rating": 5,
        "quote": "The quality bar is unreal for the price. Accessible, responsive, and consistent across light and dark without a single override.",
        "name": "Marcus Feld",
        "role": "Frontend Lead",
        "company": "Loopline",
        "avatar": "https://i.pravatar.cc/150?img=13"
      },
      {
        "rating": 4,
        "quote": "We replaced a pile of one-off components with these blocks and our design finally feels intentional everywhere.",
        "name": "Priya Nair",
        "role": "Product Designer",
        "company": "Vela",
        "avatar": "https://i.pravatar.cc/150?img=32"
      },
      {
        "rating": 5,
        "quote": "Onboarding a new engineer used to mean explaining our layout system. Now they just compose blocks and ship.",
        "name": "Tomás Rivera",
        "role": "Engineering Manager",
        "company": "Basecoat",
        "avatar": "https://i.pravatar.cc/150?img=52"
      },
      {
        "rating": 5,
        "quote": "Support requests about broken UI basically vanished. Everything is polished and behaves the way you expect.",
        "name": "Hannah Osei",
        "role": "Founder",
        "company": "Fieldkit",
        "avatar": "https://i.pravatar.cc/150?img=27"
      },
      {
        "rating": 5,
        "quote": "It's the fastest we've ever moved from idea to a live, credible-looking product page. Worth every minute saved.",
        "name": "Yuki Tanaka",
        "role": "CTO",
        "company": "Harbor",
        "avatar": "https://i.pravatar.cc/150?img=15"
      }
    ]
  },
  "timeline-2": {
    "events": [
      {
        "year": "2021",
        "title": "The first commit",
        "copy": "Acme started as a weekend project to standardize the UI patterns our team rebuilt on every new app.",
        "tag": "Origin"
      },
      {
        "year": "2022",
        "title": "Open sourced",
        "copy": "We released the core library under MIT and the community doubled the block count within six months.",
        "tag": "Community"
      },
      {
        "year": "2023",
        "title": "Series A",
        "copy": "Fresh funding let us grow the design team and commit to a flawless light and dark experience everywhere.",
        "tag": "Growth"
      },
      {
        "year": "2024",
        "title": "100k installs",
        "copy": "Blocks crossed one hundred thousand installs through the CLI, spanning marketing sites and full SaaS apps.",
        "tag": "Milestone"
      },
      {
        "year": "2025",
        "title": "Going global",
        "copy": "Localized docs and a worldwide contributor program brought Acme to teams in more than forty countries.",
        "tag": "Today"
      }
    ]
  }
};
