// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SimpleToken.sol";

/**
 * @title TokenFactory
 * @notice Deploys minimal ERC-20 tokens with fixed supply
 * @dev Only the bot (owner) can deploy tokens
 */
contract TokenFactory {
    address public immutable owner;
    
    event TokenDeployed(
        address indexed token,
        string name,
        string symbol,
        uint256 totalSupply,
        address indexed recipient
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "TokenFactory: not owner");
        _;
    }
    
    /**
     * @notice Deploy a new token
     * @param _name Token name
     * @param _symbol Token symbol (ticker)
     * @param _totalSupply Total supply (with 18 decimals)
     * @param _recipient Address to receive all tokens
     * @return token The deployed token address
     */
    function deployToken(
        string calldata _name,
        string calldata _symbol,
        uint256 _totalSupply,
        address _recipient
    ) external onlyOwner returns (address token) {
        require(_recipient != address(0), "TokenFactory: zero recipient");
        require(bytes(_name).length > 0, "TokenFactory: empty name");
        require(bytes(_symbol).length > 0, "TokenFactory: empty symbol");
        require(_totalSupply > 0, "TokenFactory: zero supply");
        
        SimpleToken newToken = new SimpleToken(
            _name,
            _symbol,
            _totalSupply,
            _recipient
        );
        
        token = address(newToken);
        
        emit TokenDeployed(token, _name, _symbol, _totalSupply, _recipient);
        
        return token;
    }
}
