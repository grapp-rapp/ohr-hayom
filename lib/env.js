// Loads .env for local runs. Imported first by server.js so settings exist before other
// modules read them. On Vercel there is no .env file; settings come from the dashboard.
import { existsSync } from 'node:fs';

const file = new URL('../.env', import.meta.url);
if (existsSync(file)) process.loadEnvFile(file);
