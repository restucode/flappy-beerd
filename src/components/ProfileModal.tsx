"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import type { useGameContract } from "@/hooks/useGameContract";
import { TierBadge } from "./TierBadge";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  contract: ReturnType<typeof useGameContract>;
}

export function ProfileModal({ open, onClose, contract }: ProfileModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const { address, bestScore, gamesPlayed, rewardsEarned, quota, rewardAmount } = contract;
  const totalEarned = formatEther(rewardAmount * BigInt(rewardsEarned));

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const challengeUrl = address ? `${origin}/?challenge=${address}&score=${bestScore}` : origin;
  const shareText = `🎮 I scored ${bestScore} on Flappy Beerd — onchain on @base!\n\nGames: ${gamesPlayed} · ETH earned: ${totalEarned}\n\nThink you can beat me? ↓`;
  const shareX = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(challengeUrl)}`;
  const shareFc = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText + "\n\n" + challengeUrl)}`;

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
          border: "1px solid rgba(139,92,246,0.3)",
          boxShadow: "0 30px 80px rgba(139,92,246,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient banner */}
        <div
          className="h-20 relative overflow-hidden"
          style={{
            background: "var(--grad-hero)",
            backgroundSize: "200% 200%",
            animation: "gradientPan 5s ease-in-out infinite",
          }}
        >
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20" style={{ background: "white" }} />
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 -mt-10 pb-6 relative">
          {/* Avatar circle */}
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black text-white mb-3"
            style={{
              background: "var(--grad-quota)",
              boxShadow: "0 12px 32px var(--base-blue-glow), 0 0 0 4px #0A0F1F",
              fontFamily: "var(--font-display)",
            }}
          >
            {address?.slice(2, 4).toUpperCase()}
          </div>

          {/* Address */}
          <button
            onClick={copyAddress}
            className="mx-auto block text-center text-xs px-3 py-1.5 rounded-full mb-1 transition-all hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}
          >
            {address?.slice(0, 8)}...{address?.slice(-6)} {copied ? "✓" : "⧉"}
          </button>

          <p className="text-center text-[10px] uppercase tracking-widest mb-5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            Onchain Player
          </p>

          {/* Tier */}
          <div className="mb-3">
            <TierBadge gamesPlayed={gamesPlayed} variant="full" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <ProfileStat label="Best Score" value={bestScore.toString()} color="var(--cyan)" />
            <ProfileStat label="Games" value={gamesPlayed.toString()} color="var(--violet)" />
            <ProfileStat label="Wins" value={rewardsEarned.toString()} color="var(--gold)" />
            <ProfileStat label="Quota" value={quota.toString()} color="var(--emerald)" />
          </div>

          {/* Total earned highlight */}
          <div
            className="rounded-2xl p-4 mb-4 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(34,211,238,0.1))",
              border: "1px solid rgba(52,211,153,0.3)",
            }}
          >
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--emerald)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              Total Earned
            </p>
            <p className="text-2xl font-black" style={{ color: "var(--emerald)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              {totalEarned} <span className="text-sm">ETH</span>
            </p>
          </div>

          {/* Share buttons */}
          <p className="text-[10px] uppercase tracking-widest text-center mb-2" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
            Share Your Score
          </p>
          <div className="flex gap-2 mb-3">
            <a
              href={shareX}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all hover:scale-105"
              style={{ background: "#0A0F1F", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
            >
              Share on 𝕏
            </a>
            <a
              href={shareFc}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all hover:scale-105"
              style={{ background: "#8A63D2", color: "white", fontFamily: "var(--font-display)" }}
            >
              Farcaster
            </a>
          </div>

          {/* Basescan link */}
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: "var(--cyan)", fontFamily: "var(--font-display)" }}
          >
            View on Basescan →
          </a>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
        {label}
      </p>
      <p className="text-xl font-black" style={{ color, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
        {value}
      </p>
    </div>
  );
}
