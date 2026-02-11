import { keccak256, toBytes, sliceHex } from 'viem';

const sig = 'createToken(bytes,bytes,string,string,string,string)';
const hash = keccak256(toBytes(sig));
const selector = sliceHex(hash, 0, 4);
console.log(`${sig} -> ${selector}`);
