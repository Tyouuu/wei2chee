"use client";

import { useState } from "react";

/**
 * Real record_changes, one unified row template instead of six hand-crafted
 * ones -- and real click-to-select, which the original design never had at
 * all ("still not wired to the list ... static illustration", its own
 * header said).
 *
 * ── Why one template, not six ───────────────────────────────────────────
 *
 * The six sample rows were each a different STORY (a discount override, a
 * WhatsApp deposit auto-match, a stock adjustment...) with bespoke prose
 * ("Applied 10% Courtesy Loyalty Discount...") no real audit trail writes.
 * record_changes logs one row per field a person actually changed -- who,
 * when, which record, which field, before -> after. That's a real,
 * genuinely useful audit trail (and one most competitors don't have: it
 * distinguishes a human click from the AI assistant acting on the same
 * account, via the `via_ai` column -- see the "AI" badge below), but it
 * doesn't narrate itself the way six invented stories can. Forcing real
 * field-level changes into six fictional categories would mean guessing
 * which "story" a change belongs to -- exactly the kind of invention this
 * whole conversion pass has been refusing to do elsewhere.
 */

export type ActivityRow = {
  id: string;
  when: string;
  entity: "pipeline" | "directory" | "ledger" | "appointment";
  label: string;
  field: string;
  was: string;
  nowIs: string;
  isDelete: boolean;
  who: string;
  viaAi: boolean;
};

const ENTITY_ICON: Record<ActivityRow["entity"], { icon: string; className: string }> = {
  pipeline: { icon: "description", className: "bg-[#eeedf1] text-[#5e5e67]" },
  directory: { icon: "person", className: "bg-[#eeedf1] text-[#5e5e67]" },
  ledger: { icon: "payments", className: "bg-[#1a9a4d]/10 text-[#1a9a4d] border border-[#1a9a4d]/20" },
  appointment: { icon: "event", className: "bg-[#3b62d9]/10 text-[#3b62d9] border border-[#3b62d9]/30" },
};

const ENTITY_LABEL: Record<ActivityRow["entity"], string> = {
  pipeline: "Quotation / Order",
  directory: "Customer / Staff",
  ledger: "Payment / Expense",
  appointment: "Appointment",
};

export function AuditLogClient({ rows }: { rows: ActivityRow[] }) {
  const [activeEntity, setActiveEntity] = useState<ActivityRow["entity"] | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  const q = search.trim().toLowerCase();
  const visibleRows = rows.filter((r) => {
    if (activeEntity !== "all" && r.entity !== activeEntity) return false;
    if (!q) return true;
    return (
      r.label.toLowerCase().includes(q) ||
      r.who.toLowerCase().includes(q) ||
      r.field.toLowerCase().includes(q)
    );
  });

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const entityCounts = (["pipeline", "directory", "ledger", "appointment"] as const).map((e) => ({
    entity: e,
    count: rows.filter((r) => r.entity === e).length,
  }));

  return (
    <>
      {/* Search & Filter Tabs */}
      <section className="flex flex-col gap-3 pb-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5e5e67] text-[18px]">
              search
            </span>
            <input
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#ffffff] border border-[#c8c5cb] text-[13.5px] leading-5 text-[#000000] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000] transition-colors"
              placeholder="Search record, staff name, or field..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveEntity("all")}
              className={
                "h-8 px-3 rounded-full text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-all active:scale-[0.97] " +
                (activeEntity === "all"
                  ? "bg-[#000000] text-[#ffffff]"
                  : "bg-[#ffffff] border border-[#c8c5cb] text-[#1a1c1f] hover:border-[#000000]")
              }
            >
              All Activities ({rows.length})
            </button>
            {entityCounts
              .filter((e) => e.count > 0)
              .map((e) => (
                <button
                  key={e.entity}
                  onClick={() => setActiveEntity(e.entity)}
                  className={
                    "h-8 px-3 rounded-full text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-all active:scale-[0.97] " +
                    (activeEntity === e.entity
                      ? "bg-[#000000] text-[#ffffff]"
                      : "bg-[#ffffff] border border-[#c8c5cb] text-[#1a1c1f] hover:border-[#000000]")
                  }
                >
                  {ENTITY_LABEL[e.entity]} ({e.count})
                </button>
              ))}
          </div>
        </div>
      </section>

      {/* Main Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start pt-1">
        {/* Activity Exhibition List */}
        <div className="xl:col-span-8 flex flex-col rounded-xl border border-[#c8c5cb]/30 bg-[#ffffff] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3 py-3 border-b border-[#e8e8ec] bg-[#f3f3f7]/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[17px] text-[#000000]">list_alt</span>
              <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#000000]">
                Chronological Activity Stream
              </span>
            </div>
            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
              Showing {visibleRows.length} of {rows.length} logged changes
            </span>
          </div>

          <div className="divide-y divide-[#e8e8ec]">
            {visibleRows.length === 0 && (
              <div className="p-10 flex flex-col items-center justify-center gap-2 text-center">
                <span className="material-symbols-outlined text-[28px] text-[#c8c5cb]">search_off</span>
                <p className="text-[13.5px] font-medium text-[#5e5e67]">
                  No activity matches {q ? `"${search.trim()}"` : "this filter"}.
                </p>
              </div>
            )}
            {visibleRows.map((r) => {
              const isSelected = r.id === selectedId;
              const meta = ENTITY_ICON[r.entity];
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={
                    "p-3 flex flex-col sm:flex-row items-start justify-between gap-3 cursor-pointer transition-colors " +
                    (isSelected ? "bg-[#f3f3f7]/50 border-l-2 border-l-[#000000]" : "hover:bg-[#f3f3f7]/40")
                  }
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={
                        "w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5 " + meta.className
                      }
                    >
                      <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] text-[#000000] font-semibold">{r.who || "Unknown"}</span>
                        {r.viaAi ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#3b62d9]/10 text-[#3b62d9] font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">smart_toy</span> AI Assistant
                          </span>
                        ) : null}
                        <span className="text-[#c8c5cb]">·</span>
                        <span className="text-[12px] text-[#5e5e67] font-mono">{r.when}</span>
                      </div>
                      <div className="text-[14px] text-[#000000] font-medium leading-snug">
                        {r.isDelete ? (
                          <>
                            Removed <span className="font-semibold">{r.label || ENTITY_LABEL[r.entity]}</span>
                          </>
                        ) : (
                          <>
                            Changed <span className="font-semibold">{r.field}</span> on{" "}
                            <span className="font-semibold">{r.label || ENTITY_LABEL[r.entity]}</span>
                          </>
                        )}
                      </div>
                      {!r.isDelete ? (
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                          <span className="line-through text-[#5e5e67] font-medium">{r.was}</span>
                          <span className="text-[#5e5e67]">→</span>
                          <span className="font-semibold text-[#000000] px-1.5 py-0.5 rounded bg-[#eeedf1]">
                            {r.nowIs}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                      {ENTITY_LABEL[r.entity]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Details Panel -- real, follows selection */}
        <aside className="xl:col-span-4 flex flex-col rounded-xl border border-[#c8c5cb]/30 bg-[#ffffff] overflow-hidden shadow-sm">
          <div className="px-3 py-3 border-b border-[#e8e8ec] bg-[#f3f3f7]/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#000000]">receipt_long</span>
              <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#000000]">
                Activity Details
              </span>
            </div>
          </div>

          {selected ? (
            <div className="p-5 flex flex-col gap-5 divide-y divide-[#e8e8ec] text-[13.5px] leading-5">
              <div className="flex flex-col gap-1 pb-1">
                <span className="text-[12px] text-[#5e5e67] font-medium">{selected.when}</span>
                <h3 className="text-base leading-6 tracking-[-0.01em] text-[16px] text-[#000000] font-semibold mt-0.5 leading-snug">
                  {selected.isDelete
                    ? `Removed ${selected.label || ENTITY_LABEL[selected.entity]}`
                    : `Changed ${selected.field}`}
                </h3>
                <p className="text-[#5e5e67] text-[13px] leading-relaxed mt-1">
                  On {ENTITY_LABEL[selected.entity]}: {selected.label || "—"}
                </p>
              </div>

              <div className="pt-5 flex flex-col gap-2.5">
                <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                  Who
                </span>
                <div className="p-2.5 rounded-lg bg-[#f3f3f7]/60 border border-[#e8e8ec] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[11px]">
                      {(selected.who || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="font-medium text-[#000000] text-[13px]">{selected.who || "Unknown"}</div>
                  </div>
                  {selected.viaAi ? (
                    <span className="text-[11px] font-medium text-[#3b62d9] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">smart_toy</span> Via AI
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-[#5e5e67]">Manual</span>
                  )}
                </div>
              </div>

              {!selected.isDelete ? (
                <div className="pt-5 flex flex-col gap-2">
                  <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                    What Changed
                  </span>
                  <div className="p-3 rounded-lg bg-[#f9f9fd] border border-[#c8c5cb]/60 flex flex-col gap-2 text-[13px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[#5e5e67]">Field:</span>
                      <span className="font-semibold text-[#000000]">{selected.field}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#5e5e67]">Was:</span>
                      <span className="line-through text-[#5e5e67]">{selected.was}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#e8e8ec] pt-2">
                      <span className="text-[#5e5e67]">Now:</span>
                      <span className="font-bold text-[#000000] text-[14px]">{selected.nowIs}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[13.5px] text-[#77767b] p-8 text-center">Select an activity to see details.</p>
          )}
        </aside>
      </div>
    </>
  );
}
