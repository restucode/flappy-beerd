import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { issueTicket } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { player?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const player = body.player;
  if (!player || !isAddress(player)) {
    return NextResponse.json({ error: "Invalid player" }, { status: 400 });
  }

  try {
    const { ticket, payload } = issueTicket(player);
    const res = NextResponse.json({
      sessionId: payload.sessionId,
      startTime: payload.startTime,
    });
    res.cookies.set("fb_session", ticket, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Session issuance failed" }, { status: 500 });
  }
}
