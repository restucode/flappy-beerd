// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FlappyBase
 * @notice Onchain Flappy Bird with anti-cheat signature, ReentrancyGuard, Pausable, treasury split.
 * @dev Pre-mainnet hardened version.
 *
 *  Anti-cheat flow:
 *    1. Player calls startGame() → contract assigns gameId, emits event.
 *    2. Player plays offchain.
 *    3. Backend signer verifies the score, signs (player, gameId, score, deadline).
 *    4. Player calls submitScoreAndClaim(gameId, score, deadline, signature).
 *    5. Contract verifies signature with `trustedSigner`, ensures gameId is active.
 */
contract FlappyBase {
    // ===================================================================
    //                       OWNERSHIP
    // ===================================================================
    address public owner;
    address public pendingOwner;
    address public trustedSigner; // Backend EOA that signs valid scores
    address public treasury;       // Treasury wallet for protocol cut

    // ===================================================================
    //                       PAUSABLE
    // ===================================================================
    bool public paused;

    // ===================================================================
    //                       REENTRANCY GUARD
    // ===================================================================
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "Reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    // ===================================================================
    //                       GAME CONFIG
    // ===================================================================
    uint256 public playCost;          // Wei cost per play quota
    uint256 public rewardAmount;      // Wei reward for base tier (score >= minScoreForReward)
    uint256 public minScoreForReward;
    uint256 public bonusRewardAmount; // Wei reward for bonus tier (score >= bonusScoreThreshold)
    uint256 public bonusScoreThreshold;
    uint256 public maxScorePerGame = 500; // Anti-overflow / anti-absurd

    // Treasury split — basis points (1 bps = 0.01%)
    uint256 public poolBps     = 7000; // 70% → reward pool
    uint256 public treasuryBps = 2000; // 20% → treasury
    uint256 public builderBps  = 1000; // 10% → builder/operator
    address public builderWallet;
    uint256 public constant BPS = 10000;

    // ===================================================================
    //                       PLAYER STATE
    // ===================================================================
    mapping(address => uint256) public playQuota;
    mapping(address => bool)    public hasClaimedFreeTrial;
    mapping(address => uint256) public highScore;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public rewardsEarned;

    // Active game session per player (gameId)
    mapping(address => uint256) public activeGameId;
    mapping(uint256 => bool) public gameIdUsed; // submitted gameIds — no replay
    uint256 public nextGameId = 1;

    // Per-block submit rate limit
    mapping(address => uint256) public lastSubmitBlock;

    // ===================================================================
    //                       GLOBAL STATS
    // ===================================================================
    uint256 public totalGamesPlayed;
    uint256 public totalPlayersRewarded;
    uint256 public totalRewardsDistributed;
    uint256 public rewardPool;
    uint256 public treasuryBalance;
    uint256 public builderBalance;

    // ===================================================================
    //                       EVENTS
    // ===================================================================
    event FreeTrialClaimed(address indexed player);
    event QuotaPurchased(address indexed player, uint256 quantity, uint256 paid);
    event GameStarted(address indexed player, uint256 indexed gameId, uint256 quotaRemaining);
    event ScoreSubmitted(address indexed player, uint256 indexed gameId, uint256 score, bool won);
    event RewardClaimed(address indexed player, uint256 score, uint256 reward);
    event PoolFunded(address indexed funder, uint256 amount, uint256 newPool);
    event PoolDecreased(uint256 amount, uint256 newPool);
    event ConfigUpdated(string param, uint256 value);
    event Paused(bool state);
    event SignerUpdated(address indexed signer);
    event TreasuryUpdated(address indexed treasury);
    event BuilderUpdated(address indexed builder);
    event SplitUpdated(uint256 poolBps, uint256 treasuryBps, uint256 builderBps);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event BuilderWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(
        uint256 _playCost,
        uint256 _rewardAmount,
        uint256 _minScoreForReward,
        uint256 _bonusRewardAmount,
        uint256 _bonusScoreThreshold,
        address _trustedSigner,
        address _treasury,
        address _builder
    ) {
        require(_trustedSigner != address(0), "Signer zero");
        require(_treasury != address(0), "Treasury zero");
        require(_builder != address(0), "Builder zero");
        require(_bonusScoreThreshold > _minScoreForReward, "Bonus <= min");
        owner = msg.sender;
        playCost = _playCost;
        rewardAmount = _rewardAmount;
        minScoreForReward = _minScoreForReward;
        bonusRewardAmount = _bonusRewardAmount;
        bonusScoreThreshold = _bonusScoreThreshold;
        trustedSigner = _trustedSigner;
        treasury = _treasury;
        builderWallet = _builder;
    }

    // ===================================================================
    //                       PLAYER ACTIONS
    // ===================================================================

    function claimFreeTrial() external whenNotPaused {
        require(!hasClaimedFreeTrial[msg.sender], "Already claimed");
        hasClaimedFreeTrial[msg.sender] = true;
        playQuota[msg.sender] += 1;
        emit FreeTrialClaimed(msg.sender);
    }

    /**
     * @notice Buy play quota. Payment is split per configured bps.
     */
    function buyQuota() external payable whenNotPaused nonReentrant {
        require(msg.value >= playCost, "Insufficient payment");
        uint256 quantity = msg.value / playCost;
        require(quantity > 0 && quantity <= 100, "Invalid qty");
        uint256 paid = quantity * playCost;
        uint256 excess = msg.value - paid;

        // Split
        uint256 toPool = (paid * poolBps) / BPS;
        uint256 toTreasury = (paid * treasuryBps) / BPS;
        uint256 toBuilder = paid - toPool - toTreasury;

        playQuota[msg.sender] += quantity;
        rewardPool += toPool;
        treasuryBalance += toTreasury;
        builderBalance += toBuilder;

        emit QuotaPurchased(msg.sender, quantity, paid);
        emit PoolFunded(msg.sender, toPool, rewardPool);

        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok, "Refund failed");
        }
    }

    /**
     * @notice Start a new game. Consumes one quota, returns gameId.
     *         Player must NOT have an unsubmitted active game.
     */
    function startGame() external whenNotPaused returns (uint256 gameId) {
        require(playQuota[msg.sender] > 0, "No quota");
        require(activeGameId[msg.sender] == 0, "Active game exists");

        playQuota[msg.sender] -= 1;
        gamesPlayed[msg.sender] += 1;
        totalGamesPlayed += 1;

        gameId = nextGameId++;
        activeGameId[msg.sender] = gameId;

        emit GameStarted(msg.sender, gameId, playQuota[msg.sender]);
    }

    /**
     * @notice Submit signed score and claim reward if qualified.
     * @param gameId    Active game id from startGame().
     * @param score     Score reported by client.
     * @param deadline  Signature expiry block timestamp.
     * @param sig       65-byte signature from trustedSigner over EIP-191 message.
     */
    function submitScoreAndClaim(
        uint256 gameId,
        uint256 score,
        uint256 deadline,
        bytes calldata sig
    ) external whenNotPaused nonReentrant {
        // ---- Validation ----
        require(activeGameId[msg.sender] == gameId, "Not your game");
        require(!gameIdUsed[gameId], "Already submitted");
        require(block.timestamp <= deadline, "Sig expired");
        require(score <= maxScorePerGame, "Score too high");
        require(block.number > lastSubmitBlock[msg.sender], "Rate limited");

        // ---- Signature verification ----
        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(this), msg.sender, gameId, score, deadline))
            )
        );
        require(_recover(hash, sig) == trustedSigner, "Bad signature");

        // ---- Effects (CEI) ----
        gameIdUsed[gameId] = true;
        activeGameId[msg.sender] = 0;
        lastSubmitBlock[msg.sender] = block.number;

        if (score > highScore[msg.sender]) {
            highScore[msg.sender] = score;
        }

        bool won = false;
        uint256 payout = 0;
        if (score >= bonusScoreThreshold && rewardPool >= bonusRewardAmount) {
            payout = bonusRewardAmount;
        } else if (score >= minScoreForReward && rewardPool >= rewardAmount) {
            payout = rewardAmount;
        }
        if (payout > 0) {
            won = true;
            rewardPool -= payout;
            rewardsEarned[msg.sender] += 1;
            totalPlayersRewarded += 1;
            totalRewardsDistributed += payout;
        }

        emit ScoreSubmitted(msg.sender, gameId, score, won);

        // ---- Interaction (last) ----
        if (won) {
            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "Reward transfer failed");
            emit RewardClaimed(msg.sender, score, payout);
            emit PoolDecreased(payout, rewardPool);
        }
    }

    /**
     * @notice Forfeit an active game (e.g., disconnect). Quota stays consumed.
     */
    function forfeitGame() external {
        uint256 gid = activeGameId[msg.sender];
        require(gid != 0, "No active game");
        gameIdUsed[gid] = true;
        activeGameId[msg.sender] = 0;
        emit ScoreSubmitted(msg.sender, gid, 0, false);
    }

    // ===================================================================
    //                       VIEWS
    // ===================================================================

    function getPlayerInfo(address player) external view returns (
        uint256 quota,
        bool freeTrial,
        uint256 bestScore,
        uint256 games,
        uint256 rewards
    ) {
        return (
            playQuota[player],
            hasClaimedFreeTrial[player],
            highScore[player],
            gamesPlayed[player],
            rewardsEarned[player]
        );
    }

    function getPoolBalance() external view returns (uint256) {
        return rewardPool;
    }

    function hasActiveGame(address player) external view returns (bool) {
        return activeGameId[player] != 0;
    }

    // ===================================================================
    //                       FUNDING
    // ===================================================================

    function fundPool() external payable whenNotPaused {
        require(msg.value > 0, "Zero");
        rewardPool += msg.value;
        emit PoolFunded(msg.sender, msg.value, rewardPool);
    }

    receive() external payable {
        rewardPool += msg.value;
        emit PoolFunded(msg.sender, msg.value, rewardPool);
    }

    // ===================================================================
    //                       OWNER / ADMIN
    // ===================================================================

    function setPaused(bool _state) external onlyOwner {
        paused = _state;
        emit Paused(_state);
    }

    function setPlayCost(uint256 _v) external onlyOwner {
        playCost = _v;
        emit ConfigUpdated("playCost", _v);
    }

    function setRewardAmount(uint256 _v) external onlyOwner {
        rewardAmount = _v;
        emit ConfigUpdated("rewardAmount", _v);
    }

    function setMinScore(uint256 _v) external onlyOwner {
        require(_v < bonusScoreThreshold, "Min >= bonus");
        minScoreForReward = _v;
        emit ConfigUpdated("minScoreForReward", _v);
    }

    function setBonusReward(uint256 _amount) external onlyOwner {
        bonusRewardAmount = _amount;
        emit ConfigUpdated("bonusRewardAmount", _amount);
    }

    function setBonusThreshold(uint256 _v) external onlyOwner {
        require(_v > minScoreForReward, "Bonus <= min");
        bonusScoreThreshold = _v;
        emit ConfigUpdated("bonusScoreThreshold", _v);
    }

    function setMaxScore(uint256 _v) external onlyOwner {
        require(_v > 0 && _v < 1_000_000, "Out of range");
        maxScorePerGame = _v;
        emit ConfigUpdated("maxScorePerGame", _v);
    }

    function setTrustedSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Zero addr");
        trustedSigner = _signer;
        emit SignerUpdated(_signer);
    }

    function setTreasury(address _t) external onlyOwner {
        require(_t != address(0), "Zero addr");
        treasury = _t;
        emit TreasuryUpdated(_t);
    }

    function setBuilderWallet(address _b) external onlyOwner {
        require(_b != address(0), "Zero addr");
        builderWallet = _b;
        emit BuilderUpdated(_b);
    }

    function setSplit(uint256 _pool, uint256 _treas, uint256 _builder) external onlyOwner {
        require(_pool + _treas + _builder == BPS, "Bad bps");
        poolBps = _pool;
        treasuryBps = _treas;
        builderBps = _builder;
        emit SplitUpdated(_pool, _treas, _builder);
    }

    /**
     * @notice Withdraw treasury earnings. Cannot touch rewardPool.
     */
    function withdrawTreasury(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= treasuryBalance, "Insufficient");
        treasuryBalance -= amount;
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "Transfer failed");
        emit TreasuryWithdrawn(treasury, amount);
    }

    /**
     * @notice Withdraw builder earnings. Cannot touch rewardPool.
     */
    function withdrawBuilder(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= builderBalance, "Insufficient");
        builderBalance -= amount;
        (bool ok, ) = builderWallet.call{value: amount}("");
        require(ok, "Transfer failed");
        emit BuilderWithdrawn(builderWallet, amount);
    }

    // ---- 2-step ownership transfer ----
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero addr");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // ===================================================================
    //                       SIGNATURE RECOVERY
    // ===================================================================

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Bad v");
        // EIP-2 malleability protection
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Bad s");
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ecrecover failed");
        return signer;
    }
}
