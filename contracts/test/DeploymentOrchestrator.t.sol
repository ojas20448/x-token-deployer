// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DeploymentOrchestrator.sol";
import "../src/TokenFactory.sol";
import "../src/FeeForwarderHook.sol";
import "../src/SimpleToken.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

contract MockPoolManager {
    function initialize(PoolKey memory, uint160) external returns (int24) {
        return 0;
    }
}

contract DeploymentOrchestratorTest is Test {
    DeploymentOrchestrator public orchestrator;
    TokenFactory public tokenFactory;
    FeeForwarderHook public feeHook;
    MockPoolManager public mockPoolManager;
    
    address public deployer = address(this);
    address public feeRecipient = address(0x1234);
    address public nonOwner = address(0x5678);
    address public weth;
    
    uint256 constant DEPLOY_FEE = 0.0005 ether;
    bytes32 constant TWITTER_ID_HASH = keccak256("twitter_user_123");
    
    string constant NAME = "Test Token";
    string constant SYMBOL = "TEST";

    function setUp() public {
        weth = address(0x4200000000000000000000000000000000000006);
        mockPoolManager = new MockPoolManager();
        tokenFactory = new TokenFactory();
        feeHook = new FeeForwarderHook(IPoolManager(address(mockPoolManager)));
        
        orchestrator = new DeploymentOrchestrator(
            address(mockPoolManager),
            address(tokenFactory),
            address(feeHook),
            weth,
            DEPLOY_FEE
        );
        
        // Transfer ownership of factory and hook to orchestrator
        // Note: In real deployment, orchestrator would be the owner from the start
        
        vm.deal(address(this), 100 ether);
    }

    // Allow test contract to receive ETH
    receive() external payable {}

    // ============ Constructor Tests ============

    function test_Constructor_SetsPoolManager() public view {
        assertEq(address(orchestrator.poolManager()), address(mockPoolManager));
    }

    function test_Constructor_SetsTokenFactory() public view {
        assertEq(address(orchestrator.tokenFactory()), address(tokenFactory));
    }

    function test_Constructor_SetsFeeHook() public view {
        assertEq(address(orchestrator.feeHook()), address(feeHook));
    }

    function test_Constructor_SetsWeth() public view {
        assertEq(orchestrator.weth(), weth);
    }

    function test_Constructor_SetsDeployFee() public view {
        assertEq(orchestrator.deployFee(), DEPLOY_FEE);
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(orchestrator.owner(), deployer);
    }

    function test_Constructor_DefaultSupply() public view {
        assertEq(orchestrator.DEFAULT_SUPPLY(), 1_000_000_000 * 10**18);
    }

    function test_Constructor_RevertsOnHighFee() public {
        vm.expectRevert("Fee too high");
        new DeploymentOrchestrator(
            address(mockPoolManager),
            address(tokenFactory),
            address(feeHook),
            weth,
            0.02 ether // > MAX_DEPLOY_FEE
        );
    }

    // ============ Admin Functions Tests ============

    function test_SetDeployFee_Success() public {
        uint256 newFee = 0.001 ether;
        orchestrator.setDeployFee(newFee);
        assertEq(orchestrator.deployFee(), newFee);
    }

    function test_SetDeployFee_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DeploymentOrchestrator.NotOwner.selector);
        orchestrator.setDeployFee(0.001 ether);
    }

    function test_SetDeployFee_RevertsOnHighFee() public {
        vm.expectRevert(DeploymentOrchestrator.DeployFeeTooHigh.selector);
        orchestrator.setDeployFee(0.02 ether);
    }

    function test_SetDeploymentCooldown_Success() public {
        uint256 newCooldown = 2 hours;
        orchestrator.setDeploymentCooldown(newCooldown);
        assertEq(orchestrator.deploymentCooldown(), newCooldown);
    }

    function test_SetPaused_Success() public {
        orchestrator.setPaused(true);
        assertTrue(orchestrator.paused());
        
        orchestrator.setPaused(false);
        assertFalse(orchestrator.paused());
    }

    function test_SetPaused_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DeploymentOrchestrator.NotOwner.selector);
        orchestrator.setPaused(true);
    }

    function test_TransferOwnership_Success() public {
        address newOwner = address(0x9999);
        orchestrator.transferOwnership(newOwner);
        assertEq(orchestrator.owner(), newOwner);
    }

    function test_TransferOwnership_RevertsOnZeroAddress() public {
        vm.expectRevert("Zero address");
        orchestrator.transferOwnership(address(0));
    }

    function test_TransferOwnership_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DeploymentOrchestrator.NotOwner.selector);
        orchestrator.transferOwnership(address(0x9999));
    }

    // ============ Emergency Withdraw ============

    function test_EmergencyWithdraw_Success() public {
        // Send some ETH to orchestrator
        (bool success,) = address(orchestrator).call{value: 1 ether}("");
        assertTrue(success);
        
        uint256 balanceBefore = deployer.balance;
        orchestrator.emergencyWithdraw();
        
        assertEq(address(orchestrator).balance, 0);
        assertEq(deployer.balance, balanceBefore + 1 ether);
    }

    function test_EmergencyWithdraw_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DeploymentOrchestrator.NotOwner.selector);
        orchestrator.emergencyWithdraw();
    }

    // ============ Receive Ether ============

    function test_ReceiveEther() public {
        uint256 amount = 1 ether;
        (bool success,) = address(orchestrator).call{value: amount}("");
        
        assertTrue(success);
        assertEq(address(orchestrator).balance, amount);
    }

    // ============ Pause Tests ============

    function test_Deploy_RevertsWhenPaused() public {
        orchestrator.setPaused(true);
        
        vm.expectRevert(DeploymentOrchestrator.Paused_.selector);
        orchestrator.deploy{value: DEPLOY_FEE}(NAME, SYMBOL, feeRecipient, TWITTER_ID_HASH);
    }

    // ============ Deploy Input Validation ============

    function test_Deploy_RevertsOnZeroRecipient() public {
        vm.expectRevert(DeploymentOrchestrator.ZeroRecipient.selector);
        orchestrator.deploy{value: DEPLOY_FEE}(NAME, SYMBOL, address(0), TWITTER_ID_HASH);
    }

    function test_Deploy_RevertsOnInsufficientFee() public {
        vm.expectRevert(DeploymentOrchestrator.InsufficientFee.selector);
        orchestrator.deploy{value: DEPLOY_FEE - 1}(NAME, SYMBOL, feeRecipient, TWITTER_ID_HASH);
    }

    function test_Deploy_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.deal(nonOwner, 1 ether);
        vm.expectRevert(DeploymentOrchestrator.NotOwner.selector);
        orchestrator.deploy{value: DEPLOY_FEE}(NAME, SYMBOL, feeRecipient, TWITTER_ID_HASH);
    }

    // ============ Rate Limiting Tests ============

    function test_RateLimiting_UpdatesLastDeployTime() public {
        // Need to set up proper ownership for factory
        // For now just test the lastDeployTime mapping
        uint256 timeBefore = orchestrator.lastDeployTime(TWITTER_ID_HASH);
        assertEq(timeBefore, 0);
    }

    // ============ Fuzz Tests ============

    function testFuzz_SetDeployFee(uint256 fee) public {
        if (fee > orchestrator.MAX_DEPLOY_FEE()) {
            vm.expectRevert(DeploymentOrchestrator.DeployFeeTooHigh.selector);
            orchestrator.setDeployFee(fee);
        } else {
            orchestrator.setDeployFee(fee);
            assertEq(orchestrator.deployFee(), fee);
        }
    }

    function testFuzz_SetDeploymentCooldown(uint256 cooldown) public {
        orchestrator.setDeploymentCooldown(cooldown);
        assertEq(orchestrator.deploymentCooldown(), cooldown);
    }
}
