"use client";

import { Render, type Data } from "@puckeditor/core";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";
import { StyleScope } from "@/design-system/editor/style-scope";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import { siteSkeleton } from "@/lib/templates/site-composition";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import type { SystemLang } from "@/lib/system-lang";

/**
 * A customer's published 官网, rendered for a stranger.
 *
 * WHY IT IS THE SAME RENDER AS THE EDITOR'S. This mounts the same
 * `puckConfig` over the same saved `layout_json`, inside the same
 * `StyleScope`, as the page the owner was looking at while they built it. Any
 * other path -- a separate "public" component set, a static export, a
 * screenshot -- introduces a second thing to keep level with the first, and the
 * moment it drifts the customer's published site stops being the page they
 * approved. There is one renderer.
 *
 * WHY THE LANGUAGE COMES FROM THE PROJECT AND NOT FROM THE VISITOR. The page
 * speaks whatever language that business's system speaks (default English --
 * see lib/system-lang.ts). A visitor's browser preference is not a vote: a
 * business's own quotation page saying 「报价」 to one reader and "Quote" to
 * the next is the business losing control of its own words.
 *
 * NO CHROME. No Formae header, no locale switcher, no login link. This URL
 * belongs to the business; the only thing on it is their page.
 */
export function PublicSite({
  data,
  style,
  palette,
  lang,
}: {
  data: Data;
  style: StyleName;
  palette: string | null;
  lang: SystemLang;
}) {
  return (
    /*
      THE WHOLE PAGE IS DARK, NOT A DARK BOX ON A LIGHT ONE.

      Put side by side with linear, vercel and resend on 2026-08-27, the
      difference was immediate and it was not colour: their black runs edge to
      edge and top to bottom, and ours was a dark rectangle floating in a white
      page with pale margins around it. That reads as a banner pasted onto a
      website rather than as a website.

      So the register's 开场的地 belongs to the PAGE. See app/globals.css for
      the token remap and site-composition.ts for which registers ask for it.
    */
    <StyleScope
      register={style}
      palette={palette}
      data-ground={siteSkeleton(style).ground ?? "page"}
      data-pattern={siteSkeleton(style).pattern}
      className="ds-ground min-h-screen [background-color:var(--color-canvas)]"
    >
      <SystemLangProvider lang={lang}>
        {/* THE PAGE FRAME. See `.ds-site` in app/globals.css for the three
            measurements that made it necessary. It wraps rather than being
            baked into the blocks because those blocks are shared with the
            owner's system pages, where edge-to-edge is right. */}
        <div className="ds-site flex flex-col">
          <Render config={puckConfig} data={data} />
        </div>
      </SystemLangProvider>
    </StyleScope>
  );
}
