"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Audio API sound generator — no audio files needed.
 * Generates retro arcade SFX procedurally.
 */

type SoundName = "flap" | "score" | "gameover" | "reward" | "click" | "coin" | "error";

const STORAGE_KEY = "flappy-sound-enabled";

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(true);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const val = stored !== "false";
    enabledRef.current = val;
    setIsEnabled(val);
  }, []);

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const beep = useCallback(
    (freq: number, duration: number, type: OscillatorType = "square", volume = 0.15) => {
      if (!enabledRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [getCtx]
  );

  const slide = useCallback(
    (from: number, to: number, duration: number, type: OscillatorType = "square", volume = 0.15) => {
      if (!enabledRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [getCtx]
  );

  const play = useCallback(
    (name: SoundName) => {
      switch (name) {
        case "flap":
          slide(180, 120, 0.08, "square", 0.1);
          break;
        case "score":
          beep(880, 0.06, "square", 0.12);
          setTimeout(() => beep(1320, 0.08, "square", 0.12), 60);
          break;
        case "coin":
          beep(988, 0.05, "square", 0.15);
          setTimeout(() => beep(1318, 0.1, "square", 0.15), 50);
          break;
        case "gameover":
          slide(440, 80, 0.5, "sawtooth", 0.18);
          break;
        case "reward":
          // Triumphant arpeggio
          [523, 659, 784, 1047].forEach((f, i) =>
            setTimeout(() => beep(f, 0.12, "square", 0.18), i * 80)
          );
          setTimeout(() => beep(1568, 0.3, "square", 0.2), 320);
          break;
        case "click":
          beep(600, 0.03, "square", 0.08);
          break;
        case "error":
          beep(200, 0.15, "sawtooth", 0.15);
          setTimeout(() => beep(150, 0.2, "sawtooth", 0.15), 100);
          break;
      }
    },
    [beep, slide]
  );

  const toggle = useCallback(() => {
    enabledRef.current = !enabledRef.current;
    setIsEnabled(enabledRef.current);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(enabledRef.current));
    }
    return enabledRef.current;
  }, []);

  return { play, toggle, isEnabled: enabledRef.current };
}
