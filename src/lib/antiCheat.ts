const usedSessions: Map<string, number> = (globalThis as any).__usedSessions ?? new Map();
(globalThis as any).__usedSessions = usedSessions;

const SESSION_TTL_MS = 15 * 60 * 1000;

const lastWalletSign: Map<string, number> = (globalThis as any).__lastWalletSign ?? new Map();
(globalThis as any).__lastWalletSign = lastWalletSign;

const WALLET_RATE_LIMIT_MS = 1500;

export const MIN_MS_PER_POINT = 400;
export const MIN_GAME_DURATION_MS = 1500;

export function isSessionConsumed(sessionId: string): boolean {
  const exp = usedSessions.get(sessionId);
  if (!exp) return false;
  if (Date.now() > exp) {
    usedSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function markSessionConsumed(sessionId: string) {
  usedSessions.set(sessionId, Date.now() + SESSION_TTL_MS);
  if (usedSessions.size > 5000) {
    const now = Date.now();
    for (const [k, v] of usedSessions) if (v < now) usedSessions.delete(k);
  }
}

export function walletRateLimited(player: string): boolean {
  const now = Date.now();
  const last = lastWalletSign.get(player) ?? 0;
  if (now - last < WALLET_RATE_LIMIT_MS) return true;
  lastWalletSign.set(player, now);
  return false;
}

export interface ReplayEvent {
  t: number;
  type: "flap";
}

export function validateReplay(
  events: ReplayEvent[] | undefined,
  durationMs: number,
  score: number
): string | null {
  if (!events) return null;
  if (!Array.isArray(events)) return "Bad replay shape";
  if (events.length > 5000) return "Replay too long";

  let prev = -1;
  let flaps = 0;
  for (const e of events) {
    if (!e || typeof e.t !== "number" || e.type !== "flap") return "Bad replay event";
    if (e.t < 0 || e.t > durationMs + 1000) return "Replay timestamp out of range";
    if (e.t < prev) return "Replay timestamps not monotonic";
    prev = e.t;
    flaps++;
  }
  if (score > 0 && flaps < score) return "Not enough flaps for score";
  return null;
}

export function validateTiming(durationMs: number, score: number): string | null {
  if (typeof durationMs !== "number" || durationMs < 0) return "Bad duration";
  if (durationMs < MIN_GAME_DURATION_MS && score > 0) return "Game too short";
  const minForScore = score * MIN_MS_PER_POINT;
  if (durationMs < minForScore) return "Score rate unrealistic";
  return null;
}
