// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TokenFactory.sol";
import "../src/SimpleToken.sol";

contract TokenFactoryTest is Test {
    TokenFactory public factory;
    address public deployer = address(this);
    address public recipient = address(0x1234);
    address public nonOwner = address(0x5678);
    
    string constant NAME = "Test Token";
    string constant SYMBOL = "TEST";
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    event TokenDeployed(
        address indexed token,
        string name,
        string symbol,
        uint256 totalSupply,
        address indexed recipient
    );

    function setUp() public {
        factory = new TokenFactory();
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsOwner() public view {
        assertEq(factory.owner(), deployer);
    }

    // ============ DeployToken Tests ============

    function test_DeployToken_Success() public {
        address token = factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
        
        assertTrue(token != address(0));
        
        SimpleToken deployedToken = SimpleToken(token);
        assertEq(deployedToken.name(), NAME);
        assertEq(deployedToken.symbol(), SYMBOL);
        assertEq(deployedToken.totalSupply(), TOTAL_SUPPLY);
        assertEq(deployedToken.balanceOf(recipient), TOTAL_SUPPLY);
    }

    function test_DeployToken_EmitsEvent() public {
        vm.expectEmit(false, true, false, true);
        emit TokenDeployed(address(0), NAME, SYMBOL, TOTAL_SUPPLY, recipient);
        factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
    }

    function test_DeployToken_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert("TokenFactory: not owner");
        factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
    }

    function test_DeployToken_RevertsOnZeroRecipient() public {
        vm.expectRevert("TokenFactory: zero recipient");
        factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, address(0));
    }

    function test_DeployToken_RevertsOnEmptyName() public {
        vm.expectRevert("TokenFactory: empty name");
        factory.deployToken("", SYMBOL, TOTAL_SUPPLY, recipient);
    }

    function test_DeployToken_RevertsOnEmptySymbol() public {
        vm.expectRevert("TokenFactory: empty symbol");
        factory.deployToken(NAME, "", TOTAL_SUPPLY, recipient);
    }

    function test_DeployToken_RevertsOnZeroSupply() public {
        vm.expectRevert("TokenFactory: zero supply");
        factory.deployToken(NAME, SYMBOL, 0, recipient);
    }

    // ============ Multiple Deployments ============

    function test_DeployToken_MultipleDifferentAddresses() public {
        address token1 = factory.deployToken("Token1", "TK1", TOTAL_SUPPLY, recipient);
        address token2 = factory.deployToken("Token2", "TK2", TOTAL_SUPPLY, recipient);
        address token3 = factory.deployToken("Token3", "TK3", TOTAL_SUPPLY, recipient);
        
        assertTrue(token1 != token2);
        assertTrue(token2 != token3);
        assertTrue(token1 != token3);
    }

    function test_DeployToken_SameNameSymbol_DifferentAddresses() public {
        // Deploying with same name/symbol should still create different addresses
        address token1 = factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
        address token2 = factory.deployToken(NAME, SYMBOL, TOTAL_SUPPLY, recipient);
        
        assertTrue(token1 != token2);
    }

    // ============ Fuzz Tests ============

    function testFuzz_DeployToken(
        string calldata name,
        string calldata symbol,
        uint256 supply,
        address recipientAddr
    ) public {
        vm.assume(bytes(name).length > 0);
        vm.assume(bytes(symbol).length > 0);
        vm.assume(supply > 0);
        vm.assume(recipientAddr != address(0));
        
        address token = factory.deployToken(name, symbol, supply, recipientAddr);
        
        SimpleToken deployedToken = SimpleToken(token);
        assertEq(deployedToken.name(), name);
        assertEq(deployedToken.symbol(), symbol);
        assertEq(deployedToken.totalSupply(), supply);
        assertEq(deployedToken.balanceOf(recipientAddr), supply);
    }
}
