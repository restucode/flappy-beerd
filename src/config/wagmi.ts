import { http, fallback, createConfig, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Builder Code data suffix (ERC-8021) for onchain TX tracking on base.dev
const DATA_SUFFIX =
  "0x62635f6b30696c397969690b0080218021802180218021802180218021" as `0x${string}`;

// Multiple public RPC endpoints so a single provider outage or a WebView
// (Base App / in-app browser) blocking one of them does not wedge the UI.
// No batching — some mobile WebViews reject batched JSON-RPC POSTs.
const HTTP_OPTS = { retryCount: 2, retryDelay: 600, timeout: 12_000 } as const;
const PRIMARY_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "Flappy Beerd",
      preference: "smartWalletOnly",
    }),
    injected(),
  ],
  transports: {
    [base.id]: fallback(
      [
        http(PRIMARY_RPC, HTTP_OPTS),
        http("https://mainnet.base.org", HTTP_OPTS),
        http("https://base.llamarpc.com", HTTP_OPTS),
        http("https://base-rpc.publicnode.com", HTTP_OPTS),
      ],
      { rank: false, retryCount: 1 }
    ),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  dataSuffix: DATA_SUFFIX,
});

// Mainnet: Base
export const TARGET_CHAIN = base;
export const TARGET_CHAIN_ID = base.id;

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
