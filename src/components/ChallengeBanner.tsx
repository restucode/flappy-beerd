"use client";

import { useEffect, useState } from "react";

export interface Challenge {
  from: string;
  score: number;
}

export function useChallenge(): [Challenge | null, () => void] {
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const from = params.get("challenge");
    const score = params.get("score");
    if (from && score && /^0x[a-fA-F0-9]{40}$/.test(from)) {
      setChallenge({ from, score: parseInt(score, 10) || 0 });
    }
  }, []);

  const dismiss = () => {
    setChallenge(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("challenge");
      url.searchParams.delete("score");
      window.history.replaceState({}, "", url.toString());
    }
  };

  return [challenge, dismiss];
}

export function ChallengeBanner({ challenge, onDismiss, currentBest }: {
  challenge: Challenge;
  onDismiss: () => void;
  currentBest: number;
}) {
  const beaten = currentBest > challenge.score;
  const short = `${challenge.from.slice(0, 6)}…${challenge.from.slice(-4)}`;

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3 animate-in"
      style={{
        background: beaten
          ? "linear-gradient(135deg, rgba(52,211,153,0.18), rgba(34,211,238,0.1))"
          : "linear-gradient(135deg, rgba(236,72,153,0.18), rgba(139,92,246,0.12))",
        border: `1px solid ${beaten ? "rgba(52,211,153,0.4)" : "rgba(236,72,153,0.4)"}`,
      }}
    >
      <div className="text-2xl">{beaten ? "🏆" : "⚔️"}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {beaten ? "Challenge Beaten!" : "Incoming Challenge"}
        </p>
        <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          <span style={{ fontFamily: "var(--font-mono)" }}>{short}</span> dares you to beat <span style={{ color: "var(--gold)" }}>{challenge.score}</span>
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss challenge"
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-secondary)" }}
      >
        ✕
      </button>
    </div>
  );
}
