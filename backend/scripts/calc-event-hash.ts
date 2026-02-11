import { keccak256, toBytes } from 'viem';

const sig = 'TokenCreated(address,address,string,string,uint256,uint256,address)';
const hash = keccak256(toBytes(sig));
console.log(`${sig} -> ${hash}`);
