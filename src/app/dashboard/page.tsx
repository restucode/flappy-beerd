"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { base } from "viem/chains";
import { FLAPPY_CONTRACT_ADDRESS, flappyBaseAbi } from "@/config/contract";
import { BirdLogo } from "@/components/BirdLogo";

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

// CDP RPC limits getLogs range tightly. Chunk into small windows.
const CHUNK = 500n;
const TOTAL_LOOKBACK = 5000n; // ~2.7h history @ 2s blocks

async function getLogsChunked(event: any, latest: bigint) {
  const start = latest > TOTAL_LOOKBACK ? latest - TOTAL_LOOKBACK : 0n;
  const all: any[] = [];
  for (let from = start; from <= latest; from += CHUNK + 1n) {
    const to = from + CHUNK > latest ? latest : from + CHUNK;
    try {
      const logs = await client.getLogs({
        address: FLAPPY_CONTRACT_ADDRESS,
        event,
        fromBlock: from,
        toBlock: to,
      });
      all.push(...logs);
    } catch {
      // Skip failing chunks silently — partial data is OK for dashboard
    }
  }
  return all;
}

interface Stats {
  poolBalance: bigint;
  totalGames: number;
  totalRewards: bigint;
  rewardAmount: bigint;
  playCost: bigint;
  minScore: number;
  uniqueWinners: number;
  totalFunded: bigint;
  rewardsPaidCount: number;
  recentWinners: { player: Address; score: bigint; reward: bigint; block: bigint }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pool, total, rewards, rewardAmt, cost, minScore] = await Promise.all([
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "getPoolBalance" }),
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "totalGamesPlayed" }),
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "totalRewardsDistributed" }),
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "rewardAmount" }),
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "playCost" }),
          client.readContract({ address: FLAPPY_CONTRACT_ADDRESS, abi: flappyBaseAbi, functionName: "minScoreForReward" }),
        ]);

        const latest = await client.getBlockNumber();
        const rewardEvent = flappyBaseAbi.find((x: any) => x.type === "event" && x.name === "RewardClaimed") as any;
        const fundEvent = flappyBaseAbi.find((x: any) => x.type === "event" && x.name === "PoolFunded") as any;

        const [rewardLogs, fundLogs] = await Promise.all([
          getLogsChunked(rewardEvent, latest),
          getLogsChunked(fundEvent, latest),
        ]);

        const winners = new Set<string>();
        const recentWinners = rewardLogs
          .map((l: any) => {
            winners.add((l.args.player as string).toLowerCase());
            return { player: l.args.player, score: l.args.score, reward: l.args.reward, block: l.blockNumber ?? 0n };
          })
          .sort((a, b) => Number(b.block - a.block))
          .slice(0, 8);

        const totalFunded = fundLogs.reduce((acc: bigint, l: any) => acc + (l.args.amount as bigint), 0n);

        setStats({
          poolBalance: pool as bigint,
          totalGames: Number(total),
          totalRewards: rewards as bigint,
          rewardAmount: rewardAmt as bigint,
          playCost: cost as bigint,
          minScore: Number(minScore),
          uniqueWinners: winners.size,
          totalFunded,
          rewardsPaidCount: rewardLogs.length,
          recentWinners,
        });
      } catch (e: any) {
        setError(e?.shortMessage || e?.message || "Failed to load");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg-deep)" }}>
      <div className="aurora-bg" />

      <header className="relative z-10 px-4 py-4 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              background: "linear-gradient(135deg, #4DC9F6 0%, #1A8FE3 100%)",
              boxShadow: "0 6px 18px rgba(77,201,246,0.35)",
            }}
          >
            <BirdLogo size={22} />
          </div>
          <span className="font-black text-lg" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Flappy Beerd
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold px-3 py-2 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "var(--font-display)",
          }}
        >
          ← Back
        </Link>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 pb-12">
        <h1
          className="text-2xl font-black mb-1 animate-in"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
        >
          Dashboard
        </h1>
        <p className="text-xs mb-6 animate-in" style={{ color: "var(--text-muted)" }}>
          Live stats from Base mainnet
        </p>

        {error && (
          <div
            className="rounded-2xl p-4 mb-4 text-sm"
            style={{
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "var(--rose, #fb7185)",
            }}
          >
            {error}
          </div>
        )}

        {!stats && !error && (
          <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-in animate-in-delay-1">
              <DashStat label="Pool Balance" value={Number(formatEther(stats.poolBalance)).toFixed(4)} suffix="ETH" color="var(--emerald)" />
              <DashStat label="Reward / Win" value={Number(formatEther(stats.rewardAmount)).toFixed(4)} suffix="ETH" color="var(--gold)" />
              <DashStat label="Min Score" value={stats.minScore.toString()} color="var(--cyan)" />
              <DashStat label="Total Games" value={stats.totalGames.toLocaleString()} color="var(--cyan)" />
              <DashStat label="Rewards Paid" value={Number(formatEther(stats.totalRewards)).toFixed(3)} suffix="ETH" color="var(--emerald)" />
              <DashStat label="Unique Winners" value={stats.uniqueWinners.toString()} color="var(--gold)" />
              <DashStat label="Wins (recent)" value={stats.rewardsPaidCount.toString()} color="var(--violet)" />
              <DashStat label="Pool Funded" value={Number(formatEther(stats.totalFunded)).toFixed(3)} suffix="ETH" color="var(--pink)" />
              <DashStat label="Play Cost" value={formatEther(stats.playCost)} suffix="ETH" color="var(--text-secondary)" />
              <DashStat
                label="Win Rate"
                value={stats.totalGames > 0 ? ((stats.rewardsPaidCount / stats.totalGames) * 100).toFixed(1) + "%" : "—"}
                color="var(--text-secondary)"
              />
              <DashStat label="Network" value="Base" color="var(--base-blue-light)" />
            </div>

            <div className="rounded-2xl p-5 mb-6 panel animate-in animate-in-delay-2">
              <h2
                className="text-sm font-black uppercase tracking-widest mb-4"
                style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}
              >
                Recent Winners
              </h2>
              {stats.recentWinners.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No winners in the recent window yet.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {stats.recentWinners.map((w, i) => (
                    <li key={i} className="flex items-center justify-between py-2.5 text-xs">
                      <a
                        href={`https://basescan.org/address/${w.player}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono"
                        style={{ color: "var(--cyan)" }}
                      >
                        {w.player.slice(0, 6)}…{w.player.slice(-4)}
                      </a>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Score <span style={{ color: "var(--gold)" }}>{w.score.toString()}</span>
                      </span>
                      <span style={{ color: "var(--emerald)" }}>+{Number(formatEther(w.reward)).toFixed(4)} ETH</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-center">
              <a
                href={`https://basescan.org/address/${FLAPPY_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Contract on BaseScan ↗
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function DashStat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 panel"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-black" style={{ color, fontFamily: "var(--font-display)" }}>
        {value}
        {suffix && <span className="text-xs ml-1 opacity-70">{suffix}</span>}
      </div>
    </div>
  );
}
