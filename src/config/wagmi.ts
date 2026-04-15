import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Builder Code data suffix (ERC-8021) for onchain TX tracking on base.dev
const DATA_SUFFIX =
  "0x62635f387074337830686d0b0080218021802180218021802180218021" as `0x${string}`;

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
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
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
