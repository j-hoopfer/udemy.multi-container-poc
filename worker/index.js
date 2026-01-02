import { redisClient, sub, ensureRedisConnection } from "./redis.js";

function fib(n) {
  if (n < 2) {
    return 1;
  }
  
  return fib(n - 1) + fib(n - 2);
}

const start = async () => {
  try {
    await ensureRedisConnection();

    sub.on("message", async (_channel, message) => {
      redisClient.hset("values", message, fib(parseInt(message, 10)));
    });

    await sub.subscribe("insert");

    console.log("Worker listening for fibonacci calculations...");
  } catch (err) {
    console.error("Worker failed to start due to redis connectivity issues:", err?.message || err);
    process.exit(1);
  }
};

start();