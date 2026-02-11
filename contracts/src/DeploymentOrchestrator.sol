// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

import "./TokenFactory.sol";
import "./FeeForwarderHook.sol";

/**
 * @title DeploymentOrchestrator
 * @notice Single entry point for bot to deploy token + initialize Uniswap v4 pool
 * @dev Handles the entire deployment flow in a single transaction
 */
contract DeploymentOrchestrator {
    using PoolIdLibrary for PoolKey;
    
    IPoolManager public immutable poolManager;
    TokenFactory public immutable tokenFactory;
    FeeForwarderHook public immutable feeHook;
    address public immutable weth;
    address public owner;
    
    // Default token supply: 1 billion tokens with 18 decimals
    uint256 public constant DEFAULT_SUPPLY = 1_000_000_000 * 10**18;
    
    // Deploy fee configuration
    uint256 public deployFee;
    uint256 public constant MAX_DEPLOY_FEE = 0.01 ether; // Hard cap < $1 at most ETH prices
    
    // Emergency pause
    bool public paused;
    
    // Rate limiting per Twitter ID (stored as hash)
    mapping(bytes32 => uint256) public lastDeployTime;
    uint256 public deploymentCooldown = 1 hours;
    
    event Deployed(
        address indexed token,
        PoolId indexed poolId,
        string name,
        string symbol,
        address indexed feeRecipient,
        uint256 feeAmount
    );
    
    event DeployFeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event Paused(bool isPaused);
    
    error NotOwner();
    error Paused_();
    error RateLimited();
    error DeployFeeTooHigh();
    error InsufficientFee();
    error ZeroRecipient();
    error TransferFailed();
    
    constructor(
        address _poolManager,
        address _tokenFactory,
        address _feeHook,
        address _weth,
        uint256 _deployFee
    ) {
        require(_deployFee <= MAX_DEPLOY_FEE, "Fee too high");
        
        poolManager = IPoolManager(_poolManager);
        tokenFactory = TokenFactory(_tokenFactory);
        feeHook = FeeForwarderHook(payable(_feeHook));
        weth = _weth;
        deployFee = _deployFee;
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier notPaused() {
        if (paused) revert Paused_();
        _;
    }
    
    /**
     * @notice Deploy a token and initialize a Uniswap v4 pool
     * @param name Token name
     * @param symbol Token symbol (ticker)
     * @param feeRecipient Address to receive the deploy fee (original tweet author)
     * @param twitterIdHash Hash of the deployer's Twitter ID for rate limiting
     * @return token The deployed token address
     * @return poolId The Uniswap v4 pool ID
     */
    function deploy(
        string calldata name,
        string calldata symbol,
        address feeRecipient,
        bytes32 twitterIdHash
    ) external payable onlyOwner notPaused returns (address token, PoolId poolId) {
        // Validate inputs
        if (feeRecipient == address(0)) revert ZeroRecipient();
        if (msg.value < deployFee) revert InsufficientFee();
        
        // Rate limiting
        if (block.timestamp < lastDeployTime[twitterIdHash] + deploymentCooldown) {
            revert RateLimited();
        }
        lastDeployTime[twitterIdHash] = block.timestamp;
        
        // 1. Deploy token - all tokens go to the bot wallet initially
        token = tokenFactory.deployToken(
            name,
            symbol,
            DEFAULT_SUPPLY,
            msg.sender // Bot wallet receives all tokens
        );
        
        // 2. Create pool key
        // Tokens must be sorted: lower address first
        (Currency currency0, Currency currency1) = token < weth
            ? (Currency.wrap(token), Currency.wrap(weth))
            : (Currency.wrap(weth), Currency.wrap(token));
        
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 0, // Zero fee pool
            tickSpacing: 60, // Standard tick spacing
            hooks: IHooks(address(feeHook))
        });
        
        poolId = key.toId();
        
        // 3. Set fee recipient in hook before initialization
        feeHook.setFeeRecipient(key, feeRecipient);
        
        // 4. Initialize pool with starting price (1:1 for simplicity)
        // sqrtPriceX96 = sqrt(1) * 2^96 = 2^96
        uint160 sqrtPriceX96 = 79228162514264337593543950336; // 1:1 price
        poolManager.initialize(key, sqrtPriceX96);
        
        // 5. Forward deploy fee to recipient
        if (deployFee > 0) {
            feeHook.forwardFee{value: deployFee}(poolId);
        }
        
        // 6. Refund excess ETH
        uint256 excess = msg.value - deployFee;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            if (!success) revert TransferFailed();
        }
        
        emit Deployed(token, poolId, name, symbol, feeRecipient, deployFee);
        
        return (token, poolId);
    }
    
    // ============ Admin Functions ============
    
    function setDeployFee(uint256 _newFee) external onlyOwner {
        if (_newFee > MAX_DEPLOY_FEE) revert DeployFeeTooHigh();
        uint256 oldFee = deployFee;
        deployFee = _newFee;
        emit DeployFeeUpdated(oldFee, _newFee);
    }
    
    function setDeploymentCooldown(uint256 _cooldown) external onlyOwner {
        deploymentCooldown = _cooldown;
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @notice Emergency withdraw stuck ETH
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    receive() external payable {}
}
