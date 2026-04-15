"use client";

import { useState } from "react";
import { formatEther } from "viem";
import type { useGameContract } from "@/hooks/useGameContract";
import { useToast } from "./Toast";
import { useSound } from "@/hooks/useSound";
import { useCountUp } from "@/hooks/useCountUp";

interface GameOverlayProps {
  contract: ReturnType<typeof useGameContract>;
}

const QUANTITY_OPTIONS = [1, 5, 10];

export function GameOverlay({ contract }: GameOverlayProps) {
  const {
    isConnected,
    quota,
    hasClaimedFreeTrial,
    bestScore,
    gamesPlayed,
    rewardsEarned,
    playCost,
    minScore,
    poolBalance,
    rewardAmount,
    bonusRewardAmount,
    bonusScoreThreshold,
    totalGames,
    claimFreeTrial,
    buyQuota,
    isLoading,
  } = contract;

  const { toast, dismiss } = useToast();
  const { play } = useSound();
  const [busy, setBusy] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState(1);

  // Animated stats
  const animQuota = useCountUp(quota);
  const animBest = useCountUp(bestScore);
  const animGames = useCountUp(gamesPlayed);
  const animWins = useCountUp(rewardsEarned);
  const poolEth = Number(formatEther(poolBalance));
  const animPool = useCountUp(poolEth);

  const handleAction = async (
    name: string,
    label: string,
    fn: () => Promise<{ hash: string }>
  ) => {
    setBusy(name);
    play("click");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);

    const loadingId = toast({
      type: "loading",
      title: `${label} pending`,
      description: "Confirm in your wallet...",
    });

    try {
      const { hash } = await fn();
      dismiss(loadingId);
      toast({
        type: "success",
        title: `${label} confirmed`,
        description: "Transaction recorded onchain",
        txHash: hash,
      });
      play("coin");
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    } catch (err: any) {
      dismiss(loadingId);
      toast({
        type: "error",
        title: "Transaction failed",
        description: err?.shortMessage || err?.message || "Unknown error",
      });
      play("error");
    }
    setBusy(null);
  };

  if (!isConnected) return null;

  const costDisplay = formatEther(playCost);
  const rewardDisplay = formatEther(rewardAmount);
  const bonusDisplay = formatEther(bonusRewardAmount);
  const totalCost = formatEther(playCost * BigInt(buyQty));

  return (
    <div className="w-full space-y-4 animate-in animate-in-delay-2">
      {/* Hero reward pool card */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{
          background: "var(--grad-pool)",
          backgroundSize: "200% 200%",
          animation: "gradientPan 6s ease-in-out infinite",
          boxShadow: "0 12px 40px var(--emerald-glow)",
        }}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20" style={{ background: "white" }} />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-15" style={{ background: "white" }} />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/80" style={{ fontFamily: "var(--font-display)" }}>
              Reward Pool
            </p>
            {isLoading ? (
              <div className="h-9 w-32 mt-1 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.2)" }} />
            ) : (
              <p className="text-3xl font-black text-white mt-1" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                {animPool.toFixed(4)}
                <span className="text-base font-bold ml-1.5 text-white/80">ETH</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/70" style={{ fontFamily: "var(--font-display)" }}>
              Per Win
            </p>
            <p className="text-base font-black text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {rewardDisplay} ETH
            </p>
          </div>
        </div>
      </div>

      {/* Quantity selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
          Buy
        </span>
        {QUANTITY_OPTIONS.map((q) => (
          <button
            key={q}
            onClick={() => {
              setBuyQty(q);
              play("click");
            }}
            aria-label={`Buy ${q} play${q > 1 ? "s" : ""}`}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: buyQty === q ? "var(--grad-quota)" : "var(--bg-surface)",
              border: `1px solid ${buyQty === q ? "transparent" : "rgba(255,255,255,0.06)"}`,
              color: buyQty === q ? "white" : "var(--text-secondary)",
              fontFamily: "var(--font-display)",
              boxShadow: buyQty === q ? "0 4px 16px var(--base-blue-glow)" : "none",
            }}
          >
            {q}x
          </button>
        ))}
        <span className="text-[10px] font-bold ml-1" style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
          {totalCost} ETH
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {!hasClaimedFreeTrial && (
          <ActionBtn
            onClick={() => handleAction("free", "Free Trial", claimFreeTrial)}
            busy={busy === "free"}
            disabled={!!busy}
            gradient="linear-gradient(135deg, #34D399 0%, #059669 100%)"
            glow="var(--emerald-glow)"
            label="Free Trial"
            sub="+1 play"
            icon="✦"
          />
        )}
        <ActionBtn
          onClick={() => handleAction("buy", `Buy ${buyQty}x Play`, () => buyQuota(buyQty))}
          busy={busy === "buy"}
          disabled={!!busy}
          gradient="var(--grad-quota)"
          glow="var(--base-blue-glow)"
          label={`Buy ${buyQty}x Play`}
          sub={`${totalCost} ETH`}
          icon="◆"
        />
      </div>

      {/* Player stats — animated */}
      <div className="grid grid-cols-4 gap-px rounded-2xl overflow-hidden panel">
        <Stat label="Quota" value={Math.round(animQuota).toString()} color="var(--cyan)" highlight loading={isLoading} />
        <Stat label="Best" value={Math.round(animBest).toString()} color="var(--text-primary)" loading={isLoading} />
        <Stat label="Played" value={Math.round(animGames).toString()} color="var(--text-primary)" loading={isLoading} />
        <Stat label="Won" value={Math.round(animWins).toString()} color="var(--emerald)" loading={isLoading} />
      </div>

      {/* Footer info */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between panel">
        <PoolInfo label="Min Score" value={minScore.toString()} />
        <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.06)" }} />
        <PoolInfo label="Global Plays" value={totalGames.toString()} />
        <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.06)" }} />
        <PoolInfo label="Network" value="Base" />
      </div>

      <p className="text-center text-[11px] px-2" style={{ color: "var(--text-muted)" }}>
        Score <span style={{ color: "var(--gold)" }}>{minScore}+</span> → <span style={{ color: "var(--emerald)" }}>{rewardDisplay} ETH</span>
        {" · "}
        Score <span style={{ color: "var(--pink)" }}>{bonusScoreThreshold}+</span> → <span style={{ color: "var(--gold)" }}>{bonusDisplay} ETH 🔥</span>
      </p>
    </div>
  );
}

/* ---- Sub-components ---- */

function ActionBtn({
  onClick,
  busy,
  disabled,
  gradient,
  glow,
  label,
  sub,
  icon,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  gradient: string;
  glow: string;
  label: string;
  sub: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex-1 py-4 px-3 rounded-2xl text-center transition-all duration-200 relative overflow-hidden"
      style={{
        background: gradient,
        backgroundSize: "200% 200%",
        fontFamily: "var(--font-display)",
        opacity: disabled && !busy ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: `0 6px 20px ${glow}`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 12px 32px ${glow}`;
          e.currentTarget.style.backgroundPosition = "100% 50%";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = `0 6px 20px ${glow}`;
        e.currentTarget.style.backgroundPosition = "0% 50%";
      }}
    >
      {busy ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span className="text-xs font-bold text-white">Confirming...</span>
        </div>
      ) : (
        <>
          <div className="text-lg leading-none mb-1 text-white">{icon}</div>
          <p className="text-sm font-black text-white leading-tight">{label}</p>
          <p className="text-[10px] text-white/80 leading-tight mt-0.5">{sub}</p>
        </>
      )}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
  highlight,
  loading,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className="py-3.5 px-2 text-center"
      style={{
        background: highlight
          ? "linear-gradient(180deg, rgba(34,211,238,0.08), transparent)"
          : "var(--bg-surface)",
      }}
    >
      <p
        className="text-[10px] uppercase tracking-wider mb-1"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {label}
      </p>
      {loading ? (
        <div className="h-5 w-8 mx-auto rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
      ) : (
        <p
          className="text-base font-black"
          style={{
            color,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function PoolInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center flex-1">
      <p
        className="text-[9px] uppercase tracking-wider"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {label}
      </p>
      <p
        className="text-xs font-bold mt-0.5"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
    </div>
  );
}
