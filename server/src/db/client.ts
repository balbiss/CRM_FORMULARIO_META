import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não configurada (veja server/.env)');

export const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });
