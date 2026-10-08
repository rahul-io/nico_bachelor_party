// Applies db/schema.sql to the database in DATABASE_URL. Idempotent.
// Usage: npm run db:setup   (reads .env.local if present)
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (vercel env pull .env.local) and retry.");
  process.exit(1);
}

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .replace(/^\s*--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(url);
for (const statement of statements) {
  await sql.query(statement);
  console.log(`ok  ${statement.split("\n")[0].slice(0, 70)}`);
}
console.log(`\nSchema applied (${statements.length} statements).`);
