"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Opening the inbox is what marks it read.
 *
 * `site_enquiries.status` has said 'new' until the owner opens it since the day
 * the table was written, and nothing had ever written the column — so the rail's
 * badge counted every enquiry the project had ever received, for ever. A badge
 * that never clears is not a signal, it is decoration, and it sits on the one
 * arrow in this product that genuinely moves.
 *
 * WHY A CLIENT COMPONENT RATHER THAN A CALL IN THE PAGE. The page is a server
 * component; writing from its render would fire on every re-render, including
 * ones nobody asked for, and a write during render is a side effect in the one
 * place React promises there are none. This runs once after mount, then asks
 * the server to re-render so the badge in the rail drops in the same breath.
 *
 * `ran` guards React's development double-mount, which would otherwise send the
 * request twice. The second call is harmless — it updates zero rows — but a
 * request that is knowingly pointless should not be sent.
 *
 * Failure is silent on purpose: nothing on this screen depends on it, and an
 * error toast over a list of real enquiries would be the product complaining
 * about its own bookkeeping while the owner is trying to read a customer's
 * message.
 */
export function MarkEnquiriesRead({ unread }: { unread: number }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || unread < 1) return;
    ran.current = true;
    (async () => {
      const { error } = await createBrowserSupabaseClient().rpc("mark_site_enquiries_read");
      if (!error) router.refresh();
    })();
  }, [unread, router]);

  return null;
}
