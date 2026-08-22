import { BLOCKS, BLOCK_META, BLOCK_CATEGORIES } from "@/components/blocks";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * TEMPORARY. A contact sheet of every pulled block, rendered inside a register
 * scope so the question "do these wear the customer's style" can be answered by
 * looking instead of by reading their CSS.
 *
 * Delete once the blocks have a real home in 组件库. Kept out of the nav on
 * purpose -- the double underscore is the marker.
 */
export default async function BlocksContactSheet({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; style?: string }>;
}) {
  const { cat, style } = await searchParams;
  const register = (style ?? "ledger") as StyleName;
  const names = cat ? (BLOCK_CATEGORIES[cat] ?? []) : Object.keys(BLOCKS);

  return (
    <div style={{ background: "#0b0d13", minHeight: "100vh", padding: 24 }}>
      <p style={{ color: "#9099a8", font: "13px ui-monospace, monospace", marginBottom: 16 }}>
        {names.length} blocks · register {register} ·{" "}
        {Object.keys(BLOCK_CATEGORIES).length} categories
      </p>
      <div style={{ display: "grid", gap: 28 }}>
        {names.map((name) => {
          const Block = BLOCKS[name];
          if (!Block) return null;
          return (
            <section key={name}>
              <p
                style={{
                  color: "#e9ebef",
                  font: "600 13px ui-monospace, monospace",
                  marginBottom: 6,
                }}
              >
                {name} — {BLOCK_META[name]?.title}
              </p>
              <StyleScope
                register={register}
                palette={null}
                className="[background-color:var(--color-canvas)] [color:var(--color-paper)]"
                style={{ borderRadius: 8, overflow: "hidden" }}
              >
                <Block />
              </StyleScope>
            </section>
          );
        })}
      </div>
    </div>
  );
}
