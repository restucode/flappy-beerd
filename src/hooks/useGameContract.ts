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
} from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { config } from "@/config/wagmi";
import {
  FLAPPY_CONTRACT_ADDRESS,
  CHAIN_ID,
  PLAY_COST,
  flappyBaseAbi,
} from "@/config/contract";

// Builder Code dataSuffix — appended to EVERY transaction for base.dev tracking
const DATA_SUFFIX = "0x62635f387074337830686d0b0080218021802180218021802180218021";

export function useGameContract() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const needsSwitch = isConnected && chainId !== CHAIN_ID;

  // Watch new blocks — used to invalidate read queries every block
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: CHAIN_ID });

  // ---- Reads ----
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

  // Re-fetch on every new block — keeps everything real-time
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

  // ---- Parse ----
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

  // ---- Helpers ----
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
        dataSuffix: DATA_SUFFIX as `0x${string}`,
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

  // ---- Actions ----
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

  // gameId returned from latest startGame — needed for submitScore
  const gameIdRef = useRef<bigint | null>(null);

  const startGame = useCallback(async () => {
    await ensureChain();
    // Auto-recover: if any previous game is still active onchain
    // (left over from a failed submit, page refresh, etc.), forfeit it first.
    const stuck = (activeGameIdRaw as bigint | undefined) ?? 0n;
    if (stuck > 0n || gameIdRef.current !== null) {
      try {
        await sendWithSuffix("forfeitGame");
      } catch {}
      gameIdRef.current = null;
    }
    const result = await sendWithSuffix("startGame");
    // Parse GameStarted event log for gameId
    try {
      const log = result.receipt.logs.find(
        (l: any) => l.address?.toLowerCase() === FLAPPY_CONTRACT_ADDRESS.toLowerCase()
      );
      if (log && log.topics?.[2]) {
        gameIdRef.current = BigInt(log.topics[2]);
      }
    } catch {}
    await refreshAll();
    return result;
  }, [ensureChain, sendWithSuffix, refreshAll, activeGameIdRaw]);

  const forfeitGame = useCallback(async () => {
    await ensureChain();
    const result = await sendWithSuffix("forfeitGame");
    gameIdRef.current = null;
    await refreshAll();
    return result;
  }, [ensureChain, sendWithSuffix, refreshAll]);

  const submitScore = useCallback(
    async (score: number) => {
      await ensureChain();
      if (!address) throw new Error("Not connected");
      const gameId = gameIdRef.current;
      if (!gameId) throw new Error("No active game");

      // Score below min reward threshold → no payout possible.
      // Skip the signing roundtrip & call forfeitGame instead (cheaper, no API dependency).
      if (score < Number(minScore)) {
        const result = await sendWithSuffix("forfeitGame");
        gameIdRef.current = null;
        await refreshAll();
        return result;
      }

      // Request signature from anti-cheat backend
      const res = await fetch("/api/sign-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: address, gameId: gameId.toString(), score }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "Sign failed");
        throw new Error(msg || "Sign failed");
      }
      const { signature, deadline } = (await res.json()) as { signature: `0x${string}`; deadline: number };

      const result = await sendWithSuffix("submitScoreAndClaim", [
        gameId,
        BigInt(score),
        BigInt(deadline),
        signature,
      ]);
      gameIdRef.current = null;
      await refreshAll();
      return result;
    },
    [ensureChain, sendWithSuffix, refreshAll, address, minScore]
  );

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
    startGame,
    submitScore,
    forfeitGame,
    refreshAll,
  };
}
