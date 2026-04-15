#!/usr/bin/env node
/**
 * Concurrent submitScoreAndClaim load test.
 *
 * Usage:
 *   node scripts/load-test.mjs <concurrency> <iterations>
 *
 * Requires: ALCHEMY_RPC, ATTACKER_PRIVATE_KEYS (comma-separated)
 *
 * NOTE: This is a destructive test. Run only against testnet contracts you own.
 */
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const RPC = process.env.RPC_URL ?? "https://sepolia.base.org";
const CONTRACT = process.env.CONTRACT_ADDRESS;
const KEYS = (process.env.ATTACKER_PRIVATE_KEYS ?? "").split(",").filter(Boolean);
const concurrency = parseInt(process.argv[2] ?? "10", 10);
const iterations = parseInt(process.argv[3] ?? "100", 10);

if (!CONTRACT || KEYS.length === 0) {
  console.error("Set CONTRACT_ADDRESS and ATTACKER_PRIVATE_KEYS env vars");
  process.exit(1);
}

const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

async function workerLoop(pk, n) {
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < n; i++) {
    try {
      // Buy quota
      await wallet.writeContract({
        address: CONTRACT,
        abi: [{ name: "buyQuota", type: "function", inputs: [], outputs: [], stateMutability: "payable" }],
        functionName: "buyQuota",
        value: parseEther("0.00004"),
      });
      ok++;
    } catch (e) {
      fail++;
    }
  }
  return { account: account.address, ok, fail };
}

(async () => {
  console.log(`Load test: ${concurrency} workers × ${iterations} iters → ${concurrency * iterations} TXs`);
  const start = Date.now();
  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    tasks.push(workerLoop(KEYS[i % KEYS.length], iterations));
  }
  const results = await Promise.all(tasks);
  const elapsed = (Date.now() - start) / 1000;
  const totalOk = results.reduce((a, r) => a + r.ok, 0);
  const totalFail = results.reduce((a, r) => a + r.fail, 0);
  console.log(`\nDone in ${elapsed.toFixed(1)}s`);
  console.log(`Success: ${totalOk}  Fail: ${totalFail}  Throughput: ${(totalOk / elapsed).toFixed(2)} tx/s`);
})();
