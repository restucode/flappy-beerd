"use client";

import { useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useChainId,
  useSwitchChain,
  useBlockNumber,
} from "wagmi";
import {
  writeContract,
  waitForTransactionReceipt,
  sendCalls,
  getCallsStatus,
} from "wagmi/actions";
import { encodeFunctionData, type Hex } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { config } from "@/config/wagmi";
import {
  FLAPPY_CONTRACT_ADDRESS,
  CHAIN_ID,
  PLAY_COST,
  flappyBaseAbi,
} from "@/config/contract";
import type { ReplayEvent } from "@/lib/antiCheat";

const DATA_SUFFIX = "0x62635f6b30696c397969690b0080218021802180218021802180218021" as Hex;

export interface SubmitContext {
  score: number;
  sessionId: string;
  durationMs: number;
  replay?: ReplayEvent[];
}

export function useGameContract() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const needsSwitch = isConnected && chainId !== CHAIN_ID;

  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: CHAIN_ID });

  const { data: playerInfo, refetch: refetchPlayer, queryKey: playerKey, isLoading: loadingPlayer } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "getPlayerInfo",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, staleTime: 0 },
  });

  const { data: poolBalance, refetch: refetchPool, queryKey: poolKey, isLoading: loadingPool } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "getPoolBalance",
    chainId: CHAIN_ID,
    query: { staleTime: 0 },
  });

  useEffect(() => {
    if (blockNumber) {
      queryClient.invalidateQueries({ queryKey: playerKey });
      queryClient.invalidateQueries({ queryKey: poolKey });
      queryClient.invalidateQueries({ queryKey: activeGameKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber]);

  const { data: minScoreRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "minScoreForReward",
    chainId: CHAIN_ID,
  });

  const { data: playCostRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "playCost",
    chainId: CHAIN_ID,
  });

  const { data: rewardAmountRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "rewardAmount",
    chainId: CHAIN_ID,
  });

  const { data: bonusRewardRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "bonusRewardAmount",
    chainId: CHAIN_ID,
  });

  const { data: bonusThresholdRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "bonusScoreThreshold",
    chainId: CHAIN_ID,
  });

  const { data: activeGameIdRaw, queryKey: activeGameKey } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "activeGameId",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, staleTime: 0 },
  });

  const { data: totalGamesRaw } = useReadContract({
    address: FLAPPY_CONTRACT_ADDRESS,
    abi: flappyBaseAbi,
    functionName: "totalGamesPlayed",
    chainId: CHAIN_ID,
  });

  const quota = playerInfo ? Number(playerInfo[0]) : 0;
  const hasClaimedFreeTrial = playerInfo ? Boolean(playerInfo[1]) : false;
  const bestScore = playerInfo ? Number(playerInfo[2]) : 0;
  const gamesPlayed = playerInfo ? Number(playerInfo[3]) : 0;
  const rewardsEarned = playerInfo ? Number(playerInfo[4]) : 0;
  const playCost = typeof playCostRaw === "bigint" ? playCostRaw : PLAY_COST;
  const minScore = minScoreRaw !== undefined ? Number(minScoreRaw) : 1;
  const poolBal = typeof poolBalance === "bigint" ? poolBalance : BigInt(0);
  const rewardAmt = typeof rewardAmountRaw === "bigint" ? rewardAmountRaw : BigInt(0);
  const bonusReward = typeof bonusRewardRaw === "bigint" ? bonusRewardRaw : BigInt(0);
  const bonusThreshold = bonusThresholdRaw !== undefined ? Number(bonusThresholdRaw) : 100;
  const totalGames = totalGamesRaw !== undefined ? Number(totalGamesRaw) : 0;

  const ensureChain = useCallback(async () => {
    if (needsSwitch) {
      await switchChainAsync({ chainId: CHAIN_ID });
    }
  }, [needsSwitch, switchChainAsync]);

  const sendWithSuffix = useCallback(
    async (functionName: string, args: readonly unknown[] = [], value?: bigint) => {
      const hash = await writeContract(config, {
        address: FLAPPY_CONTRACT_ADDRESS,
        abi: flappyBaseAbi,
        functionName,
        args,
        chainId: CHAIN_ID,
        dataSuffix: DATA_SUFFIX,
        ...(value !== undefined ? { value } : {}),
      } as any);

      const receipt = await waitForTransactionReceipt(config, { hash, confirmations: 1 });
      return { hash, receipt };
    },
    []
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refetchPlayer(), refetchPool()]);
  }, [refetchPlayer, refetchPool]);

  const claimFreeTrial = useCallback(async () => {
    await ensureChain();
    const result = await sendWithSuffix("claimFreeTrial");
    await refreshAll();
    return result;
  }, [ensureChain, sendWithSuffix, refreshAll]);

  const buyQuota = useCallback(
    async (quantity: number = 1) => {
      await ensureChain();
      const totalValue = playCost * BigInt(Math.max(1, quantity));
      const result = await sendWithSuffix("buyQuota", [], totalValue);
      await refreshAll();
      return result;
    },
    [ensureChain, sendWithSuffix, refreshAll, playCost]
  );

  const startSession = useCallback(async () => {
    if (!address) throw new Error("Not connected");
    const res = await fetch("/api/start-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ player: address }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "Session failed");
      throw new Error(msg || "Session failed");
    }
    return (await res.json()) as { sessionId: string; startTime: number };
  }, [address]);

  const encodeCall = (functionName: string, args: readonly unknown[] = []) =>
    (encodeFunctionData({ abi: flappyBaseAbi as any, functionName, args }) + DATA_SUFFIX.slice(2)) as Hex;

  const tryBatch = useCallback(
    async (calls: { to: `0x${string}`; data: Hex }[]): Promise<{ hash: string | null; batchId: string } | null> => {
      try {
        const id = await sendCalls(config, {
          calls: calls.map((c) => ({ to: c.to, data: c.data })),
          chainId: CHAIN_ID,
        } as any);
        const batchId = typeof id === "string" ? id : (id as any)?.id;
        if (!batchId) return null;
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          const status = (await getCallsStatus(config, { id: batchId } as any)) as any;
          const st = status?.status;
          if (st === "success" || st === 200 || st === "CONFIRMED") {
            const receipts = status?.receipts as any[] | undefined;
            const lastHash = receipts?.[receipts.length - 1]?.transactionHash ?? null;
            return { hash: lastHash, batchId };
          }
          if (st === "failure" || st === "FAILED" || st === 500) {
            throw new Error("Batch failed onchain");
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
        throw new Error("Batch timed out");
      } catch (e: any) {
        const msg = String(e?.message || e?.shortMessage || "");
        if (/unsupported|method not|not support|wallet_sendCalls/i.test(msg)) {
          return null;
        }
        throw e;
      }
    },
    []
  );

  const runSequential = useCallback(
    async (ops: { fn: string; args?: readonly unknown[] }[]) => {
      let last: { hash: string; receipt: any } | null = null;
      for (const op of ops) {
        last = await sendWithSuffix(op.fn, op.args ?? []);
      }
      return last!;
    },
    [sendWithSuffix]
  );

  const playAndSubmit = useCallback(
    async (ctx: SubmitContext) => {
      await ensureChain();
      if (!address) throw new Error("Not connected");

      const hasStuck = ((activeGameIdRaw as bigint | undefined) ?? 0n) > 0n;
      const lowScore = ctx.score < Number(minScore);

      if (lowScore) {
        const ops: { fn: string; args?: readonly unknown[] }[] = [];
        if (hasStuck) ops.push({ fn: "forfeitGame" });
        ops.push({ fn: "startGame" });
        ops.push({ fn: "forfeitGame" });

        const calls = ops.map((o) => ({
          to: FLAPPY_CONTRACT_ADDRESS,
          data: encodeCall(o.fn, o.args ?? []),
        }));

        const batched = await tryBatch(calls);
        const result = batched ?? (await runSequential(ops));
        await refreshAll();
        return { hash: result.hash, won: false };
      }

      const maxAttempts = 3;
      let lastErr: any = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let sig: { signature: Hex; deadline: number; gameId: string };
        const signRes = await fetch("/api/sign-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            player: address,
            score: ctx.score,
            durationMs: ctx.durationMs,
            replay: ctx.replay,
            sessionId: ctx.sessionId,
          }),
        });
        if (!signRes.ok) {
          const msg = await signRes.text().catch(() => "Sign failed");
          throw new Error(msg || "Sign failed");
        }
        sig = await signRes.json();

        const ops: { fn: string; args?: readonly unknown[] }[] = [];
        if (hasStuck) ops.push({ fn: "forfeitGame" });
        ops.push({ fn: "startGame" });
        ops.push({
          fn: "submitScoreAndClaim",
          args: [BigInt(sig.gameId), BigInt(ctx.score), BigInt(sig.deadline), sig.signature],
        });

        const calls = ops.map((o) => ({
          to: FLAPPY_CONTRACT_ADDRESS,
          data: encodeCall(o.fn, o.args ?? []),
        }));

        try {
          const batched = await tryBatch(calls);
          const result = batched ?? (await runSequential(ops));
          await refreshAll();
          return { hash: result.hash, won: ctx.score >= Number(minScore) };
        } catch (e: any) {
          lastErr = e;
          const msg = String(e?.message || e?.shortMessage || "");
          if (/Not your game|Sig expired|Already submitted/i.test(msg) && attempt < maxAttempts - 1) {
            continue;
          }
          throw e;
        }
      }
      throw lastErr ?? new Error("Submit failed");
    },
    [ensureChain, address, activeGameIdRaw, minScore, tryBatch, runSequential, refreshAll]
  );

  const forfeitGame = useCallback(async () => {
    await ensureChain();
    const result = await sendWithSuffix("forfeitGame");
    await refreshAll();
    return result;
  }, [ensureChain, sendWithSuffix, refreshAll]);

  return {
    isConnected,
    address,
    quota,
    hasClaimedFreeTrial,
    bestScore,
    gamesPlayed,
    rewardsEarned,
    playCost,
    minScore,
    poolBalance: poolBal,
    rewardAmount: rewardAmt,
    bonusRewardAmount: bonusReward,
    bonusScoreThreshold: bonusThreshold,
    totalGames,
    isLoading: (loadingPlayer && !!address) || loadingPool,

    claimFreeTrial,
    buyQuota,
    startSession,
    playAndSubmit,
    forfeitGame,
    refreshAll,
  };
}
