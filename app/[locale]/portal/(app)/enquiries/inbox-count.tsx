"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 顶栏那一行「几封新的 · 共几封」。
 *
 * ⚠️ 为什么它也得是 client：跟 `enquiry-list.tsx` 同一个理由，而且**第一版就是
 * 因为漏了它才不一致** —— 卡片上写着「新」，同一屏的顶栏写着「共 1 封」，
 * 因为 mark-read 之后服务端重画，`unread` 变成 0，而卡片那边有自己的快照。
 *
 * **一个画面上两个数字讲不同的话，比两个都错更糟** —— 看的人会以为是自己看错。
 * 所以两边用同一个做法：第一次挂载抓一次，之后不再动。
 */
export function InboxCount({ unread, total }: { unread: number; total: number }) {
  const t = useTranslations("portal");
  const [wasUnread] = useState(unread);
  if (!total) return null;
  return (
    <>
      {wasUnread
        ? t("enquiriesCountNew", { unread: wasUnread, total })
        : t("enquiriesCount", { total })}
    </>
  );
}
