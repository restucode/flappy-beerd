import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_HMAC_SECRET || "";

function getSecret(): string {
  if (!SECRET || SECRET.length < 32) {
    throw new Error("SESSION_HMAC_SECRET missing or too short (>=32 chars)");
  }
  return SECRET;
}

export interface SessionTicketPayload {
  sessionId: string;
  player: string;
  startTime: number;
  nonce: string;
  version: 1;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(norm, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

export function issueTicket(player: string): { ticket: string; payload: SessionTicketPayload } {
  const payload: SessionTicketPayload = {
    sessionId: b64url(randomBytes(12)),
    player: player.toLowerCase(),
    startTime: Date.now(),
    nonce: b64url(randomBytes(8)),
    version: 1,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = sign(body);
  return { ticket: `${body}.${sig}`, payload };
}

export function verifyTicket(ticket: string): SessionTicketPayload | null {
  if (typeof ticket !== "string" || !ticket.includes(".")) return null;
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlToBuf(body).toString("utf8")) as SessionTicketPayload;
    if (payload.version !== 1) return null;
    if (!payload.sessionId || !payload.player || !payload.startTime) return null;
    return payload;
  } catch {
    return null;
  }
}
