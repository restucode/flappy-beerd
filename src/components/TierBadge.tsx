"use client";

import { getTier, tierProgress } from "@/lib/tiers";

interface Props {
  gamesPlayed: number;
  variant?: "compact" | "full";
}

export function TierBadge({ gamesPlayed, variant = "compact" }: Props) {
  const tier = getTier(gamesPlayed);
  const { pct, toNext } = tierProgress(gamesPlayed);

  if (variant === "compact") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black tracking-wider uppercase"
        style={{
          background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}10)`,
          border: `1px solid ${tier.color}55`,
          color: tier.color,
          fontFamily: "var(--font-display)",
          boxShadow: `0 0 12px ${tier.glow}`,
        }}
      >
        <span>{tier.icon}</span>
        <span>{tier.name}</span>
      </span>
    );
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${tier.color}1a, transparent)`,
        border: `1px solid ${tier.color}40`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl" style={{ color: tier.color }}>{tier.icon}</span>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              Tier
            </p>
            <p className="text-base font-black" style={{ color: tier.color, fontFamily: "var(--font-display)" }}>
              {tier.name}
            </p>
          </div>
        </div>
        {tier.next && (
          <p className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {toNext} games to next
          </p>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: tier.color, boxShadow: `0 0 8px ${tier.glow}` }}
        />
      </div>
    </div>
  );
}
