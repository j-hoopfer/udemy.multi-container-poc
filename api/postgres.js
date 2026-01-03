import { Pool } from "pg";
import { pgUser, pgHost, pgDatabase, pgPassword, pgPort } from "./keys.js";

// Use SSL for RDS in production (most RDS instances require SSL). Allow override via PGSSL=disable for local/dev.
const sslOption = (() => {
    const envSetting = process.env.PGSSL?.toLowerCase();
    const isProd = process.env.NODE_ENV === "production";

    if (envSetting === "disable") return false; // explicitly disable
    if (envSetting === "require") return { rejectUnauthorized: false };

    return isProd ? { rejectUnauthorized: false } : false;
})();

const pgClient = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDatabase,
    password: pgPassword,
    port: pgPort,
    ssl: sslOption,
});

pgClient.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client", err);
    process.exit(-1);
});

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensurePostgresConnection(retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await pgClient.query("SELECT 1");
            await pgClient.query("CREATE TABLE IF NOT EXISTS values (number INT)");
            return;
        } catch (err) {
            const isNetworkError = ["ECONNREFUSED", "ENETUNREACH", "EAI_AGAIN"].includes(err.code);
            console.error(
                `Postgres connection attempt ${attempt}/${retries} failed${isNetworkError ? " (network)" : ""}: ${err.message}`
            );

            if (attempt === retries) {
                throw err;
            }

            await sleep(RETRY_DELAY_MS);
        }
    }
}

export { pgClient, ensurePostgresConnection };