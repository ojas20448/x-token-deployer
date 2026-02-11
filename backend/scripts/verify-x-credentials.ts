import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
    console.log('🔍 Verifying X API Credentials...');

    const appKey = process.env.X_API_KEY;
    const appSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_SECRET;
    const bearerToken = process.env.X_BEARER_TOKEN;

    if (!appKey || !appSecret || !accessToken || !accessSecret || !bearerToken) {
        console.error('❌ Missing credentials in .env');
        return;
    }

    // 1. Test User Context (Access Token)
    console.log('\n👤 Testing User Context (Read/Write)...');
    try {
        const userClient = new TwitterApi({
            appKey,
            appSecret,
            accessToken,
            accessSecret,
        });
        const me = await userClient.v2.me();
        console.log(`✅ User Context Valid! Logged in as: @${me.data.username} (ID: ${me.data.id})`);
    } catch (error: any) {
        console.error('❌ User Context Failed:', error.message || error);
        if (error.code === 401 || error.code === 403) {
            console.error('   -> Credentials likely incorrect or App details mismatch.');
        }
    }

    // 2. Test App Context (Bearer Token)
    console.log('\n🤖 Testing App Context (Stream/Read)...');
    try {
        const appClient = new TwitterApi(bearerToken);
        const rules = await appClient.v2.streamRules();
        console.log(`✅ App Context Valid! Found ${rules.data?.length || 0} stream rules.`);
    } catch (error: any) {
        console.error('❌ App Context Failed:', error.message || error);
        if (error.code === 401) {
            console.error('   -> Bearer Token likely incorrect.');

            // Attempt to regenerate
            console.log('\n🔄 Attempting to regenerate Bearer Token via Consumer Keys...');
            try {
                const tempClient = new TwitterApi({ appKey, appSecret });
                const newBearer = await tempClient.appLogin(); // Generates valid Bearer
                console.log('✅ RECOVERY SUCCESSFUL! Generated new Bearer Token.');
                console.log('   Response:', JSON.stringify(newBearer, null, 2));
            } catch (genError: any) {
                console.error('❌ Regeneration Failed:', genError.message);
            }

        } else if (error.code === 403) {
            console.error('   -> Access Forbidden. You are likely on the FREE TIER.');
            console.error('   -> Free Tier DOES NOT support Filtered Stream (Listening).');
            console.error('   -> Solution: Upgrade to BASIC TIER ($100/mo) or use Mock Mode.');
        }
    }
}

main().catch(console.error);
