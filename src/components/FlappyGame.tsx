"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { FlappyEngine, type GameStatus } from "@/game/engine";
import { Confetti } from "./Confetti";
import { useSound } from "@/hooks/useSound";
import { useCountUp } from "@/hooks/useCountUp";

interface GameContractInfo {
  rewardAmount?: bigint;
}

type GamePhase = "idle" | "starting" | "playing" | "submitting" | "gameover";

interface FlappyGameProps {
  phase: GamePhase;
  canPlay: boolean;
  bestScore: number;
  minScore: number;
  lastScore: number;
  lastTxHash: string | null;
  txError: string | null;
  rewardEth?: string;
  onRequestPlay: () => void;
  onGameOver: (score: number) => void;
  onBackToIdle: () => void;
}

export function FlappyGame({
  phase,
  canPlay,
  bestScore,
  minScore,
  lastScore,
  lastTxHash,
  txError,
  rewardEth = "0",
  onRequestPlay,
  onGameOver,
  onBackToIdle,
}: FlappyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlappyEngine | null>(null);
  const [engineScore, setEngineScore] = useState(0);
  const { play } = useSound();

  // Reward count-up — only counts when in gameover phase and qualified
  const targetReward = phase === "gameover" && lastScore >= minScore ? Number(rewardEth) : 0;
  const animReward = useCountUp(targetReward, 1500);
  const animScore = useCountUp(phase === "gameover" ? lastScore : 0, 900);

  const callbacksRef = useRef({ onGameOver });
  callbacksRef.current = { onGameOver };

  // Init engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new FlappyEngine(canvas, {
      onScoreChange: (s) => {
        setEngineScore(s);
        if (s > 0) play("score");
      },
      onGameOver: (s) => {
        play("gameover");
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([20, 30, 20]);
        callbacksRef.current.onGameOver(s);
      },
      onStatusChange: () => {},
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  useEffect(() => { engineRef.current?.setBestScore(bestScore); }, [bestScore]);

  useEffect(() => {
    const h = () => engineRef.current?.resize();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // When phase transitions to "playing", actually start the engine
  useEffect(() => {
    if (phase === "playing") {
      engineRef.current?.start();
    }
  }, [phase]);

  // When going back to idle, reset engine
  useEffect(() => {
    if (phase === "idle") {
      engineRef.current?.restart();
      setEngineScore(0);
    }
  }, [phase]);

  // Flap input — only during "playing" phase
  const handleFlap = useCallback(() => {
    if (phase !== "playing") return;
    engineRef.current?.flap();
    play("flap");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }, [phase, play]);

  // Trigger reward sound when entering gameover qualified
  useEffect(() => {
    if (phase === "gameover" && lastScore >= minScore) {
      play("reward");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 100]);
    }
  }, [phase, lastScore, minScore, play]);

  // Pause game when tab loses focus / visibility
  useEffect(() => {
    const onHide = () => engineRef.current?.pause?.();
    const onShow = () => engineRef.current?.resume?.();
    const onVis = () => (document.hidden ? onHide() : onShow());
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleFlap();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleFlap]);

  const qualified = lastScore >= minScore;
  const basescanUrl = lastTxHash ? `https://basescan.org/tx/${lastTxHash}` : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: "400/700" }}>
      {/* Glow */}
      <div
        className="absolute -inset-6 rounded-3xl opacity-50 blur-3xl pointer-events-none transition-opacity duration-700"
        style={{
          background: phase === "playing"
            ? "radial-gradient(ellipse, var(--base-blue-glow), var(--violet-glow) 50%, transparent 80%)"
            : "radial-gradient(ellipse, var(--violet-glow), transparent 70%)",
        }}
      />

      <canvas
        ref={canvasRef}
        className="relative w-full h-full cursor-pointer"
        style={{ borderRadius: "var(--radius-lg)" }}
        onClick={handleFlap}
        onTouchStart={(e) => { e.preventDefault(); handleFlap(); }}
      />

      {/* ============================================================
          OVERLAY: IDLE — waiting for user to start
          ============================================================ */}
      {phase === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-16"
          style={{ borderRadius: "var(--radius-lg)" }}>

          {canPlay ? (
            <button
              onClick={onRequestPlay}
              className="btn-primary px-10 py-5 text-base animate-bounce-in"
              style={{ borderRadius: "999px", fontSize: "1rem" }}
            >
              ▶ Start Game
              <span className="text-[10px] opacity-70 ml-1 font-semibold">onchain</span>
            </button>
          ) : (
            <div className="px-5 py-3 rounded-full animate-in"
              style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", backdropFilter: "blur(8px)" }}>
              <p className="text-xs font-bold text-center"
                style={{ color: "var(--gold)", fontFamily: "var(--font-display)" }}>
                ⚡ Buy a play quota below to start
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          OVERLAY: STARTING — waiting for startGame TX confirmation
          ============================================================ */}
      {phase === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ borderRadius: "var(--radius-lg)", background: "rgba(8,14,26,0.8)", backdropFilter: "blur(4px)" }}>
          <Spinner />
          <p className="mt-4 text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Starting game onchain...
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Confirm the transaction in your wallet
          </p>
        </div>
      )}

      {/* ============================================================
          OVERLAY: SUBMITTING — waiting for score submission TX
          ============================================================ */}
      {phase === "submitting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ borderRadius: "var(--radius-lg)", background: "rgba(8,14,26,0.8)", backdropFilter: "blur(4px)" }}>
          <Spinner />
          <p className="mt-4 text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Recording score onchain...
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Score: {lastScore} — submitting to Base
          </p>
        </div>
      )}

      {/* ============================================================
          OVERLAY: GAME OVER — score recorded, show result
          ============================================================ */}
      {phase === "gameover" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-in"
          style={{ borderRadius: "var(--radius-lg)", background: "rgba(8,14,26,0.8)", backdropFilter: "blur(8px)" }}>
          <Confetti active={qualified} />
          <div className="text-center px-6 max-w-[300px] relative z-10">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>
              Game Over
            </p>

            <p style={{
              fontFamily: "var(--font-display)", fontWeight: 900,
              fontSize: "clamp(2.5rem, 10vw, 3.5rem)",
              color: qualified ? "var(--emerald)" : "var(--text-primary)",
              lineHeight: 1,
            }}>
              {Math.round(animScore)}
            </p>

            <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
              Best: {Math.max(bestScore, lastScore)}
            </p>

            {/* Reward reveal */}
            {qualified && (
              <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-2xl mb-4 animate-bounce-in"
                style={{ background: "var(--grad-pool)", boxShadow: "0 8px 32px var(--emerald-glow)" }}>
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/80"
                  style={{ fontFamily: "var(--font-display)" }}>
                  ETH Reward Sent
                </span>
                <span className="text-2xl font-black text-white tabular-nums"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                  +{animReward.toFixed(4)}
                  <span className="text-xs ml-1 text-white/80">ETH</span>
                </span>
              </div>
            )}

            {!qualified && (
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Score {minScore}+ to earn ETH rewards
              </p>
            )}

            {/* TX proof */}
            {basescanUrl && (
              <a href={basescanUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors"
                style={{ color: "var(--base-blue-light)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="15,3 21,3 21,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Score recorded on Basescan
              </a>
            )}

            {/* Error message */}
            {txError && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg"
                style={{ color: "var(--coral)", background: "rgba(255,107,107,0.1)" }}>
                {txError}
              </p>
            )}

            <button onClick={onBackToIdle} className="btn-primary w-full">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: "var(--base-blue)", animationDuration: "0.8s" }} />
      <div className="absolute inset-2 rounded-full border-2 border-transparent animate-spin"
        style={{ borderTopColor: "var(--base-blue-light)", animationDuration: "1.2s", animationDirection: "reverse" }} />
    </div>
  );
}
