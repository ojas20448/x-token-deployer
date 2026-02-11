// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FeeForwarderHook.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

contract FeeForwarderHookTest is Test {
    using PoolIdLibrary for PoolKey;
    
    FeeForwarderHook public hook;
    address public mockPoolManager = address(0x1111);
    address public deployer = address(this);
    address public feeRecipient = address(0x2222);
    address public nonOwner = address(0x3333);
    
    // Mock addresses for pool key
    address public token0 = address(0x4444);
    address public token1 = address(0x5555);

    event FeeForwarded(PoolId indexed poolId, address indexed recipient, uint256 amount);
    event RecipientSet(PoolId indexed poolId, address indexed recipient);

    function setUp() public {
        hook = new FeeForwarderHook(IPoolManager(mockPoolManager));
        vm.deal(address(this), 100 ether);
    }

    function _createPoolKey() internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsPoolManager() public view {
        assertEq(address(hook.poolManager()), mockPoolManager);
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(hook.owner(), deployer);
    }

    // ============ SetFeeRecipient Tests ============

    function test_SetFeeRecipient_Success() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        
        hook.setFeeRecipient(key, feeRecipient);
        
        assertEq(hook.feeRecipients(poolId), feeRecipient);
    }

    function test_SetFeeRecipient_EmitsEvent() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        
        vm.expectEmit(true, true, false, false);
        emit RecipientSet(poolId, feeRecipient);
        hook.setFeeRecipient(key, feeRecipient);
    }

    function test_SetFeeRecipient_RevertsForNonOwner() public {
        PoolKey memory key = _createPoolKey();
        
        vm.prank(nonOwner);
        vm.expectRevert(FeeForwarderHook.NotOwner.selector);
        hook.setFeeRecipient(key, feeRecipient);
    }

    function test_SetFeeRecipient_RevertsOnZeroAddress() public {
        PoolKey memory key = _createPoolKey();
        
        vm.expectRevert(FeeForwarderHook.ZeroRecipient.selector);
        hook.setFeeRecipient(key, address(0));
    }

    // ============ ForwardFee Tests ============

    function test_ForwardFee_Success() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        uint256 feeAmount = 0.5 ether;
        
        hook.setFeeRecipient(key, feeRecipient);
        
        uint256 recipientBalanceBefore = feeRecipient.balance;
        hook.forwardFee{value: feeAmount}(poolId);
        
        assertEq(feeRecipient.balance, recipientBalanceBefore + feeAmount);
    }

    function test_ForwardFee_EmitsEvent() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        uint256 feeAmount = 0.5 ether;
        
        hook.setFeeRecipient(key, feeRecipient);
        
        vm.expectEmit(true, true, false, true);
        emit FeeForwarded(poolId, feeRecipient, feeAmount);
        hook.forwardFee{value: feeAmount}(poolId);
    }

    function test_ForwardFee_RevertsForNonOwner() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        
        hook.setFeeRecipient(key, feeRecipient);
        
        vm.prank(nonOwner);
        vm.deal(nonOwner, 1 ether);
        vm.expectRevert(FeeForwarderHook.NotOwner.selector);
        hook.forwardFee{value: 0.5 ether}(poolId);
    }

    function test_ForwardFee_RevertsOnNoRecipient() public {
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        // Don't set recipient
        
        vm.expectRevert(FeeForwarderHook.ZeroRecipient.selector);
        hook.forwardFee{value: 0.5 ether}(poolId);
    }

    // ============ beforeInitialize Hook Test ============

    function test_BeforeInitialize_ReturnsSelector() public {
        PoolKey memory key = _createPoolKey();
        
        vm.prank(mockPoolManager);
        bytes4 selector = hook.beforeInitialize(address(this), key, 79228162514264337593543950336);
        
        assertEq(selector, IHooks.beforeInitialize.selector);
    }

    function test_BeforeInitialize_RevertsForNonPoolManager() public {
        PoolKey memory key = _createPoolKey();
        
        vm.prank(nonOwner);
        vm.expectRevert(FeeForwarderHook.NotPoolManager.selector);
        hook.beforeInitialize(address(this), key, 79228162514264337593543950336);
    }

    // ============ Receive Ether ============

    function test_ReceiveEther() public {
        uint256 amount = 1 ether;
        (bool success,) = address(hook).call{value: amount}("");
        
        assertTrue(success);
        assertEq(address(hook).balance, amount);
    }

    // ============ Fuzz Tests ============

    function testFuzz_ForwardFee(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 10 ether);
        vm.deal(address(this), amount);
        
        PoolKey memory key = _createPoolKey();
        PoolId poolId = key.toId();
        
        hook.setFeeRecipient(key, feeRecipient);
        
        uint256 recipientBalanceBefore = feeRecipient.balance;
        hook.forwardFee{value: amount}(poolId);
        
        assertEq(feeRecipient.balance, recipientBalanceBefore + amount);
    }
}
