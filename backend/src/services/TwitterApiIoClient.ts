import { config } from '../config/index.js';

interface TwitterApiIoTweet {
    id: string;
    text: string;
    author: {
        id: string;
        userName: string;
        name: string;
    };
    createdAt: string;
    inReplyToId?: string | null;
    isReply?: boolean;
    quotedTweet?: { id: string };
    retweetedTweet?: { id: string };
}

interface TwitterApiIoResponse {
    tweets?: TwitterApiIoTweet[];
    has_next_page?: boolean;
    next_cursor?: string;
}

interface LoginV2Response {
    code?: number;
    msg?: string;
    // Actual response fields observed
    status?: string;
    message?: string;
    login_cookie?: string;
    login_cookies?: string; // API returns this plural form
}

interface CreateTweetResponse {
    code: number;
    msg: string;
    data?: {
        tweet_id?: string;
        id?: string;
    };
    message?: string; // Add message field for error handling
    status?: string; // Add status field for success handling (e.g. "success")
}

/**
 * Client for twitterapi.io - Third-party Twitter API proxy
 * Docs: https://docs.twitterapi.io
 * 
 * Supports:
 * - Read operations (search, get tweets) - uses API key
 * - Write operations (post tweets) - uses login session
 */
export class TwitterApiIoClient {
    private readonly baseUrl = 'https://api.twitterapi.io';
    private readonly apiKey: string;
    private loginCookie: string | null = null;
    private loginExpiry: Date | null = null;

    constructor() {
        if (!config.TWITTERAPI_IO_KEY) {
            throw new Error('TWITTERAPI_IO_KEY not configured');
        }
        this.apiKey = config.TWITTERAPI_IO_KEY;
    }

    private async request<T>(method: string, path: string, body?: object, useLoginCookie = false): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
        };

        // Add login cookie for write operations
        if (useLoginCookie && this.loginCookie) {
            headers['X-Login-Cookie'] = this.loginCookie;
        }

        const options: RequestInit = {
            method,
            headers,
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`TwitterApiIo request failed: ${response.status} ${response.statusText} - ${text}`);
        }
        return response.json() as Promise<T>;
    }

    /**
     * Check if we have a valid login session
     */
    private hasValidSession(): boolean {
        if (!this.loginCookie || !this.loginExpiry) {
            return false;
        }
        // Consider session valid if we have at least 5 minutes left
        return new Date() < new Date(this.loginExpiry.getTime() - 5 * 60 * 1000);
    }

    /**
     * Login using login_v2 endpoint to get session cookie for posting
     * Requires: username, email, password, and optionally 2FA secret
     */
    async login(): Promise<boolean> {
        console.log('🔐 Logging into Twitter via twitterapi.io...');

        if (!config.TWITTER_LOGIN_USERNAME || !config.TWITTER_LOGIN_EMAIL || !config.TWITTER_LOGIN_PASSWORD) {
            console.error('❌ Twitter login credentials not configured');
            console.error('   Required: TWITTER_LOGIN_USERNAME, TWITTER_LOGIN_EMAIL, TWITTER_LOGIN_PASSWORD');
            return false;
        }

        try {
            const loginPayload: Record<string, string> = {
                user_name: config.TWITTER_LOGIN_USERNAME,
                email: config.TWITTER_LOGIN_EMAIL,
                password: config.TWITTER_LOGIN_PASSWORD,
            };

            // Add 2FA secret if configured and not empty
            if (config.TWITTER_2FA_SECRET && config.TWITTER_2FA_SECRET.trim() !== '') {
                loginPayload.totp_secret = config.TWITTER_2FA_SECRET;
            }

            // Add proxy (required by twitterapi.io)
            if (config.TWITTER_PROXY) {
                loginPayload.proxy = config.TWITTER_PROXY;
            } else {
                console.error('❌ TWITTER_PROXY not configured (required for login)');
                return false;
            }

            console.log('🔍 Login payload:', JSON.stringify({ ...loginPayload, password: '***' }, null, 2));

            const result = await this.request<LoginV2Response>(
                'POST',
                '/twitter/user_login_v2',
                loginPayload
            );

            console.log('🔍 Login response:', JSON.stringify(result, null, 2));

            // Check for success via code (0/200) OR status ('success')
            if (result.code === 200 || result.code === 0 || result.status === 'success') {
                // Some endpoints return login_cookie, some login_cookies
                const cookie = result.login_cookie || result.login_cookies;

                if (cookie) {
                    this.loginCookie = cookie;
                    // Session typically valid for ~24 hours, set expiry to 12 hours to be safe
                    this.loginExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000);
                    console.log('✅ Login successful! Session cookie obtained.');
                    return true;
                } else {
                    console.error('❌ Login succeeded but no cookie received');
                    return false;
                }
            } else {
                console.error(`❌ Login failed: ${result.msg || result.message}`);
                return false;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Login error: ${errorMsg}`);
            return false;
        }
    }

    /**
     * Ensure we have a valid login session, login if needed
     */
    private async ensureLoggedIn(): Promise<boolean> {
        if (this.hasValidSession()) {
            return true;
        }
        const success = await this.login();
        if (success) {
            console.log('⏳ Waiting 6s after login to respect rate limits...');
            await new Promise(resolve => setTimeout(resolve, 6000));
        }
        return success;
    }

    /**
     * Register a username for tweet monitoring
     */
    async registerUserForMonitoring(username: string): Promise<void> {
        console.log(`📡 Registering @${username} for monitoring...`);
        const result = await this.request<{ code: number; msg: string }>(
            'POST',
            '/oapi/x_user_stream/add_user_to_monitor_tweet',
            { x_user_name: username }
        );
        if (result.code !== 200 && result.code !== 0) {
            console.warn(`⚠️ Registration response: ${result.msg}`);
        } else {
            console.log(`✅ @${username} registered for monitoring`);
        }
    }

    /**
     * Get list of monitored users
     */
    async getMonitoredUsers(): Promise<string[]> {
        const result = await this.request<{ code: number; data?: { users?: string[] } }>(
            'GET',
            '/oapi/x_user_stream/get_user_to_monitor_tweet'
        );
        return result.data?.users || [];
    }

    /**
     * Fetch tweets mentioning the bot using advanced search
     */
    async getTweets(botUsername: string): Promise<TwitterApiIoTweet[]> {
        // Use advanced search to find mentions of the bot
        const query = encodeURIComponent(`@${botUsername} deploy`);
        const result = await this.request<TwitterApiIoResponse>(
            'GET',
            `/twitter/tweet/advanced_search?query=${query}&queryType=Latest`
        );
        return result.tweets || [];
    }

    /**
     * Post a reply to a tweet using twitterapi.io
     * Uses login_v2 session for authentication
     */
    async postReply(text: string, replyToTweetId: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        console.log(`📤 Posting reply via twitterapi.io to tweet ${replyToTweetId}...`);

        // Ensure we have a valid session
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
            return { success: false, error: 'Failed to login to Twitter' };
        }

        try {
            const result = await this.request<CreateTweetResponse>(
                'POST',
                '/twitter/create_tweet_v2',
                {
                    tweet_text: text,
                    reply_to_tweet_id: replyToTweetId,
                    login_cookies: this.loginCookie,
                    proxy: config.TWITTER_PROXY,
                },
                true // Use login cookie in headers
            );

            console.log('🔍 Post reply response:', JSON.stringify(result, null, 2));

            if (result.code === 200 || result.code === 0 || result.status === 'success') {
                const tweetId = result.data?.tweet_id || result.data?.id || (result as any).tweet_id;
                console.log(`✅ Reply posted successfully! Tweet ID: ${tweetId}`);
                return { success: true, tweetId };
            } else {
                const errorMsg = result.msg || result.message || (result as any).error || 'Unknown error';
                console.error(`❌ Failed to post reply: ${errorMsg}`);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error posting reply: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Post a tweet (not a reply) using twitterapi.io
     * Uses login_v2 session for authentication
     */
    async postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
        console.log(`📤 Posting tweet via twitterapi.io...`);

        // Ensure we have a valid session
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
            return { success: false, error: 'Failed to login to Twitter' };
        }

        try {
            const result = await this.request<CreateTweetResponse>(
                'POST',
                '/twitter/create_tweet_v2',
                {
                    tweet_text: text,
                    login_cookies: this.loginCookie,
                    proxy: config.TWITTER_PROXY,
                },
                true // Use login cookie in headers
            );

            console.log('🔍 Post tweet response:', JSON.stringify(result, null, 2));

            if (result.code === 200 || result.code === 0 || result.status === 'success') {
                const tweetId = result.data?.tweet_id || result.data?.id || (result as any).tweet_id;
                console.log(`✅ Tweet posted successfully! Tweet ID: ${tweetId}`);
                return { success: true, tweetId };
            } else {
                const errorMsg = result.msg || result.message || (result as any).error || 'Unknown error';
                console.error(`❌ Failed to post tweet: ${errorMsg}`);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error posting tweet: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }


    /**
     * Get Direct Messages
     */
    async getDMs(): Promise<{ id: string; sender_id: string; text: string; created_at: string }[]> {
        // Ensure we have a valid session
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
            console.error('❌ Failed to login to Twitter for getting DMs');
            return [];
        }

        try {
            // Note: Endpoint might be different, using likely v2 endpoint based on docs search
            const result = await this.request<{
                code: number;
                msg: string;
                conversation_events?: {
                    event: {
                        type: string;
                        id: string;
                        created_timestamp: string;
                        message_create?: {
                            target: { recipient_id: string };
                            sender_id: string;
                            source_app_id: string;
                            message_data: {
                                text: string;
                                entities: { hashtags: any[]; symbols: any[]; user_mentions: any[]; urls: any[] };
                            };
                        };
                    };
                }[];
            }>(
                'GET',
                '/twitter/direct_message/list', // Typical endpoint pattern
                undefined,
                true // Use login cookie
            );

            if (result.code !== 200 && result.code !== 0) {
                console.warn(`⚠️ Failed to fetch DMs: ${result.msg}`);
                return [];
            }

            if (!result.conversation_events) return [];

            return result.conversation_events
                .filter(e => e.event.type === 'message_create' && e.event.message_create)
                .map(e => ({
                    id: e.event.id,
                    sender_id: e.event.message_create!.sender_id,
                    text: e.event.message_create!.message_data.text,
                    created_at: new Date(parseInt(e.event.created_timestamp)).toISOString(),
                }));

        } catch (error) {
            console.error('❌ Error fetching DMs:', error);
            // Fallback to empty list
            return [];
        }
    }

    /**
     * Send a Direct Message
     */
    async sendDM(recipientId: string, text: string): Promise<{ success: boolean; error?: string }> {
        console.log(`📤 Sending DM to ${recipientId}...`);

        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
            return { success: false, error: 'Failed to login to Twitter' };
        }

        try {
            const result = await this.request<{ code: number; msg: string; status?: string }>(
                'POST',
                '/twitter/send_dm', // Likely endpoint
                {
                    conversation_id: `${recipientId}-${config.TWITTER_USER_ID}`, // Or just recipient_id depending on API
                    recipient_id: recipientId,
                    text: text,
                    login_cookies: this.loginCookie,
                    proxy: config.TWITTER_PROXY,
                },
                true
            );

            console.log('🔍 Send DM response:', JSON.stringify(result, null, 2));

            if (result.code === 200 || result.code === 0 || result.status === 'success') {
                console.log(`✅ DM sent successfully to ${recipientId}`);
                return { success: true };
            } else {
                return { success: false, error: result.msg || result.status || 'Unknown error' };
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error sending DM: ${msg}`);
            return { success: false, error: msg };
        }
    }
}

// Export tweet type for use elsewhere
export type { TwitterApiIoTweet };
