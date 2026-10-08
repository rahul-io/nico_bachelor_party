// Starts the dev server on in-memory mock data, ignoring the live credentials in .env.local.
// Use this for anything that creates test profiles, posts or comments: npm run dev:mock
import { spawn } from "node:child_process";

const env = { ...process.env };
// Next only fills in variables that aren't already set, so empty values win over .env.local.
for (const key of ["DATABASE_URL", "POSTGRES_URL", "BLOB_READ_WRITE_TOKEN", "ADMIN_PASSWORD", "SESSION_SECRET", "INVITE_CODE"]) {
  env[key] = "";
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});
child.on("exit", (code) => process.exit(code ?? 0));
