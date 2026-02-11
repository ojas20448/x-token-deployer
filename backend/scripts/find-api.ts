import axios from 'axios';

const baseURLs = [
    'https://four.meme/meme-api',
    'https://four.meme/api',
    'https://api.four.meme',
    'https://api.four.meme/v1',
    'https://www.four.meme/meme-api',
    'https://meme-api.four.meme',
    'https://backend.four.meme',
];

async function testEndpoints() {
    console.log('Testing API endpoints for /v1/auth/nonce...');

    for (const url of baseURLs) {
        try {
            console.log(`Trying ${url}/v1/auth/nonce...`);
            const res = await axios.get(`${url}/v1/auth/nonce`, {
                timeout: 3000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            console.log(`✅ Success: ${url}`);
            console.log('Response:', res.data);
            return;
        } catch (error: any) {
            console.log(`❌ Failed: ${url} - ${error.message} ${error.response ? error.response.status : ''}`);
        }
    }
}

testEndpoints();
