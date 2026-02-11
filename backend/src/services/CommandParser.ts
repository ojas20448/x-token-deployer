import { z } from 'zod';
import type { DeployCommand } from '../types/index.js';

/**
 * CommandParser - Strictly parses deploy commands from tweet text
 * 
 * Valid format:
 * @botname deploy
 * ticker: XXXX
 * name: YYYY
 */
export class CommandParser {
    private botUsername: string;

    // Validation schemas
    private tickerSchema = z.string()
        .min(1, 'Ticker too short')
        .max(10, 'Ticker too long')
        .regex(/^[A-Z0-9]+$/i, 'Ticker must be alphanumeric');

    private nameSchema = z.string()
        .min(1, 'Name too short')
        .max(50, 'Name too long')
        .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Name contains invalid characters');

    constructor(botUsername: string) {
        this.botUsername = botUsername.toLowerCase();
    }

    /**
     * Parse a deploy command from tweet text
     * @param text The tweet text
     * @returns Parsed command or null if invalid
     */
    parse(text: string): DeployCommand | null {
        try {
            // Normalize text
            const normalized = text.trim().toLowerCase();

            // Check for bot mention and deploy keyword
            if (!normalized.includes(`@${this.botUsername}`) || !normalized.includes('deploy')) {
                return null;
            }

            let ticker: string | null = null;
            let name: string | null = null;

            // Try structured format first: ticker: XXX / name: YYY
            const tickerMatch = text.match(/ticker\s*:\s*(\S+)/i);
            const nameMatch = text.match(/name\s*:\s*([A-Za-z0-9\s\-_.]+?)(?:\n|$)/i);

            if (tickerMatch && nameMatch) {
                ticker = tickerMatch[1].trim().toUpperCase();
                name = nameMatch[1].trim();
            } else {
                // Fallback: Simple format `@bot deploy TICKER TokenName`
                // Match: @botname deploy TICKER REST_OF_LINE
                const simpleMatch = text.match(/@\w+\s+deploy\s+(\S+)\s+(.+)/i);
                if (simpleMatch) {
                    ticker = simpleMatch[1].trim().toUpperCase();
                    name = simpleMatch[2].trim();
                }
            }

            if (!ticker) {
                console.log('❌ No ticker found in command');
                return null;
            }
            if (!name) {
                console.log('❌ No name found in command');
                return null;
            }

            // Validate
            const tickerResult = this.tickerSchema.safeParse(ticker);
            if (!tickerResult.success) {
                console.log(`❌ Invalid ticker: ${tickerResult.error.message}`);
                return null;
            }

            const nameResult = this.nameSchema.safeParse(name);
            if (!nameResult.success) {
                console.log(`❌ Invalid name: ${nameResult.error.message}`);
                return null;
            }

            return {
                ticker: tickerResult.data,
                name: nameResult.data,
            };

        } catch (error) {
            console.error('❌ Error parsing command:', error);
            return null;
        }
    }

    /**
     * Validate a pre-parsed command
     */
    validate(command: DeployCommand): boolean {
        const tickerValid = this.tickerSchema.safeParse(command.ticker).success;
        const nameValid = this.nameSchema.safeParse(command.name).success;
        return tickerValid && nameValid;
    }
}
