"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { base } from "viem/chains";
import { FLAPPY_CONTRACT_ADDRESS, flappyBaseAbi } from "@/config/contract";

interface Entry {
  player: Address;
  score: bigint;
  reward: bigint;
  block: bigint;
}

interface LeaderboardProps {
  open: boolean;
  onClose: () => void;
  myAddress?: Address;
}

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base.llamarpc.com";
const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

export function Leaderboard({ open, onClose, myAddress }: LeaderboardProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEntries(null);
    setError(null);

    (async () => {
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 500n ? latest - 500n : 0n;
        const logs = await client.getLogs({
          address: FLAPPY_CONTRACT_ADDRESS,
          event: flappyBaseAbi.find((x: any) => x.type === "event" && x.name === "RewardClaimed") as any,
          fromBlock,
          toBlock: latest,
        });

        // Best score per player
        const byPlayer = new Map<string, Entry>();
        for (const log of logs) {
          const args = (log as any).args as { player: Address; score: bigint; reward: bigint };
          const prev = byPlayer.get(args.player.toLowerCase());
          if (!prev || args.score > prev.score) {
            byPlayer.set(args.player.toLowerCase(), {
              player: args.player,
              score: args.score,
              reward: args.reward,
              block: (log as any).blockNumber ?? 0n,
            });
          }
        }
        const sorted = [...byPlayer.values()].sort((a, b) => Number(b.score - a.score)).slice(0, 25);
        if (!cancelled) setEntries(sorted);
      } catch (e: any) {
        if (!cancelled) setError(e?.shortMessage || e?.message || "Failed to load");
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 animate-in"
      style={{ background: "rgba(6,9,20,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-bounce-in"
        style={{
          background: "linear-gradient(180deg, #1B2542 0%, #0A0F1F 100%)",
          border: "1px solid rgba(34,211,238,0.3)",
          boxShadow: "0 30px 80px rgba(34,211,238,0.25)",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            background: "var(--grad-hero)",
            backgroundSize: "200% 200%",
            animation: "gradientPan 5s ease-in-out infinite",
          }}
        >
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/70" style={{ fontFamily: "var(--font-display)" }}>
              Onchain
            </p>
            <h2 className="text-lg font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
              Leaderboard
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close leaderboard"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: "calc(85vh - 80px)" }}>
          {error && (
            <p className="text-center text-xs py-8" style={{ color: "var(--text-muted)" }}>
              {error}
            </p>
          )}

          {!entries && !error && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl animate-pulse"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
            </div>
          )}

          {entries && entries.length === 0 && (
            <p className="text-center text-xs py-12" style={{ color: "var(--text-muted)" }}>
              No winners yet. Be the first to qualify!
            </p>
          )}

          {entries && entries.length > 0 && (
            <ol className="space-y-1.5">
              {entries.map((e, i) => {
                const isMe = myAddress && e.player.toLowerCase() === myAddress.toLowerCase();
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <li
                    key={e.player + i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: isMe ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                      border: isMe ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      className="w-8 text-center text-sm font-black tabular-nums"
                      style={{ color: i < 3 ? "var(--gold)" : "var(--text-muted)", fontFamily: "var(--font-display)" }}
                    >
                      {medal ?? `#${i + 1}`}
                    </span>
                    <span
                      className="flex-1 text-xs truncate"
                      style={{ color: isMe ? "var(--emerald)" : "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
                    >
                      {e.player.slice(0, 6)}…{e.player.slice(-4)}{isMe ? " (you)" : ""}
                    </span>
                    <div className="text-right">
                      <p
                        className="text-base font-black tabular-nums leading-none"
                        style={{ color: "var(--cyan)", fontFamily: "var(--font-display)" }}
                      >
                        {e.score.toString()}
                      </p>
                      <p className="text-[9px] mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                        +{Number(formatEther(e.reward)).toFixed(3)} ETH
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
