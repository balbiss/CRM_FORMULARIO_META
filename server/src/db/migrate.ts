import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não configurada (veja server/.env)');

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations aplicadas com sucesso.');
await sql.end();
