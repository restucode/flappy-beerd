import { NextResponse } from "next/server";
import { keccak256, encodePacked, encodeAbiParameters, isAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FLAPPY_CONTRACT_ADDRESS } from "@/config/contract";
import { TARGET_CHAIN_ID } from "@/config/wagmi";

/**
 * Anti-cheat signing endpoint.
 *
 * Production hardening (must do before mainnet):
 *  - Replace the in-memory rate limiter with Redis/Upstash.
 *  - Verify the (player, gameId) actually started a game by reading the contract
 *    server-side (createPublicClient → readContract activeGameId).
 *  - Validate the score against an offchain replay log if you record gameplay.
 *  - Run this on a separate signer service so the key never touches your web host.
 *  - Rotate the trusted signer key on a schedule.
 */

const SIGNER_PK = process.env.SCORE_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
const MAX_SCORE = parseInt(process.env.MAX_SCORE_PER_GAME ?? "500", 10);
const SIG_TTL_SEC = 120;

// Naive in-memory rate limit (per player)
const lastSign: Map<string, number> = (globalThis as any).__signRate ?? new Map();
(globalThis as any).__signRate = lastSign;
const RATE_LIMIT_MS = 1500;

export async function POST(req: Request) {
  if (!SIGNER_PK || !/^0x[0-9a-fA-F]{64}$/.test(SIGNER_PK)) {
    return NextResponse.json({ error: "Signer not configured" }, { status: 500 });
  }

  let body: { player?: string; gameId?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player, gameId, score } = body;

  if (!player || !isAddress(player)) {
    return NextResponse.json({ error: "Invalid player" }, { status: 400 });
  }
  if (!gameId || !/^\d+$/.test(gameId)) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  // Rate limit
  const now = Date.now();
  const last = lastSign.get(player.toLowerCase()) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  lastSign.set(player.toLowerCase(), now);

  const account = privateKeyToAccount(SIGNER_PK);
  const deadline = Math.floor(now / 1000) + SIG_TTL_SEC;

  // Match contract: keccak256(abi.encode(chainid, contract, player, gameId, score, deadline))
  const inner = keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [
        BigInt(TARGET_CHAIN_ID),
        FLAPPY_CONTRACT_ADDRESS,
        player as Address,
        BigInt(gameId),
        BigInt(score),
        BigInt(deadline),
      ]
    )
  );

  // Then EIP-191 prefix: "\x19Ethereum Signed Message:\n32" + inner
  const signature = await account.signMessage({ message: { raw: inner } });

  return NextResponse.json({ signature, deadline });
}
