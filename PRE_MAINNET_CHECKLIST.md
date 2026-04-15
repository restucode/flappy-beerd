# Pre-Mainnet Checklist — Flappy Base

This file tracks the work completed in code and the manual/infra steps you must perform before deploying to Base Mainnet.

---

## ✅ Done in code

| Item | Where |
|---|---|
| ReentrancyGuard (manual `_locked` flag, no OZ dep) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Pausable (`setPaused`, `whenNotPaused`) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Two-step ownership transfer | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Anti-cheat: signed scores (player, gameId, score, deadline) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol), [src/app/api/sign-score/route.ts](src/app/api/sign-score/route.ts) |
| Active gameId tracking + replay protection (`gameIdUsed`) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Quota consumed at `startGame` (not at submit) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Score cap (`maxScorePerGame`) + per-block rate limit | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| EIP-2 signature malleability protection | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) `_recover` |
| CEI pattern in `submitScoreAndClaim` | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| `call{value:}` instead of `transfer` for payouts | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Treasury split 70 / 20 / 10 (configurable) | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Restricted withdraw — owner can only touch treasury/builder, never `rewardPool` | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| `forfeitGame` for disconnect handling | [contracts/FlappyBase.sol](contracts/FlappyBase.sol) |
| Foundry test suite (~25 tests, fuzz included) | [test/FlappyBase.t.sol](test/FlappyBase.t.sol) |
| Frontend ABI + hook updated for new flow | [src/config/contract.ts](src/config/contract.ts), [src/hooks/useGameContract.ts](src/hooks/useGameContract.ts) |
| Error boundary + global Next.js error page | [src/components/ErrorBoundary.tsx](src/components/ErrorBoundary.tsx), [src/app/global-error.tsx](src/app/global-error.tsx) |
| Sentry hook (no-op when DSN absent) | [src/components/ErrorBoundary.tsx](src/components/ErrorBoundary.tsx) |
| Dynamic `og:image` via `next/og` | [src/app/og-image/route.tsx](src/app/og-image/route.tsx) |
| Farcaster Frame v2 meta tags | [src/app/layout.tsx](src/app/layout.tsx) |
| Privacy Policy page | [src/app/privacy/page.tsx](src/app/privacy/page.tsx) |
| Terms of Service page | [src/app/terms/page.tsx](src/app/terms/page.tsx) |
| Public dashboard (pool, stats, recent winners, provably fair) | [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) |
| PWA (manifest + service worker) | [public/manifest.json](public/manifest.json), [public/sw.js](public/sw.js) |
| Updated deploy script (new constructor args) | [deploy.sh](deploy.sh) |
| Slither config | [slither.config.json](slither.config.json) |
| Concurrent load test script | [scripts/load-test.mjs](scripts/load-test.mjs) |
| `.env.example` with required server secrets | [.env.example](.env.example) |

---

## 🛠 Manual / infra steps you must perform

### 1. Smart contract audit
```bash
# Static analysis
slither contracts/FlappyBase.sol

# Optional: mythril
myth analyze contracts/FlappyBase.sol --solv 0.8.20
```
**For mainnet:** commission a third-party audit (Spearbit, Trail of Bits, OpenZeppelin, Code4rena).

### 2. Foundry tests
```bash
forge test -vvv
forge coverage --report summary
# target ≥ 90% line coverage
```

### 3. Generate signer key (NEVER commit)
```bash
cast wallet new
# Note address → use as SCORE_SIGNER_ADDRESS at deploy
# Note private key → set as SCORE_SIGNER_PRIVATE_KEY in Vercel/Render env
```

### 4. Create Safe multisig for treasury + ownership
1. Go to https://safe.global/ → create Safe on Base
2. Add 2-3 signers, threshold 2/3
3. Use Safe address as `TREASURY_ADDRESS` at deploy
4. After deploy, run `transferOwnership(<SAFE>)` and accept from Safe

### 5. Dedicated RPC provider
- Sign up at Alchemy / QuickNode / Ankr
- Set `NEXT_PUBLIC_RPC_URL` in `.env.local`
- Update `src/config/wagmi.ts` to use `http(process.env.NEXT_PUBLIC_RPC_URL)`
- Update `src/app/dashboard/page.tsx` and `src/components/Leaderboard.tsx` to pass the same URL to `createPublicClient`

### 6. Sentry monitoring
```bash
npm i @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Set `NEXT_PUBLIC_SENTRY_DSN` in env. The error boundary already calls `window.Sentry.captureException`.

### 7. Load test
```bash
export CONTRACT_ADDRESS=0x...
export ATTACKER_PRIVATE_KEYS=0x...,0x...,0x...   # 10+ funded testnet keys
node scripts/load-test.mjs 10 10
```

### 8. Lighthouse
```bash
npx lighthouse https://your-deployment.vercel.app --view
# Aim: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90
```

### 9. Initial pool funding
```bash
cast send <CONTRACT> 'fundPool()' --value 1ether \
  --rpc-url $RPC_URL --account deployer
```

### 10. Test emergency pause + unpause on testnet
```bash
cast send <CONTRACT> 'setPaused(bool)' true --rpc-url $RPC_URL --account deployer
# Try buyQuota → should revert with "Paused"
cast send <CONTRACT> 'setPaused(bool)' false --rpc-url $RPC_URL --account deployer
```

### 11. Test treasury withdraw flow
```bash
cast call <CONTRACT> 'treasuryBalance()(uint256)' --rpc-url $RPC_URL
cast send <CONTRACT> 'withdrawTreasury(uint256)' <amount> --rpc-url $RPC_URL --account deployer
```

---

## 📋 Mainnet launch day checklist

```
[ ] All Foundry tests green
[ ] Slither: 0 high/medium findings (or documented exceptions)
[ ] Third-party audit complete + findings addressed
[ ] Signer key in production secret store, NOT in repo
[ ] Treasury = Safe multisig (verify on basescan)
[ ] Owner = Safe multisig (verify with `cast call <addr> 'owner()(address)'`)
[ ] Dedicated RPC configured + tested
[ ] Sentry receiving events
[ ] Lighthouse ≥ 90 across all 4 categories
[ ] og:image renders correctly via /og-image
[ ] Farcaster frame validates at https://warpcast.com/~/developers/frames
[ ] Privacy + Terms pages reachable from footer
[ ] Initial pool funded ≥ 1 ETH
[ ] Pause tested: can pause and unpause
[ ] Treasury withdraw tested, builder withdraw tested
[ ] Forfeit flow tested
[ ] Replay attack tested (should revert)
[ ] Tampered score tested (should revert "Bad signature")
[ ] Expired signature tested (should revert "Sig expired")
```
