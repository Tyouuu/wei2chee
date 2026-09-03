"use client";

import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import type { InfoListVariant, InfoListItem } from "../types";

interface InfoRowProps {
  item: InfoListItem;
  variant: InfoListVariant;
  separated: boolean;
  linkComponent: ElementType;
  itemClassName?: string;
}

export function InfoRow({
  item,
  variant,
  separated,
  linkComponent: LinkComponent,
  itemClassName,
}: InfoRowProps) {
  const IconComponent = item.icon;
  const isLinked = item.href != null && item.href.length > 0;

  if (variant === "compact") {
    return (
      <li
        className={cn(
          /* 🔴 会换行（2026-09-03）。一行装不下的时候，**换行，不要切字**。
             报价单那张纸的框只有 220px 宽，而第一行是
             「Work quoted」配「Taman Desa 3-room reno」——
             值不肯让位（shrink-0），於是栏名被压成一个「W」。
             一个被切成一个字母的栏名，比没有栏名更像坏掉。 */
          "flex flex-wrap items-center gap-x-3 gap-y-0.5",
          separated && "pt-3 border-t border-border/50",
          itemClassName,
        )}
      >
        <IconComponent
          aria-hidden="true"
          className="w-4 h-4 text-muted-foreground shrink-0"
        />
        {isLinked ? (
          <LinkComponent
            href={item.href}
            className="text-sm text-primary hover:underline min-w-0 truncate"
          >
            {item.primary}
          </LinkComponent>
        ) : (
          <span
            className={cn(
              "text-sm min-w-0 truncate",
              /* 有值的时候，第一行是**栏名**，所以它退到 muted；
                 没有值的时候它自己就是那句话，留在读的颜色上。 */
              item.secondary ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {item.primary}
          </span>
        )}
        {/*
          🔴 紧凑那一种本来**只画第一行，把值整个丢掉**（2026-09-03 抓到）。

          `InfoRows` 把「栏名」放 primary、「值」放 secondary，而这一支
          只渲染 primary —— 所以四套用紧凑的风格，客户详情那一格印出来是
          「Contact / notes」跟「Status」**两个栏名，一个值都没有**；
          报价单那张「可以印的纸」印的是 Work quoted / Client / Quoted / Status
          —— **一张没有任何数字的报价单**。

          放大两倍才看出来，因为缩图上它长得就像一份还没填的表格。
          紧凑不是「少讲一半」，是「一行讲完」：栏名靠左退色，值靠右满色。
        */}
        {item.secondary ? (
          <span className="ml-auto max-w-full shrink-0 truncate text-sm text-foreground">
            {item.secondary}
          </span>
        ) : null}
      </li>
    );
  }

  // comfortable
  return (
    <li
      className={cn(
        "flex gap-3 items-start",
        separated && "pt-4 border-t border-border/50",
        itemClassName,
      )}
    >
      <IconComponent
        aria-hidden="true"
        className="w-5 h-5 text-primary shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1">
        {isLinked ? (
          <LinkComponent
            href={item.href}
            className="font-medium text-foreground hover:text-primary transition-colors block"
          >
            {item.primary}
          </LinkComponent>
        ) : (
          <p className="font-medium text-foreground">{item.primary}</p>
        )}
        {item.secondary && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {item.secondary}
          </p>
        )}
        {item.action && <div className="mt-1">{item.action}</div>}
      </div>
    </li>
  );
}
