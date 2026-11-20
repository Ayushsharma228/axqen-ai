"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Gift, Trophy, Flag } from "lucide-react";

interface Journey {
  delivered: number;
  deliveredAll: number;
  countFrom: string | null;
  rto: { enabled: boolean; maxPct: number; days: number; pct: number | null; ok: boolean };
  setup: { enabled: boolean; reward: string; steps: { key: string; label: string; done: boolean; href: string }[]; done: boolean; given: boolean };
  milestones: { id: string; orders: number; reward: string; note?: string; reached: boolean; given: boolean }[];
  next: { orders: number; reward: string; left: number; progress: number } | null;
}

const C = { ink: "#0F1623", muted: "#6B7488", faint: "#9AA3B5", blue: "#1D5CFF", tint: "#EEF3FF", line: "#E2E8F4" };

/** "Your journey": setup steps for new sellers, delivered-order milestones and rewards for everyone. */
export function RewardsJourney() {
  const [j, setJ] = useState<Journey | null>(null);
  useEffect(() => { fetch("/api/seller/rewards").then(r => r.json()).then(d => { if (d.setup) setJ(d); }).catch(() => {}); }, []);
  if (!j) return null;

  // ── New seller (nothing delivered yet): setup path ──────────────────────
  if (!j.setup.done && j.deliveredAll === 0) {
    const steps = j.setup.steps;
    const doneCount = steps.filter(s => s.done).length;
    const nextIdx = steps.findIndex(s => !s.done);
    return (
      <section className="bg-white rounded-[20px] p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: C.ink }}>Get your store live</h2>
            <p className="text-[13px] mt-1" style={{ color: C.muted }}>{doneCount} of {steps.length} steps done. Next: <Link href={steps[nextIdx]?.href ?? "/seller"} className="font-semibold" style={{ color: C.blue }}>{steps[nextIdx]?.label}</Link></p>
          </div>
          {j.setup.enabled && j.setup.reward && (
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold" style={{ background: C.tint, color: C.blue }}>
              <Gift className="w-4 h-4" /> Finish to unlock {j.setup.reward}
            </span>
          )}
        </div>
        <div className="mt-6 overflow-x-auto -mx-2 px-2">
          <ol className="flex items-start min-w-[640px]">
            {steps.map((s, i) => {
              const isNext = i === nextIdx;
              return (
                <li key={s.key} className="flex-1 relative flex flex-col items-center text-center">
                  {i > 0 && <span className="absolute top-[15px] right-1/2 w-full h-[3px] rounded-full" style={{ background: steps[i - 1].done ? C.blue : C.line }} />}
                  <Link href={s.href} className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-transform hover:scale-105"
                    style={s.done ? { background: C.blue, color: "#fff" } : isNext ? { background: "#fff", color: C.blue, boxShadow: `inset 0 0 0 2.5px ${C.blue}` } : { background: "#fff", color: C.faint, boxShadow: `inset 0 0 0 2px ${C.line}` }}
                    aria-label={`${s.label}: ${s.done ? "done" : isNext ? "next step" : "to do"}`}>
                    {s.done ? <Check className="w-4 h-4" /> : i + 1}
                  </Link>
                  <span className="mt-2 text-[12px] leading-tight px-1" style={{ color: s.done || isNext ? C.ink : C.faint, fontWeight: isNext ? 600 : 400 }}>{s.label}</span>
                </li>
              );
            })}
            {j.setup.enabled && j.setup.reward && (
              <li className="flex-1 relative flex flex-col items-center text-center">
                <span className="absolute top-[15px] right-1/2 w-full h-[3px] rounded-full" style={{ background: C.line }} />
                <span className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.tint, color: C.blue }}><Gift className="w-4 h-4" /></span>
                <span className="mt-2 text-[12px] leading-tight px-1 font-semibold" style={{ color: C.blue }}>{j.setup.reward}</span>
              </li>
            )}
          </ol>
        </div>
      </section>
    );
  }

  // ── Established seller: milestone path ──────────────────────────────────
  const ms = j.milestones;
  if (!ms.length) return null;
  const reachedCount = ms.filter(m => m.reached).length;
  // Node i sits at (i + 0.5) / n of the width; fill up to the last reached node, then part-way to the next one.
  const n = ms.length;
  const at = (i: number) => (i + 0.5) / n;
  const p = j.next?.progress ?? 0;
  const fill = reachedCount >= n ? 1 : reachedCount === 0 ? p * at(0) : at(reachedCount - 1) + p * (at(reachedCount) - at(reachedCount - 1));
  return (
    <section className="bg-white rounded-[20px] p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold" style={{ color: C.ink }}>Your milestone journey</h2>
          <p className="text-[13px] mt-1" style={{ color: C.muted }}>
            <b className="tabular-nums" style={{ color: C.ink }}>{j.delivered.toLocaleString("en-IN")}</b> delivered orders{j.countFrom ? ` since ${new Date(j.countFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
            {j.next ? <> · <b style={{ color: C.blue }}>{j.next.left.toLocaleString("en-IN")} more</b> to unlock {j.next.reward}</> : " · every milestone reached"}
          </p>
          {j.rto.enabled && (
            <p className="text-[12.5px] mt-1.5 font-medium" style={{ color: j.rto.ok ? "#047857" : "#B91C1C" }}>
              {j.rto.ok
                ? `Rewards need RTO under ${j.rto.maxPct}%${j.rto.pct != null ? `. Yours is ${j.rto.pct}% over the last ${j.rto.days} days. Keep it up.` : "."}`
                : `Your RTO is ${j.rto.pct}% over the last ${j.rto.days} days. Bring it under ${j.rto.maxPct}% to claim your rewards. Confirming COD orders helps most.`}
            </p>
          )}
        </div>
        {j.setup.enabled && j.setup.reward && (
          j.setup.done ? (
            <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold" style={j.setup.given ? { background: "#ECFDF5", color: "#047857" } : { background: "#FFFBEB", color: "#92400E" }}>
              <Flag className="w-3.5 h-3.5" /> Setup reward: {j.setup.given ? "received" : "on its way"}
            </span>
          ) : (
            <Link href={j.setup.steps.find(x => !x.done)?.href ?? "/seller/profile"} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: C.tint, color: C.blue }}>
              <Flag className="w-3.5 h-3.5" /> Finish setup ({j.setup.steps.filter(x => !x.done).length} left) to unlock {j.setup.reward}
            </Link>
          )
        )}
      </div>

      <div className="mt-7 overflow-x-auto -mx-2 px-2 pb-1">
        <div className="relative min-w-[560px]">
          <div className="absolute left-0 right-0 top-[17px] h-[6px] rounded-full" style={{ background: C.tint }} />
          <div className="absolute left-0 top-[17px] h-[6px] rounded-full transition-[width] duration-700" style={{ width: `${fill * 100}%`, background: C.blue }} />
          <ol className="relative flex">
            {ms.map((m, i) => {
              const isNext = j.next?.orders === m.orders;
              const last = i === ms.length - 1;
              return (
                <li key={m.id} className="flex-1 flex flex-col items-center text-center px-1">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={m.reached ? { background: C.blue, color: "#fff", boxShadow: "0 0 0 4px #fff" } : isNext ? { background: "#fff", color: C.blue, boxShadow: `inset 0 0 0 3px ${C.blue}, 0 0 0 4px #fff` } : { background: "#fff", color: C.faint, boxShadow: `inset 0 0 0 2px ${C.line}, 0 0 0 4px #fff` }}>
                    {m.reached ? <Check className="w-5 h-5" /> : last ? <Trophy className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                  </span>
                  <span className="mt-2.5 text-[13px] font-bold tabular-nums" style={{ color: m.reached || isNext ? C.ink : C.faint }}>{m.orders.toLocaleString("en-IN")}</span>
                  <span className="text-[12px] leading-snug mt-0.5 max-w-[150px]" style={{ color: m.reached || isNext ? C.muted : C.faint }}>{m.reward}</span>
                  {m.reached && (
                    <span className="mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={m.given ? { background: "#ECFDF5", color: "#047857" } : { background: "#FFFBEB", color: "#92400E" }}>
                      {m.given ? "Received" : j.rto.ok ? "Unlocked · on its way" : `Unlocked · RTO under ${j.rto.maxPct}% to claim`}
                    </span>
                  )}
                  {isNext && <span className="mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.tint, color: C.blue }}>{j.next!.left} to go</span>}
                  {m.note && (m.reached || isNext) && <span className="mt-1 text-[11px] max-w-[150px]" style={{ color: C.faint }}>{m.note}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
