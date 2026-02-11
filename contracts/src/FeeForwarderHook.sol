// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

/**
 * @title FeeForwarderHook
 * @notice Uniswap v4 hook that receives deploy fees and forwards to recipients
 * @dev MVP: Only handles fee forwarding, no trading/LP logic
 * 
 * IMPORTANT: Hook addresses in Uniswap v4 encode their permissions in the address.
 * This contract must be deployed to an address with the correct flags using CREATE2.
 * For MVP, we only need beforeInitialize flag.
 */
contract FeeForwarderHook is IHooks {
    using PoolIdLibrary for PoolKey;
    
    IPoolManager public immutable poolManager;
    address public immutable owner;
    
    // Mapping from poolId to fee recipient
    mapping(PoolId => address) public feeRecipients;
    
    event FeeForwarded(PoolId indexed poolId, address indexed recipient, uint256 amount);
    event RecipientSet(PoolId indexed poolId, address indexed recipient);
    
    error NotOwner();
    error NotPoolManager();
    error ZeroRecipient();
    error TransferFailed();
    
    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }
    
    /**
     * @notice Set fee recipient for a pool (called before pool initialization)
     * @param key The pool key
     * @param recipient The address to receive deploy fee
     */
    function setFeeRecipient(PoolKey calldata key, address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroRecipient();
        PoolId poolId = key.toId();
        feeRecipients[poolId] = recipient;
        emit RecipientSet(poolId, recipient);
    }
    
    /**
     * @notice Forward ETH deploy fee to recipient
     * @param poolId The pool ID
     */
    function forwardFee(PoolId poolId) external payable onlyOwner {
        address recipient = feeRecipients[poolId];
        if (recipient == address(0)) revert ZeroRecipient();
        
        uint256 amount = msg.value;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FeeForwarded(poolId, recipient, amount);
    }
    
    // ============ Hook Callbacks ============
    
    function beforeInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external override onlyPoolManager returns (bytes4) {
        // MVP: Just allow initialization, fee forwarding happens separately
        return IHooks.beforeInitialize.selector;
    }
    
    function afterInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tick
    ) external override onlyPoolManager returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }
    
    // ============ Unused Hook Callbacks (return selectors to pass) ============
    
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }
    
    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata hookData
    ) external override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }
    
    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }
    
    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata hookData
    ) external override returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }
    
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }
    
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        return (IHooks.afterSwap.selector, 0);
    }
    
    function beforeDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external override returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }
    
    function afterDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external override returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
    
    receive() external payable {}
}
