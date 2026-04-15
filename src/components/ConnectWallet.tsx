"use client";

import {
  useAccount,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { TARGET_CHAIN_ID } from "@/config/wagmi";

interface ConnectWalletProps {
  onProfileClick?: () => void;
}

export function ConnectWallet({ onProfileClick }: ConnectWalletProps = {}) {
  const { address, isConnected, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const needsSwitch = isConnected && chainId !== TARGET_CHAIN_ID;

  if (isReconnecting) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ background: "var(--bg-surface)" }}>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Reconnecting...</span>
      </div>
    );
  }

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-2">
      {needsSwitch ? (
        <button
          onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
          disabled={isSwitching}
          aria-label="Switch network to Base"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: "rgba(251, 191, 36, 0.12)",
            color: "var(--gold)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            fontFamily: "var(--font-display)",
          }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--gold)", boxShadow: "0 0 6px var(--gold)" }} />
          {isSwitching ? "Switching..." : "Switch to Base"}
        </button>
      ) : (
        <button
          onClick={onProfileClick}
          aria-label="Open profile"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:scale-[1.03]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: onProfileClick ? "pointer" : "default",
          }}
        >
          <span className="relative flex">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "var(--emerald)" }} />
            <span className="relative w-2 h-2 rounded-full" style={{ background: "var(--emerald)", boxShadow: "0 0 6px var(--emerald)" }} />
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </button>
      )}
      <button
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        className="p-2 rounded-xl transition-all"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.color = "var(--coral)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
