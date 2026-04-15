// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/FlappyBase.sol";

contract FlappyBaseTest is Test {
    FlappyBase game;

    address owner = address(0xA11CE);
    address player = address(0xB0B);
    address player2 = address(0xCAFE);
    address treasury = address(0xDEAD);
    address builder = address(0xBEEF);

    uint256 signerPk = 0xA11CE5;
    address signer;

    uint256 constant PLAY_COST = 0.0001 ether;
    uint256 constant REWARD = 0.0002 ether;        // 2x play
    uint256 constant BONUS_REWARD = 0.0005 ether;
    uint256 constant MIN_SCORE = 1;
    uint256 constant BONUS_THRESHOLD = 100;

    function setUp() public {
        signer = vm.addr(signerPk);
        vm.prank(owner);
        game = new FlappyBase(
            PLAY_COST,
            REWARD,
            MIN_SCORE,
            BONUS_REWARD,
            BONUS_THRESHOLD,
            signer,
            treasury,
            builder
        );

        vm.deal(player, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(owner, 10 ether);
    }

    // ---- helpers ----
    function _signScore(address p, uint256 gameId, uint256 score, uint256 deadline) internal view returns (bytes memory) {
        bytes32 inner = keccak256(abi.encode(block.chainid, address(game), p, gameId, score, deadline));
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, hash);
        return abi.encodePacked(r, s, v);
    }

    function _fundPool(uint256 amount) internal {
        vm.prank(owner);
        game.fundPool{value: amount}();
    }

    function _startGame(address p) internal returns (uint256 gid) {
        vm.prank(p);
        gid = game.startGame();
    }

    // ============================================================
    //                       BUY QUOTA
    // ============================================================

    function test_BuyQuota_SplitsCorrectly() public {
        _fundPool(1 ether);
        uint256 poolBefore = game.rewardPool();
        uint256 paid = PLAY_COST * 5;

        vm.prank(player);
        game.buyQuota{value: paid}();

        assertEq(game.playQuota(player), 5);
        assertEq(game.rewardPool() - poolBefore, (paid * 7000) / 10000);
        assertEq(game.treasuryBalance(), (paid * 2000) / 10000);
        assertEq(game.builderBalance(), (paid * 1000) / 10000);
    }

    function test_BuyQuota_RefundsExcess() public {
        uint256 sent = PLAY_COST * 3 + 1234;
        uint256 balBefore = player.balance;
        vm.prank(player);
        game.buyQuota{value: sent}();
        // Refund: sent - 3*cost
        assertEq(player.balance, balBefore - PLAY_COST * 3);
    }

    function test_BuyQuota_RevertInsufficient() public {
        vm.expectRevert("Insufficient payment");
        vm.prank(player);
        game.buyQuota{value: PLAY_COST - 1}();
    }

    function test_BuyQuota_QuantityCap() public {
        vm.expectRevert("Invalid qty");
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 101}();
    }

    // ============================================================
    //                       FREE TRIAL
    // ============================================================

    function test_FreeTrial_OnlyOnce() public {
        vm.prank(player);
        game.claimFreeTrial();
        assertEq(game.playQuota(player), 1);

        vm.expectRevert("Already claimed");
        vm.prank(player);
        game.claimFreeTrial();
    }

    // ============================================================
    //                       START GAME
    // ============================================================

    function test_StartGame_ConsumesQuota() public {
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        assertEq(game.playQuota(player), 0);
        assertEq(game.activeGameId(player), gid);
        assertEq(game.gamesPlayed(player), 1);
    }

    function test_StartGame_RevertNoQuota() public {
        vm.expectRevert("No quota");
        vm.prank(player);
        game.startGame();
    }

    function test_StartGame_RevertActiveGameExists() public {
        // Buy 2 quotas
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 2}();

        vm.prank(player);
        game.startGame();

        // Has another quota but still has unsubmitted active game
        vm.expectRevert("Active game exists");
        vm.prank(player);
        game.startGame();
    }

    // ============================================================
    //                       SUBMIT SCORE
    // ============================================================

    function test_SubmitScore_HappyPath_Win() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);

        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10, deadline);

        uint256 balBefore = player.balance;
        // Need different block to bypass rate limit
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10, deadline, sig);

        assertEq(player.balance - balBefore, REWARD);
        assertEq(game.highScore(player), 10);
        assertEq(game.rewardsEarned(player), 1);
        assertEq(game.activeGameId(player), 0);
    }

    function test_SubmitScore_BonusTier_PaysBonus() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 150, deadline);

        uint256 balBefore = player.balance;
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, 150, deadline, sig);

        assertEq(player.balance - balBefore, BONUS_REWARD);
    }

    function test_SubmitScore_AtBonusThreshold_PaysBonus() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, BONUS_THRESHOLD, deadline);

        uint256 balBefore = player.balance;
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, BONUS_THRESHOLD, deadline, sig);

        assertEq(player.balance - balBefore, BONUS_REWARD);
    }

    function test_SubmitScore_JustBelowBonus_PaysBase() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, BONUS_THRESHOLD - 1, deadline);

        uint256 balBefore = player.balance;
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, BONUS_THRESHOLD - 1, deadline, sig);

        assertEq(player.balance - balBefore, REWARD);
    }

    function test_SubmitScore_BelowMin_NoReward() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        // set min to 5
        vm.prank(owner);
        game.setMinScore(5);

        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 3, deadline);

        uint256 balBefore = player.balance;
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, 3, deadline, sig);

        assertEq(player.balance, balBefore);
        assertEq(game.highScore(player), 3);
    }

    function test_SubmitScore_BadSignature_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;

        // Sign with wrong key
        bytes32 inner = keccak256(abi.encode(block.chainid, address(game), player, gid, uint256(50), deadline));
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBADBAD, hash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.roll(block.number + 1);
        vm.expectRevert("Bad signature");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 50, deadline, sig);
    }

    function test_SubmitScore_TamperedScore_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10, deadline);

        vm.roll(block.number + 1);
        vm.expectRevert("Bad signature");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 100, deadline, sig); // tampered (under cap)
    }

    function test_SubmitScore_ExpiredDeadline_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10, deadline);

        vm.warp(deadline + 1);
        vm.roll(block.number + 1);
        vm.expectRevert("Sig expired");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10, deadline, sig);
    }

    function test_SubmitScore_Replay_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 2}();
        // First game
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10, deadline);
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10, deadline, sig);

        // Try to replay same gameId — would need active game
        vm.expectRevert("Not your game");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10, deadline, sig);
    }

    function test_SubmitScore_ScoreCap_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10000, deadline);

        vm.roll(block.number + 1);
        vm.expectRevert("Score too high");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10000, deadline, sig);
    }

    function test_SubmitScore_RateLimit_SameBlock_Reverts() public {
        _fundPool(1 ether);
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 2}();

        uint256 gid1 = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig1 = _signScore(player, gid1, 10, deadline);
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid1, 10, deadline, sig1);

        // 2nd in SAME block
        uint256 gid2 = _startGame(player);
        bytes memory sig2 = _signScore(player, gid2, 10, deadline);
        vm.expectRevert("Rate limited");
        vm.prank(player);
        game.submitScoreAndClaim(gid2, 10, deadline, sig2);
    }

    function test_SubmitScore_PoolEmpty_NoRevertButNoPayout() public {
        // Pool empty
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        uint256 deadline = block.timestamp + 60;
        bytes memory sig = _signScore(player, gid, 10, deadline);

        uint256 balBefore = player.balance;
        vm.roll(block.number + 1);
        vm.prank(player);
        game.submitScoreAndClaim(gid, 10, deadline, sig);

        // High score recorded but no reward
        assertEq(player.balance, balBefore);
        assertEq(game.highScore(player), 10);
        assertEq(game.rewardsEarned(player), 0);
    }

    // ============================================================
    //                       FORFEIT
    // ============================================================

    function test_Forfeit_ClearsActiveGame() public {
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);

        vm.prank(player);
        game.forfeitGame();
        assertEq(game.activeGameId(player), 0);
        assertTrue(game.gameIdUsed(gid));
    }

    // ============================================================
    //                       PAUSE
    // ============================================================

    function test_Pause_BlocksActions() public {
        vm.prank(owner);
        game.setPaused(true);

        vm.expectRevert("Paused");
        vm.prank(player);
        game.claimFreeTrial();

        vm.expectRevert("Paused");
        vm.prank(player);
        game.buyQuota{value: PLAY_COST}();
    }

    function test_Pause_OnlyOwner() public {
        vm.expectRevert("Not owner");
        vm.prank(player);
        game.setPaused(true);
    }

    // ============================================================
    //                       TREASURY WITHDRAW
    // ============================================================

    function test_WithdrawTreasury_OnlyOwner_AndOnlyTreasuryBalance() public {
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 10}();
        uint256 tb = game.treasuryBalance();
        assertGt(tb, 0);

        // Player can't withdraw
        vm.expectRevert("Not owner");
        vm.prank(player);
        game.withdrawTreasury(tb);

        // Owner withdraws
        uint256 balBefore = treasury.balance;
        vm.prank(owner);
        game.withdrawTreasury(tb);
        assertEq(treasury.balance - balBefore, tb);
        assertEq(game.treasuryBalance(), 0);
    }

    function test_WithdrawTreasury_CannotExceedBalance() public {
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 10}();
        vm.expectRevert("Insufficient");
        vm.prank(owner);
        game.withdrawTreasury(100 ether);
    }

    function test_WithdrawCannotDrainRewardPool() public {
        _fundPool(1 ether);
        // No treasury yet
        vm.expectRevert("Insufficient");
        vm.prank(owner);
        game.withdrawTreasury(0.5 ether);
    }

    // ============================================================
    //                       OWNERSHIP TRANSFER
    // ============================================================

    function test_OwnershipTransfer_TwoStep() public {
        vm.prank(owner);
        game.transferOwnership(player);
        assertEq(game.owner(), owner); // not yet
        assertEq(game.pendingOwner(), player);

        vm.prank(player);
        game.acceptOwnership();
        assertEq(game.owner(), player);
        assertEq(game.pendingOwner(), address(0));
    }

    function test_OwnershipTransfer_RevertNonPending() public {
        vm.prank(owner);
        game.transferOwnership(player);
        vm.expectRevert("Not pending");
        vm.prank(player2);
        game.acceptOwnership();
    }

    // ============================================================
    //                       SPLIT CONFIG
    // ============================================================

    function test_SetSplit_MustSumToBPS() public {
        vm.expectRevert("Bad bps");
        vm.prank(owner);
        game.setSplit(5000, 3000, 1000);

        vm.prank(owner);
        game.setSplit(8000, 1000, 1000);
        assertEq(game.poolBps(), 8000);
    }

    // ============================================================
    //                       FUZZ
    // ============================================================

    // ============================================================
    //                       SETTERS / CONFIG
    // ============================================================

    function test_Setters_OnlyOwner() public {
        vm.startPrank(player);
        vm.expectRevert("Not owner"); game.setPlayCost(1);
        vm.expectRevert("Not owner"); game.setRewardAmount(1);
        vm.expectRevert("Not owner"); game.setMinScore(1);
        vm.expectRevert("Not owner"); game.setMaxScore(1);
        vm.expectRevert("Not owner"); game.setTrustedSigner(address(1));
        vm.expectRevert("Not owner"); game.setTreasury(address(1));
        vm.expectRevert("Not owner"); game.setBuilderWallet(address(1));
        vm.stopPrank();
    }

    function test_Setters_UpdateValues() public {
        vm.startPrank(owner);
        game.setPlayCost(123);                 assertEq(game.playCost(), 123);
        game.setRewardAmount(456);             assertEq(game.rewardAmount(), 456);
        game.setMinScore(7);                   assertEq(game.minScoreForReward(), 7);
        game.setMaxScore(999);                 assertEq(game.maxScorePerGame(), 999);
        game.setTrustedSigner(address(0x111)); assertEq(game.trustedSigner(), address(0x111));
        game.setTreasury(address(0x222));      assertEq(game.treasury(), address(0x222));
        game.setBuilderWallet(address(0x333)); assertEq(game.builderWallet(), address(0x333));
        vm.stopPrank();
    }

    function test_SetMaxScore_BoundsCheck() public {
        vm.startPrank(owner);
        vm.expectRevert("Out of range"); game.setMaxScore(0);
        vm.expectRevert("Out of range"); game.setMaxScore(1_000_000);
        vm.stopPrank();
    }

    function test_Setters_RevertZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Zero addr"); game.setTrustedSigner(address(0));
        vm.expectRevert("Zero addr"); game.setTreasury(address(0));
        vm.expectRevert("Zero addr"); game.setBuilderWallet(address(0));
        vm.expectRevert("Zero addr"); game.transferOwnership(address(0));
        vm.stopPrank();
    }

    // ============================================================
    //                       FUNDING
    // ============================================================

    function test_FundPool_IncreasesPool() public {
        uint256 before_ = game.rewardPool();
        vm.prank(player);
        game.fundPool{value: 0.3 ether}();
        assertEq(game.rewardPool() - before_, 0.3 ether);
    }

    function test_FundPool_RevertZero() public {
        vm.expectRevert(bytes("Zero"));
        vm.prank(player);
        game.fundPool{value: 0}();
    }

    function test_Receive_IncreasesPool() public {
        uint256 before_ = game.rewardPool();
        vm.prank(player);
        (bool ok, ) = address(game).call{value: 0.2 ether}("");
        assertTrue(ok);
        assertEq(game.rewardPool() - before_, 0.2 ether);
    }

    // ============================================================
    //                       WITHDRAW BUILDER
    // ============================================================

    function test_WithdrawBuilder_Works() public {
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 10}();
        uint256 bb = game.builderBalance();
        assertGt(bb, 0);

        uint256 balBefore = builder.balance;
        vm.prank(owner);
        game.withdrawBuilder(bb);
        assertEq(builder.balance - balBefore, bb);
        assertEq(game.builderBalance(), 0);
    }

    function test_WithdrawBuilder_RevertExceedBalance() public {
        vm.expectRevert("Insufficient");
        vm.prank(owner);
        game.withdrawBuilder(1 ether);
    }

    function test_WithdrawBuilder_OnlyOwner() public {
        vm.expectRevert("Not owner");
        vm.prank(player);
        game.withdrawBuilder(0);
    }

    // ============================================================
    //                       FORFEIT EDGE CASES
    // ============================================================

    function test_Forfeit_RevertNoActiveGame() public {
        vm.expectRevert("No active game");
        vm.prank(player);
        game.forfeitGame();
    }

    function test_StartGame_AfterForfeit_Works() public {
        vm.prank(player);
        game.buyQuota{value: PLAY_COST * 2}();
        vm.startPrank(player);
        game.startGame();
        game.forfeitGame();
        // Should be able to start a fresh game with remaining quota
        uint256 gid2 = game.startGame();
        vm.stopPrank();
        assertGt(gid2, 0);
        assertEq(game.activeGameId(player), gid2);
    }

    // ============================================================
    //                       VIEWS
    // ============================================================

    function test_GetPlayerInfo() public {
        vm.prank(player);
        game.claimFreeTrial();
        (uint256 q, bool ft, uint256 hs, uint256 gp, uint256 r) = game.getPlayerInfo(player);
        assertEq(q, 1);
        assertTrue(ft);
        assertEq(hs, 0);
        assertEq(gp, 0);
        assertEq(r, 0);
    }

    function test_HasActiveGame() public {
        assertFalse(game.hasActiveGame(player));
        vm.prank(player);
        game.claimFreeTrial();
        _startGame(player);
        assertTrue(game.hasActiveGame(player));
    }

    function test_GetPoolBalance_MatchesState() public {
        _fundPool(0.5 ether);
        assertEq(game.getPoolBalance(), game.rewardPool());
    }

    // ============================================================
    //                       SIGNATURE EDGE CASES
    // ============================================================

    function test_BadSigLength_Reverts() public {
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        vm.roll(block.number + 1);
        vm.expectRevert("Bad sig length");
        vm.prank(player);
        game.submitScoreAndClaim(gid, 1, block.timestamp + 60, hex"1234");
    }

    function test_NotYourGame_Reverts() public {
        vm.prank(player);
        game.claimFreeTrial();
        uint256 gid = _startGame(player);
        bytes memory sig = _signScore(player, gid, 1, block.timestamp + 60);
        vm.roll(block.number + 1);
        // player2 tries to submit player's gameId
        vm.expectRevert("Not your game");
        vm.prank(player2);
        game.submitScoreAndClaim(gid, 1, block.timestamp + 60, sig);
    }

    // ============================================================
    //                       FUZZ
    // ============================================================

    function testFuzz_BuyQuota_NeverInflatesPool(uint96 sent) public {
        vm.assume(sent >= PLAY_COST && sent <= 100 * PLAY_COST);
        uint256 quantity = uint256(sent) / PLAY_COST;
        uint256 paid = quantity * PLAY_COST;
        uint256 expectedPool = (paid * 7000) / 10000;

        vm.prank(player);
        game.buyQuota{value: sent}();

        assertEq(game.rewardPool(), expectedPool);
        assertEq(game.playQuota(player), quantity);
    }
}
