export type Tier = {
  name: "Rookie" | "Bronze" | "Silver" | "Gold" | "Diamond";
  min: number;
  color: string;
  glow: string;
  icon: string;
  next?: number;
};

export const TIERS: Tier[] = [
  { name: "Rookie",  min: 0,   color: "#94A3B8", glow: "rgba(148,163,184,0.35)", icon: "○", next: 5 },
  { name: "Bronze",  min: 5,   color: "#CD7F32", glow: "rgba(205,127,50,0.4)",   icon: "◆", next: 25 },
  { name: "Silver",  min: 25,  color: "#C0C0C0", glow: "rgba(192,192,192,0.4)",  icon: "◆◆", next: 100 },
  { name: "Gold",    min: 100, color: "#FFD700", glow: "rgba(255,215,0,0.45)",   icon: "◆◆◆", next: 500 },
  { name: "Diamond", min: 500, color: "#22D3EE", glow: "rgba(34,211,238,0.5)",   icon: "✦" },
];

export function getTier(gamesPlayed: number): Tier {
  let current = TIERS[0];
  for (const t of TIERS) if (gamesPlayed >= t.min) current = t;
  return current;
}

export function tierProgress(gamesPlayed: number): { current: Tier; pct: number; toNext: number } {
  const current = getTier(gamesPlayed);
  if (!current.next) return { current, pct: 100, toNext: 0 };
  const span = current.next - current.min;
  const within = gamesPlayed - current.min;
  return { current, pct: Math.min(100, (within / span) * 100), toNext: current.next - gamesPlayed };
}
