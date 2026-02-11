// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SimpleToken.sol";

contract SimpleTokenTest is Test {
    SimpleToken public token;
    address public recipient = address(0x1234);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    
    string constant NAME = "Test Token";
    string constant SYMBOL = "TEST";
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    function setUp() public {
        token = new SimpleToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsName() public view {
        assertEq(token.name(), NAME);
    }

    function test_Constructor_SetsSymbol() public view {
        assertEq(token.symbol(), SYMBOL);
    }

    function test_Constructor_SetsDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_Constructor_SetsTotalSupply() public view {
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_Constructor_MintsToRecipient() public view {
        assertEq(token.balanceOf(recipient), TOTAL_SUPPLY);
    }

    function test_Constructor_EmitsTransferEvent() public {
        vm.expectEmit(true, true, false, true);
        emit SimpleToken.Transfer(address(0), alice, TOTAL_SUPPLY);
        new SimpleToken(NAME, SYMBOL, TOTAL_SUPPLY, alice);
    }

    // ============ Transfer Tests ============

    function test_Transfer_Success() public {
        uint256 amount = 100 * 10**18;
        vm.prank(recipient);
        bool success = token.transfer(alice, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(recipient), TOTAL_SUPPLY - amount);
    }

    function test_Transfer_EmitsEvent() public {
        uint256 amount = 100 * 10**18;
        vm.prank(recipient);
        
        vm.expectEmit(true, true, false, true);
        emit SimpleToken.Transfer(recipient, alice, amount);
        token.transfer(alice, amount);
    }

    function test_Transfer_RevertsOnInsufficientBalance() public {
        uint256 amount = TOTAL_SUPPLY + 1;
        vm.prank(recipient);
        
        vm.expectRevert("ERC20: insufficient balance");
        token.transfer(alice, amount);
    }

    function test_Transfer_RevertsOnZeroAddressTo() public {
        vm.prank(recipient);
        
        vm.expectRevert("ERC20: transfer to zero address");
        token.transfer(address(0), 100);
    }

    function test_Transfer_RevertsFromZeroAddress() public {
        vm.prank(address(0));
        
        vm.expectRevert("ERC20: transfer from zero address");
        token.transfer(alice, 100);
    }

    // ============ Approve Tests ============

    function test_Approve_Success() public {
        uint256 amount = 100 * 10**18;
        vm.prank(recipient);
        bool success = token.approve(alice, amount);
        
        assertTrue(success);
        assertEq(token.allowance(recipient, alice), amount);
    }

    function test_Approve_EmitsEvent() public {
        uint256 amount = 100 * 10**18;
        vm.prank(recipient);
        
        vm.expectEmit(true, true, false, true);
        emit SimpleToken.Approval(recipient, alice, amount);
        token.approve(alice, amount);
    }

    function test_Approve_CanSetToMaxUint() public {
        vm.prank(recipient);
        token.approve(alice, type(uint256).max);
        
        assertEq(token.allowance(recipient, alice), type(uint256).max);
    }

    // ============ TransferFrom Tests ============

    function test_TransferFrom_Success() public {
        uint256 amount = 100 * 10**18;
        
        vm.prank(recipient);
        token.approve(alice, amount);
        
        vm.prank(alice);
        bool success = token.transferFrom(recipient, bob, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(bob), amount);
        assertEq(token.balanceOf(recipient), TOTAL_SUPPLY - amount);
        assertEq(token.allowance(recipient, alice), 0);
    }

    function test_TransferFrom_DoesNotDecrementMaxAllowance() public {
        uint256 amount = 100 * 10**18;
        
        vm.prank(recipient);
        token.approve(alice, type(uint256).max);
        
        vm.prank(alice);
        token.transferFrom(recipient, bob, amount);
        
        // Max allowance should remain unchanged
        assertEq(token.allowance(recipient, alice), type(uint256).max);
    }

    function test_TransferFrom_RevertsOnInsufficientAllowance() public {
        uint256 amount = 100 * 10**18;
        
        vm.prank(recipient);
        token.approve(alice, amount - 1);
        
        vm.prank(alice);
        vm.expectRevert("ERC20: insufficient allowance");
        token.transferFrom(recipient, bob, amount);
    }

    // ============ Fuzz Tests ============

    function testFuzz_Transfer(uint256 amount) public {
        vm.assume(amount <= TOTAL_SUPPLY);
        
        vm.prank(recipient);
        token.transfer(alice, amount);
        
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(recipient), TOTAL_SUPPLY - amount);
    }

    function testFuzz_TransferFrom(uint256 amount) public {
        vm.assume(amount <= TOTAL_SUPPLY);
        
        vm.prank(recipient);
        token.approve(alice, amount);
        
        vm.prank(alice);
        token.transferFrom(recipient, bob, amount);
        
        assertEq(token.balanceOf(bob), amount);
    }
}
