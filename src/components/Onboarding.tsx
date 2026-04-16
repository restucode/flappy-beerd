"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { BirdLogo } from "./BirdLogo";

interface OnboardingProps {
  onComplete: () => void;
}

/**
 * Arcade-cabinet style onboarding.
 * Single immersive screen — no carousels, no progress dots, no template look.
 * Two states: "title" (PRESS START) → "insert-coin" (wallet select).
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const [screen, setScreen] = useState<"title" | "insert-coin">("title");
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  // On small screens we halve the number of floating decorations. 20 absolutely-
  // positioned animated spans are cheap on desktop but add measurable paint
  // cost on mid-range phones.
  const [decorCount, setDecorCount] = useState(20);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const apply = () => setDecorCount(mql.matches ? 8 : 20);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(onComplete, 700);
      return () => clearTimeout(t);
    }
  }, [isConnected, onComplete]);

  // Spacebar / Enter triggers
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (screen === "title" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        setScreen("insert-coin");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a0b2e 0%, #060914 70%)",
      }}
    >
      {/* Floating arcade decorations behind cabinet */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(decorCount)].map((_, i) => (
          <div
            key={i}
            className="absolute font-pixel text-xs animate-float"
            style={{
              left: `${(i * 11.3) % 100}%`,
              top: `${(i * 17.7) % 100}%`,
              color: i % 3 === 0 ? "#8B5CF6" : i % 3 === 1 ? "#22D3EE" : "#EC4899",
              opacity: 0.18,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${4 + (i % 5)}s`,
              transform: `rotate(${(i * 23) % 360}deg)`,
            }}
          >
            {["◆", "✦", "▲", "●", "★"][i % 5]}
          </div>
        ))}
      </div>

      {/* THE ARCADE CABINET */}
      <div className="relative w-full max-w-[420px] crt-flicker">
        {/* Top marquee */}
        <div
          className="arcade-marquee h-3 rounded-t-3xl"
          style={{
            position: "absolute",
            top: -2,
            left: 6,
            right: 6,
            zIndex: 6,
          }}
        />

        {/* Cabinet body */}
        <div className="arcade-frame relative flex flex-col" style={{ minHeight: 600 }}>
          {/* Top label bar */}
          <div
            className="px-4 py-2.5 flex items-center justify-between border-b"
            style={{
              borderColor: "rgba(139,92,246,0.4)",
              background: "linear-gradient(180deg, rgba(139,92,246,0.15) 0%, transparent 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#EF4444", boxShadow: "0 0 6px #EF4444" }} />
              <span className="font-pixel text-[10px]" style={{ color: "#22D3EE" }}>● REC</span>
            </div>
            <span className="font-pixel text-[10px] tracking-widest" style={{ color: "#8B5CF6" }}>
              ARCADE-V1.0
            </span>
            <span className="font-pixel text-[10px]" style={{ color: "#FBBF24" }}>
              CR.00
            </span>
          </div>

          {/* SCREEN AREA */}
          <div
            className="relative flex-1 m-3 rounded-xl overflow-hidden"
            style={{
              minHeight: 500,
              background: "linear-gradient(180deg, #4DC9F6 0%, #1A8FE3 100%)",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(0,0,0,0.3)",
            }}
          >
            {/* Sky pixel clouds */}
            <div className="absolute inset-0 pointer-events-none">
              {[
                { top: "12%", left: "15%", w: 36 },
                { top: "22%", left: "65%", w: 28 },
                { top: "38%", left: "8%", w: 24 },
                { top: "8%", left: "78%", w: 20 },
              ].map((c, i) => (
                <div
                  key={i}
                  className="absolute rounded-full animate-float"
                  style={{
                    top: c.top,
                    left: c.left,
                    width: c.w,
                    height: c.w * 0.45,
                    background: "rgba(255,255,255,0.6)",
                    animationDelay: `${i * 0.7}s`,
                    animationDuration: `${5 + i}s`,
                  }}
                />
              ))}
            </div>

            {/* Pipes (decorative) */}
            <div
              className="absolute"
              style={{
                left: "55%",
                bottom: "20%",
                width: 38,
                height: "40%",
                background: "linear-gradient(180deg, #2E7D32, #43A047, #2E7D32)",
                border: "2px solid #1B5E20",
                borderRadius: "2px",
              }}
            >
              <div
                className="absolute -bottom-1 -left-1 -right-1 h-4"
                style={{
                  background: "#66BB6A",
                  border: "2px solid #1B5E20",
                  borderRadius: "2px",
                }}
              />
            </div>
            <div
              className="absolute"
              style={{
                left: "55%",
                top: "8%",
                width: 38,
                height: "30%",
                background: "linear-gradient(180deg, #2E7D32, #43A047, #2E7D32)",
                border: "2px solid #1B5E20",
                borderRadius: "2px",
              }}
            >
              <div
                className="absolute -top-1 -left-1 -right-1 h-4"
                style={{
                  background: "#66BB6A",
                  border: "2px solid #1B5E20",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Ground */}
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: "18%",
                background: "linear-gradient(180deg, #4CAF50 0%, #4CAF50 12%, #DEB887 12%, #C4A265 100%)",
                borderTop: "2px solid #2E7D32",
              }}
            />

            {/* Bird floating in center */}
            <div
              className="absolute animate-float"
              style={{ left: "20%", top: "42%", animationDuration: "1.6s" }}
            >
              <BirdLogo size={64} flapping />
            </div>

            {/* TITLE SCREEN content */}
            {screen === "title" && (
              <div className="absolute inset-0 flex flex-col items-center justify-between py-7 px-5 pointer-events-none">
                <div className="text-center pointer-events-auto">
                  <h1
                    className="font-pixel neon-blue mb-1"
                    style={{
                      fontSize: "clamp(1.75rem, 7vw, 2.25rem)",
                      lineHeight: 0.9,
                      letterSpacing: "0.04em",
                    }}
                  >
                    FLAPPY
                  </h1>
                  <h1
                    className="font-pixel neon-pink"
                    style={{
                      fontSize: "clamp(1.75rem, 7vw, 2.25rem)",
                      lineHeight: 0.9,
                      letterSpacing: "0.04em",
                    }}
                  >
                    BEERD
                  </h1>
                  <p
                    className="font-pixel text-[9px] mt-2"
                    style={{ color: "#1A1A1A", textShadow: "1px 1px 0 rgba(255,255,255,0.5)" }}
                  >
                    © 2026 ONCHAIN ARCADE CO
                  </p>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => setScreen("insert-coin")}
                    className="font-pixel neon-cyan animate-blink pointer-events-auto cursor-pointer hover:scale-110 transition-transform"
                    style={{
                      fontSize: "clamp(1rem, 4vw, 1.25rem)",
                      letterSpacing: "0.1em",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    ▶ PRESS START
                  </button>
                  <p className="font-pixel text-[9px] mt-2" style={{ color: "#1A1A1A", opacity: 0.7 }}>
                    TAP OR SPACE
                  </p>
                </div>
              </div>
            )}

            {/* INSERT COIN screen */}
            {screen === "insert-coin" && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center px-5 py-6 animate-in">
                <h2
                  className="font-pixel neon-pink mb-1 text-center"
                  style={{ fontSize: "clamp(1.1rem, 5vw, 1.5rem)", letterSpacing: "0.08em" }}
                >
                  INSERT COIN
                </h2>
                <p className="font-pixel text-[9px] mb-4" style={{ color: "#22D3EE", letterSpacing: "0.1em" }}>
                  ▼ SELECT WALLET ▼
                </p>

                <div className="w-full space-y-2 max-w-[260px]">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => connect({ connector })}
                      disabled={isPending}
                      className="coin-slot w-full p-2.5 flex items-center gap-3 transition-all hover:scale-[1.03] group"
                      style={{ cursor: isPending ? "wait" : "pointer" }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-pixel text-xs"
                        style={{
                          background: connector.name.includes("Coinbase")
                            ? "radial-gradient(circle at 35% 35%, #5B8FFF, #0052FF)"
                            : "radial-gradient(circle at 35% 35%, #FBBF24, #B45309)",
                          color: "#fff",
                          boxShadow: "inset -2px -2px 4px rgba(0,0,0,0.4), 0 0 8px rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {connector.name.includes("Coinbase") ? "B" : "$"}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-pixel text-[10px] text-white">
                          {connector.name === "Coinbase Wallet"
                            ? "BASE SMART"
                            : connector.name.toUpperCase().slice(0, 12)}
                        </p>
                        <p className="font-pixel text-[8px]" style={{ color: "#22D3EE" }}>
                          {connector.name.includes("Coinbase") ? "1 CREDIT" : "1 CREDIT"}
                        </p>
                      </div>
                      <span className="font-pixel text-[10px] animate-blink" style={{ color: "#FBBF24" }}>
                        ▶
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setScreen("title")}
                  className="font-pixel text-[9px] mt-5"
                  style={{ color: "#8B5CF6", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}
                >
                  ← BACK TO TITLE
                </button>

                {isPending && (
                  <p className="font-pixel text-[9px] mt-3 animate-blink" style={{ color: "#FBBF24" }}>
                    WAITING FOR WALLET...
                  </p>
                )}
                {isConnected && (
                  <p className="font-pixel text-[10px] mt-3 animate-bounce-in" style={{ color: "#34D399" }}>
                    ✓ COIN ACCEPTED
                  </p>
                )}
              </div>
            )}

            {/* CRT effects */}
            <div className="crt-scanlines" />
            <div className="crt-vignette" />
          </div>

          {/* Control panel */}
          <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              <Knob color="#EF4444" />
              <Knob color="#FBBF24" />
              <Knob color="#22D3EE" />
            </div>
            <div className="flex-1 flex justify-center">
              <div
                className="px-3 py-1 rounded font-pixel text-[8px]"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  color: "#8B5CF6",
                  border: "1px solid rgba(139,92,246,0.3)",
                  letterSpacing: "0.1em",
                }}
              >
                ONCHAIN ▪ BASE
              </div>
            </div>
            <div className="flex gap-1.5">
              <Btn color="#EC4899" label="A" />
              <Btn color="#22D3EE" label="B" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Knob({ color }: { color: string }) {
  return (
    <div
      className="w-4 h-4 rounded-full"
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}, #1a0b2e)`,
        boxShadow: `inset -1px -1px 2px rgba(0,0,0,0.6), 0 0 6px ${color}66`,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
}

function Btn({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center font-pixel text-[9px] text-white"
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}88)`,
        boxShadow: `inset -2px -2px 3px rgba(0,0,0,0.4), 0 0 8px ${color}66`,
        border: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {label}
    </div>
  );
}
