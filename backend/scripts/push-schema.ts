import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pushSchema() {
    console.log('🚀 Starting database schema push...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is not defined in .env file');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        // Read schema.sql
        const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
        console.log(`📖 Reading schema from ${schemaPath}...`);

        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at ${schemaPath}`);
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('⚡ Executing schema...');
        await client.query(schemaSql);

        console.log('✅ Schema pushed successfully!');
    } catch (error) {
        console.error('❌ detailed error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

pushSchema();
