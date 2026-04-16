import { TARGET_CHAIN_ID } from "./wagmi";

export const FLAPPY_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const CHAIN_ID = TARGET_CHAIN_ID;

// Play cost: 0.00004 ETH (~$0.10)
export const PLAY_COST = BigInt("40000000000000");

export const flappyBaseAbi = [
  // --- Write ---
  { type: "function", name: "claimFreeTrial", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "buyQuota", inputs: [], outputs: [], stateMutability: "payable" },
  {
    type: "function",
    name: "startGame",
    inputs: [],
    outputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitScoreAndClaim",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "score", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "sig", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "forfeitGame", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "fundPool", inputs: [], outputs: [], stateMutability: "payable" },

  // --- Read ---
  {
    type: "function",
    name: "getPlayerInfo",
    inputs: [{ name: "player", type: "address", internalType: "address" }],
    outputs: [
      { name: "quota", type: "uint256", internalType: "uint256" },
      { name: "freeTrial", type: "bool", internalType: "bool" },
      { name: "bestScore", type: "uint256", internalType: "uint256" },
      { name: "games", type: "uint256", internalType: "uint256" },
      { name: "rewards", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPoolBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activeGameId",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "playCost",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rewardAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minScoreForReward",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bonusRewardAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bonusScoreThreshold",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalGamesPlayed",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalRewardsDistributed",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  { type: "function", name: "paused", inputs: [], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
  {
    type: "function",
    name: "nextGameId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },

  // --- Events ---
  { type: "event", name: "FreeTrialClaimed", inputs: [{ name: "player", type: "address", indexed: true, internalType: "address" }] },
  {
    type: "event",
    name: "QuotaPurchased",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "quantity", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "paid", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "quotaRemaining", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "gameId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "score", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "won", type: "bool", indexed: false, internalType: "bool" },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "score", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "reward", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PoolFunded",
    inputs: [
      { name: "funder", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "newPool", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;
