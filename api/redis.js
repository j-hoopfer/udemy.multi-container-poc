import Redis from "ioredis";
import { redisHost, redisPort } from "./keys.js";

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 5;

const redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    tls: true,
    retryStrategy: () => RETRY_DELAY_MS,
});

redisClient.on("error", (err) => {
    const isNetworkError = ["ECONNREFUSED", "ENETUNREACH", "EAI_AGAIN"].includes(err?.code);
    console.error(`Redis client error${isNetworkError ? " (network)" : ""}:`, err?.message || err);
});

redisClient.on("reconnecting", (delay) => {
    console.warn(`Redis reconnecting in ${delay}ms...`);
});

const redisPublisher = redisClient.duplicate();

redisPublisher.on("error", (err) => {
    console.error("Redis publisher error:", err?.message || err);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureRedisConnection(retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await redisClient.ping();
            return;
        } catch (err) {
            const isNetworkError = ["ECONNREFUSED", "ENETUNREACH", "EAI_AGAIN"].includes(err?.code);
            console.error(
                `Redis connection attempt ${attempt}/${retries} failed${isNetworkError ? " (network)" : ""}: ${err?.message || err}`
            );

            if (attempt === retries) {
                throw err;
            }

            await sleep(RETRY_DELAY_MS);
        }
    }
}

export { redisClient, redisPublisher, ensureRedisConnection };