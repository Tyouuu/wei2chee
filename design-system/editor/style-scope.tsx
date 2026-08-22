"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { scopeClasses } from "@/lib/portal/palettes";
import { preferredVariants } from "@/lib/portal/design-doc";
import { VARIANTS } from "@/design-system/editor/variants";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The register a subtree is rendered in, so components can pick their own shape
 * from it -- not just their colours.
 *
 * WHY THIS EXISTS. The founder, looking at eleven registers side by side:
 * 「每一版都是一样的 heroview 这些 不能换掉吗 就会看到比较不一样」. He was
 * right, and the reason was measurable. The token layer expresses colour, type,
 * radius, border, shadow and density; it cannot express SHAPE. So all eleven
 * registers rendered the identical block sequence -- rail, header, HeroCard,
 * WorkflowStrip, RecordTable -- and differed only in paint.
 *
 * The information to fix it was already in the codebase and unused. Every
 * register declares which variant of each component it prefers
 * (`prefer` in lib/portal/design-doc.ts: 瑞士 wants a stats hero, 柔和 a trend
 * hero, 大字 a solo one, 素 a flat one), and fourteen components already carry
 * fifty-three variants between them (design-system/editor/variants.ts). Nothing
 * connected the two. A register said what it wanted and the builder emitted the
 * default anyway.
 *
 * WHY A CONTEXT AND NOT BAKED INTO THE LAYOUT. Baking the variant into the
 * saved JSON at generation time would mean the layout stops following the
 * register the moment the customer changes it -- and changing the register in
 * order to see something different is the entire interaction. Resolving at
 * render time means 换个款式 relayouts the page instantly, on the same click
 * that repaints it.
 *
 * WHY THIS WORKS DESPITE SERVER COMPONENTS. Every path that renders a
 * customer's system goes through Puck's `<Render>` or its editor, both of which
 * are client trees -- so the design-system components, none of which carry
 * their own "use client", are compiled into the client bundle at those call
 * sites and can read a context.
 *
 * THE PRECEDENCE RULE, and it is the whole contract:
 *
 *     the customer's own prop  >  the register's preference  >  the component's default
 *
 * A variant the customer picked in 换个款式 writes its props into the layout, so
 * the prop is PRESENT and wins. A block nobody has touched has no such key at
 * all, so it follows the register. That is why the components below read
 * `layout` with no default in the signature and resolve in the body: a default
 * parameter would make "never chosen" indistinguishable from "chosen, and it
 * happens to be the default".
 */
const RegisterContext = createContext<StyleName | null>(null);

/** The props of the variant this register prefers for `component`, or an empty
 *  object outside a register (the acquisition site, a bare preview). */
export function useRegisterVariant(component: string): Record<string, unknown> {
  const style = useContext(RegisterContext);
  return useMemo(() => {
    if (!style) return {};
    const wanted = preferredVariants(style)[component];
    if (!wanted) return {};
    const list = (VARIANTS as Record<string, { id: string; props: Record<string, unknown> }[]>)[component];
    return list?.find((v) => v.id === wanted)?.props ?? {};
  }, [style, component]);
}

/** Reads one prop off the register's preferred variant, typed by the caller. */
export function useRegisterProp<T>(component: string, prop: string): T | undefined {
  return useRegisterVariant(component)[prop] as T | undefined;
}

export function RegisterProvider({
  style,
  children,
}: {
  style: StyleName | null;
  children: ReactNode;
}) {
  return (
    <RegisterContext.Provider value={style}>{children}</RegisterContext.Provider>
  );
}

/**
 * The class names and the register, together.
 *
 * Every place that mounts a customer's system already called
 * `scopeClasses(style, palette)` to paint it; those are exactly the places that
 * now also have to announce which register they are painting in. Keeping the
 * two in one component is what stops the next preview being added with the
 * paint and without the shape.
 */
export function StyleScope({
  register,
  palette = null,
  className = "",
  children,
  ...rest
}: {
  /** Named `register`, not `style`, so the DOM's own `style` attribute stays
   *  available -- the scaled preview tiles need it for their transform. */
  register: StyleName;
  palette?: string | null;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${scopeClasses(register, palette)} ${className}`.trim()} {...rest}>
      <RegisterProvider style={register}>{children}</RegisterProvider>
    </div>
  );
}
