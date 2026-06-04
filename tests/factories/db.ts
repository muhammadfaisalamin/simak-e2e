import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

/**
 * Shared pg connection pool for all data factories.
 * One pool per test worker process — Node.js cleans up connections on exit.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
