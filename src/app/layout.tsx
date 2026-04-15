import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flappy Beerd — Play-to-Earn Onchain Arcade",
  description:
    "Play Flappy Beerd on the Base L2 network. Score high, earn ETH rewards, and record every play onchain via Builder Codes.",
  manifest: "/manifest.json",
  applicationName: "Flappy Beerd",
  appleWebApp: {
    capable: true,
    title: "Flappy Beerd",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/favicon.svg" }],
  },
  openGraph: {
    title: "Flappy Beerd",
    description: "Onchain arcade game — play, score, earn ETH on Base",
    type: "website",
    images: ["/og-image"],
  },
  other: {
    // Farcaster Frame v2 meta
    "fc:frame": "vNext",
    "fc:frame:image": "/og-image",
    "fc:frame:image:aspect_ratio": "1.91:1",
    "fc:frame:button:1": "🎮 Play Flappy Beerd",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": "https://flappy-beerd.vercel.app",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080E1A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
