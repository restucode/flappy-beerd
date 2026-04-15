"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { ConnectWallet } from "@/components/ConnectWallet";
import { FlappyGame } from "@/components/FlappyGame";
import { GameOverlay } from "@/components/GameOverlay";
import { Onboarding } from "@/components/Onboarding";
import { BirdLogo } from "@/components/BirdLogo";
import { ProfileModal } from "@/components/ProfileModal";
import { Leaderboard } from "@/components/Leaderboard";
import { ChallengeBanner, useChallenge } from "@/components/ChallengeBanner";
import { useGameContract } from "@/hooks/useGameContract";
import { useSound } from "@/hooks/useSound";

/**
 * Game phases — every transition requires blockchain confirmation:
 *
 *   idle  ──(startGame TX)──▶  starting  ──(confirmed)──▶  playing
 *     ▲                                                       │
 *     │                                                  (game over)
 *     │                                                       ▼
 *   gameover ◀──(confirmed)── submitting ◀──(submitScore TX)──┘
 */
type GamePhase = "idle" | "starting" | "playing" | "submitting" | "gameover";

export default function Home() {
  const { isConnected } = useAccount();
  const contract = useGameContract();
  const sound = useSound();
  const [challenge, dismissChallenge] = useChallenge();

  const [showOnboarding, setShowOnboarding] = useState(true);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [lastScore, setLastScore] = useState(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ref so FlappyGame callbacks always see latest phase
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const visited = localStorage.getItem("flappy-base-visited");
      if (visited && isConnected) setShowOnboarding(false);
    }
  }, [isConnected]);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("flappy-base-visited", "true");
    setShowOnboarding(false);
  }, []);

  // ---- STRICT: game only playable with onchain quota > 0 ----
  const canPlay = isConnected && contract.quota > 0;

  // Keep canPlay in a ref so handleRequestPlay always sees the latest value
  const canPlayRef = useRef(canPlay);
  canPlayRef.current = canPlay;

  // Keep contract in a ref to avoid re-creating handleRequestPlay on every quota change
  const contractRef = useRef(contract);
  contractRef.current = contract;

  // ---- User taps game: fire startGame TX, wait for confirm ----
  const handleRequestPlay = useCallback(async () => {
    if (!canPlayRef.current || phaseRef.current !== "idle") return;

    setPhase("starting");
    setTxError(null);
    setLastTxHash(null);

    try {
      const { hash } = await contractRef.current.startGame();
      setLastTxHash(hash);
      // TX confirmed on chain → game can start
      setPhase("playing");
    } catch (err: any) {
      // User rejected or TX failed
      setTxError(err?.shortMessage || err?.message || "Transaction failed");
      setPhase("idle");
    }
  }, []);

  // ---- Game engine reports game over: fire submitScore TX ----
  const handleGameOver = useCallback(
    async (score: number) => {
      setLastScore(score);
      setPhase("submitting");
      setTxError(null);

      try {
        const { hash } = await contractRef.current.submitScore(score);
        setLastTxHash(hash);
      } catch (err: any) {
        setTxError(err?.shortMessage || err?.message || "Score submission failed");
      }

      setPhase("gameover");
    },
    []
  );

  // ---- Reset to idle ----
  const handleBackToIdle = useCallback(() => {
    setPhase("idle");
    setLastScore(0);
    setLastTxHash(null);
    setTxError(null);
  }, []);

  if (!mounted) return null;

  if (showOnboarding || !isConnected) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: "var(--bg-deep)" }}>
      <div className="aurora-bg" />

      {/* Top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 animate-in transition-all"
        style={{
          maxWidth: 460,
          width: "100%",
          margin: "0 auto",
          background: scrolled ? "rgba(8,12,24,0.72)" : "transparent",
          backdropFilter: scrolled ? "blur(12px) saturate(140%)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center animate-float"
            style={{
              background: "linear-gradient(135deg, #4DC9F6 0%, #1A8FE3 100%)",
              boxShadow: "0 6px 18px rgba(77,201,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.15)",
              animationDuration: "2.5s",
            }}
          >
            <BirdLogo size={28} />
          </div>
          <span className="text-base font-black gradient-text" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
            Flappy Beerd
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="Open dashboard"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: "rgba(77, 201, 246, 0.08)",
              border: "1px solid rgba(77, 201, 246, 0.25)",
              color: "var(--base-blue-light, #4DC9F6)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 15l4-4 3 3 5-6" />
            </svg>
          </Link>
          <button
            onClick={() => setLeaderboardOpen(true)}
            aria-label="Open leaderboard"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--gold)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </button>
          <button
            onClick={() => sound.toggle()}
            aria-label={sound.isEnabled ? "Mute sound" : "Unmute sound"}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: sound.isEnabled ? "var(--cyan)" : "var(--text-muted)",
            }}
          >
            {sound.isEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            )}
          </button>
          <ConnectWallet onProfileClick={() => setProfileOpen(true)} />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col gap-4 px-4 pb-6" style={{ maxWidth: 460, width: "100%", margin: "0 auto" }}>

        {challenge && (
          <ChallengeBanner challenge={challenge} onDismiss={dismissChallenge} currentBest={contract.bestScore} />
        )}

        {/* Game canvas + onchain overlays */}
        <div className="animate-in animate-in-delay-1">
          <FlappyGame
            phase={phase}
            canPlay={canPlay}
            bestScore={contract.bestScore}
            minScore={contract.minScore}
            lastScore={lastScore}
            lastTxHash={lastTxHash}
            txError={txError}
            rewardEth={formatEther(contract.rewardAmount)}
            onRequestPlay={handleRequestPlay}
            onGameOver={handleGameOver}
            onBackToIdle={handleBackToIdle}
          />
        </div>

        {/* Onchain controls */}
        <GameOverlay contract={contract} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center animate-in animate-in-delay-4">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Built on{" "}
          <a href="https://base.org" target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--base-blue-light)" }}>Base</a>
          {" "}&middot;{" "}
          <a href="/dashboard" style={{ color: "var(--cyan)" }}>Dashboard</a>
          {" "}&middot;{" "}
          <a href="/privacy" style={{ color: "var(--text-muted)" }}>Privacy</a>
          {" "}·{" "}
          <a href="/terms" style={{ color: "var(--text-muted)" }}>Terms</a>
        </p>
      </footer>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        contract={contract}
      />

      <Leaderboard
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        myAddress={contract.address}
      />
    </div>
  );
}
