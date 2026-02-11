// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {FeeForwarderHook} from "../src/FeeForwarderHook.sol";
import {DeploymentOrchestrator} from "../src/DeploymentOrchestrator.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

/**
 * @title Deploy
 * @notice Deployment script for X Deploy Bot contracts
 * 
 * For Base Sepolia testnet:
 * forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast
 * 
 * For Base mainnet:
 * forge script script/Deploy.s.sol --rpc-url https://mainnet.base.org --broadcast --verify
 */
contract Deploy is Script {
    // Base Sepolia testnet addresses
    address constant POOL_MANAGER_SEPOLIA = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;
    
    // Base mainnet addresses  
    address constant POOL_MANAGER_MAINNET = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant WETH_MAINNET = 0x4200000000000000000000000000000000000006;
    
    // Deploy fee: 0.0005 ETH
    uint256 constant DEPLOY_FEE = 500000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("BOT_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Determine network by chain ID
        address poolManager;
        address weth;
        string memory network;
        
        if (block.chainid == 84532) {
            // Base Sepolia
            poolManager = POOL_MANAGER_SEPOLIA;
            weth = WETH_SEPOLIA;
            network = "Base Sepolia";
        } else if (block.chainid == 8453) {
            // Base Mainnet
            poolManager = POOL_MANAGER_MAINNET;
            weth = WETH_MAINNET;
            network = "Base Mainnet";
        } else {
            revert("Unsupported chain ID");
        }
        
        console.log("Network:", network);
        console.log("Chain ID:", block.chainid);
        console.log("Deploying from:", deployer);
        console.log("PoolManager:", poolManager);
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TokenFactory
        TokenFactory tokenFactory = new TokenFactory();
        console.log("TokenFactory deployed:", address(tokenFactory));

        // 2. Deploy FeeForwarderHook
        // NOTE: In production, hook address must be mined using CREATE2
        // to have correct permission flags in the address.
        // For MVP, we deploy directly (hook permissions in address won't be set).
        FeeForwarderHook feeHook = new FeeForwarderHook(IPoolManager(poolManager));
        console.log("FeeForwarderHook deployed:", address(feeHook));

        // 3. Deploy DeploymentOrchestrator
        DeploymentOrchestrator orchestrator = new DeploymentOrchestrator(
            poolManager,
            address(tokenFactory),
            address(feeHook),
            weth,
            DEPLOY_FEE
        );
        console.log("DeploymentOrchestrator deployed:", address(orchestrator));

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("Network:                ", network);
        console.log("TokenFactory:           ", address(tokenFactory));
        console.log("FeeForwarderHook:       ", address(feeHook));
        console.log("DeploymentOrchestrator: ", address(orchestrator));
        console.log("=========================================\n");
        
        console.log("Add these to your backend/.env file:");
        console.log("TOKEN_FACTORY_ADDRESS=", address(tokenFactory));
        console.log("FEE_HOOK_ADDRESS=", address(feeHook));
        console.log("ORCHESTRATOR_ADDRESS=", address(orchestrator));
    }
}
