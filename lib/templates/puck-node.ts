/**
 * The one shape every layout builder in this app emits.
 *
 * Split out of industry-template.ts when landing-templates.ts needed the same
 * type: two modules importing one declaration rather than each writing its own
 * `{ type, props }`, which is the kind of duplicate that only diverges once and
 * then diverges silently.
 */
export type PuckNode = { type: string; props: Record<string, unknown> };
