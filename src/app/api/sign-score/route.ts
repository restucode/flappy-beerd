import { NextResponse } from "next/server";
import {
  keccak256,
  encodeAbiParameters,
  isAddress,
  createPublicClient,
  http,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { FLAPPY_CONTRACT_ADDRESS } from "@/config/contract";
import { TARGET_CHAIN_ID } from "@/config/wagmi";
import { flappyBaseAbi } from "@/config/contract";
import { verifyTicket } from "@/lib/session";
import {
  isSessionConsumed,
  markSessionConsumed,
  walletRateLimited,
  validateReplay,
  validateTiming,
  type ReplayEvent,
} from "@/lib/antiCheat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNER_PK = process.env.SCORE_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
const MAX_SCORE = parseInt(process.env.MAX_SCORE_PER_GAME ?? "500", 10);
const SIG_TTL_SEC = 120;

const RPC_URL =
  process.env.BASE_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  "https://mainnet.base.org";

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });

interface SignScoreBody {
  player?: string;
  score?: number;
  durationMs?: number;
  replay?: ReplayEvent[];
  sessionId?: string;
}

export async function POST(req: Request) {
  if (!SIGNER_PK || !/^0x[0-9a-fA-F]{64}$/.test(SIGNER_PK)) {
    return NextResponse.json({ error: "Signer not configured" }, { status: 500 });
  }

  const ticketCookie = req.headers.get("cookie")?.match(/(?:^|;\s*)fb_session=([^;]+)/)?.[1];
  if (!ticketCookie) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const session = verifyTicket(decodeURIComponent(ticketCookie));
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: SignScoreBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player, score, durationMs, replay, sessionId } = body;

  if (!player || !isAddress(player)) {
    return NextResponse.json({ error: "Invalid player" }, { status: 400 });
  }
  if (player.toLowerCase() !== session.player) {
    return NextResponse.json({ error: "Player mismatch" }, { status: 403 });
  }
  if (!sessionId || sessionId !== session.sessionId) {
    return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
  }
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }
  if (typeof durationMs !== "number" || durationMs < 0 || durationMs > 30 * 60 * 1000) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  if (isSessionConsumed(session.sessionId)) {
    return NextResponse.json({ error: "Session already used" }, { status: 409 });
  }

  const now = Date.now();
  const sessionAge = now - session.startTime;
  if (sessionAge > 15 * 60 * 1000) {
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }
  if (sessionAge + 2000 < durationMs) {
    return NextResponse.json({ error: "Duration exceeds session age" }, { status: 400 });
  }

  const timingErr = validateTiming(durationMs, score);
  if (timingErr) {
    return NextResponse.json({ error: timingErr }, { status: 400 });
  }

  const replayErr = validateReplay(replay, durationMs, score);
  if (replayErr) {
    return NextResponse.json({ error: replayErr }, { status: 400 });
  }

  if (walletRateLimited(player.toLowerCase())) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let predictedGameId: bigint;
  try {
    predictedGameId = (await publicClient.readContract({
      address: FLAPPY_CONTRACT_ADDRESS,
      abi: flappyBaseAbi,
      functionName: "nextGameId",
    })) as bigint;
  } catch {
    return NextResponse.json({ error: "RPC read failed" }, { status: 502 });
  }

  markSessionConsumed(session.sessionId);

  const account = privateKeyToAccount(SIGNER_PK);
  const deadline = Math.floor(now / 1000) + SIG_TTL_SEC;

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
        predictedGameId,
        BigInt(score),
        BigInt(deadline),
      ]
    )
  );

  const signature = await account.signMessage({ message: { raw: inner } });

  return NextResponse.json({
    signature,
    deadline,
    gameId: predictedGameId.toString(),
  });
}
