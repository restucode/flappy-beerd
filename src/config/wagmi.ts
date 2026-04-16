import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Builder Code data suffix (ERC-8021) for onchain TX tracking on base.dev
const DATA_SUFFIX =
  "0x62635f6b30696c397969690b0080218021802180218021802180218021" as `0x${string}`;

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
    // batch: merges multiple reads into a single multicall RPC request.
    // Dramatically reduces load on mobile/slow networks where concurrent
    // RPC calls pile up and time out.
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org", {
      batch: { batchSize: 512, wait: 20 },
      retryCount: 2,
      retryDelay: 800,
      timeout: 15_000,
    }),
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
