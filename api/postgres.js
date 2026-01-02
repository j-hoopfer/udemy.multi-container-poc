import { Pool } from "pg";
import { pgUser, pgHost, pgDatabase, pgPassword, pgPort } from "./keys.js";

const pgClient = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDatabase,
    password: pgPassword,
    port: pgPort,
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