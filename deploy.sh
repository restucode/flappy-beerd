#!/bin/bash
# ============================================================
# Flappy Base — Deploy to Base Sepolia (Testnet)
# ============================================================
set -e

export PATH="$HOME/.foundry/bin:$PATH"

RPC_URL="${RPC_URL:-https://mainnet.base.org}"

# Play cost: 0.00004 ETH (~$0.12 @ $3000/ETH)
PLAY_COST=40000000000000

# Base reward (score >= 30): 2x play cost = 0.00008 ETH (~$0.24)
REWARD_AMOUNT=80000000000000

# Bonus reward (score >= 100): ~$0.50 @ $3000/ETH = 0.00017 ETH
BONUS_REWARD=170000000000000

# Min score for base reward
MIN_SCORE=10
# Bonus tier: 100+ score
BONUS_THRESHOLD=100

# REQUIRED env vars (export before running):
#   SCORE_SIGNER_ADDRESS — backend signer EOA (the one that will sign scores)
#   TREASURY_ADDRESS     — treasury wallet (should be a Safe multisig)
#   BUILDER_ADDRESS      — builder/operator wallet
if [ -z "$SCORE_SIGNER_ADDRESS" ] || [ -z "$TREASURY_ADDRESS" ] || [ -z "$BUILDER_ADDRESS" ]; then
  echo "ERROR: SCORE_SIGNER_ADDRESS, TREASURY_ADDRESS, BUILDER_ADDRESS must be set"
  echo "Example:"
  echo "  export SCORE_SIGNER_ADDRESS=0x..."
  echo "  export TREASURY_ADDRESS=0x...   # ideally a Safe multisig"
  echo "  export BUILDER_ADDRESS=0x..."
  exit 1
fi

echo "=== Deploying FlappyBase ==="
echo "  RPC:           $RPC_URL"
echo "  Play cost:     0.00004 ETH (~\$0.12)"
echo "  Base reward:   0.00008 ETH (~\$0.24) for score >= $MIN_SCORE"
echo "  Bonus reward:  0.00017 ETH (~\$0.50) for score >= $BONUS_THRESHOLD"
echo "  Signer:        $SCORE_SIGNER_ADDRESS"
echo "  Treasury:      $TREASURY_ADDRESS"
echo "  Builder:       $BUILDER_ADDRESS"
echo ""

forge create contracts/FlappyBase.sol:FlappyBase \
  --rpc-url "$RPC_URL" \
  --account deployer \
  --broadcast \
  --constructor-args \
    "$PLAY_COST" \
    "$REWARD_AMOUNT" \
    "$MIN_SCORE" \
    "$BONUS_REWARD" \
    "$BONUS_THRESHOLD" \
    "$SCORE_SIGNER_ADDRESS" \
    "$TREASURY_ADDRESS" \
    "$BUILDER_ADDRESS"

echo ""
echo "=== DONE ==="
echo "1. Copy 'Deployed to:' address into .env.local:"
echo "     NEXT_PUBLIC_CONTRACT_ADDRESS=0x..."
echo "2. Set the SCORE_SIGNER_PRIVATE_KEY in .env.local (must match SCORE_SIGNER_ADDRESS)"
echo "3. Verify on BaseScan:"
echo "     forge verify-contract <addr> contracts/FlappyBase.sol:FlappyBase --chain base-sepolia"
echo "4. Fund pool: cast send <addr> 'fundPool()' --value 0.5ether --rpc-url \$RPC_URL --account deployer"
echo "5. Hand ownership to a Safe multisig BEFORE mainnet:"
echo "     cast send <addr> 'transferOwnership(address)' <SAFE> --rpc-url \$RPC_URL --account deployer"
