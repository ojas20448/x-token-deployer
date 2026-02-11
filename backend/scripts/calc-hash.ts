import { keccak256, toBytes, sliceHex } from 'viem';

const signatures = [
    'createToken(string,string,string,string)',
    'createToken(string,string,string,string,uint256)',
    'createToken(string,string,string,string,uint256,uint256)',
    'create(string,string,string,string)',
    'create(string,string,uint256,string,string)',
    'launch(string,string,string,string)',
    'mint(string,string,string,string)',
    'createToken(string,string,uint256,string,string)',
    'createToken(string,string,uint256,string,string,address)',
    'createToken(string,string,uint256,string,string,address,uint256)',
];

for (const sig of signatures) {
    const hash = keccak256(toBytes(sig));
    const selector = sliceHex(hash, 0, 4);
    console.log(`${sig} -> ${selector}`);
}
