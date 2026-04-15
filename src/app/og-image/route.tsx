import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0F1F 0%, #1A8FE3 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "white",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(77,201,246,0.25)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -100,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "rgba(34,211,238,0.18)",
            display: "flex",
          }}
        />
        {/* Bird */}
        <div
          style={{
            width: 140,
            height: 140,
            background: "#FFB300",
            borderRadius: "50%",
            border: "6px solid #7A4A00",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            boxShadow: "0 24px 80px rgba(255,179,0,0.45)",
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "white", border: "5px solid #7A4A00", display: "flex" }} />
        </div>

        <div style={{ fontSize: 88, fontWeight: 900, letterSpacing: -3, lineHeight: 1, display: "flex" }}>
          Flappy Beerd
        </div>
        <div style={{ fontSize: 28, opacity: 0.85, marginTop: 12, display: "flex" }}>
          Onchain arcade · Play to earn ETH on Base
        </div>
        <div
          style={{
            marginTop: 36,
            padding: "14px 28px",
            background: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.25)",
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            display: "flex",
          }}
        >
          🎮 Play now →
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
