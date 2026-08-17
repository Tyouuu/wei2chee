"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getReferenceCases } from "@/lib/reference-cases";
import type { ReferenceCase } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PeerCaseGallery({ industryId }: { industryId: string }) {
  const [cases, setCases] = useState<ReferenceCase[]>([]);
  const t = useTranslations("peerCases");

  useEffect(() => {
    getReferenceCases(industryId).then(setCases).catch(console.error);
  }, [industryId]);

  if (cases.length === 0) return null;

  return (
    <section className="px-6 py-24">
      <h2 className="text-center text-2xl font-semibold">{t("title")}</h2>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4">
        {cases.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{c.anonymous_name}</CardTitle>
              {c.source === "inferred" && (
                <Badge variant="secondary">{t("inferredLabel")}</Badge>
              )}
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {c.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
