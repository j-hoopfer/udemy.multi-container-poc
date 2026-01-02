import Hapi from "@hapi/hapi";
import { pgClient, ensurePostgresConnection } from "./postgres.js";
import { redisClient, ensureRedisConnection, redisPublisher } from "./redis.js";

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT || 8080,
        host: "0.0.0.0",
        routes: {
            cors: true,
        },
    });

    // Fetch health status
    server.route({
        method: "GET",
        path: "/health",
        handler: () => {
            console.log("ok");
            return { status: "healthy" };
        },
    });

    // Fetch all current values from Redis
    server.route({
        method: "GET",
        path: "/values/current",
        handler: async (req, h) => {
            try {
                const values = await redisClient.hgetall("values");
                return h.response({ values });
            } catch (err) {
                console.error("Error fetching values from Redis:", err);
                return h.response({ values: {} }).code(500);
            }
        },
    });

    // Fetch all values from Postgres
    server.route({
        method: "GET",
        path: "/values/all",
        handler: async (req, h) => {
            const values = await pgClient.query("SELECT number FROM values");
            return h.response(values.rows);
        },
    });

    server.route({
        method: "POST",
        path: "/values",
        handler: async (req, h) => {
            const index = req.payload.index;

            if (parseInt(index) > 40) {
                return h.response({ error: "Index too high" }).code(422);
            }

            // Store a placeholder in Redis
            await redisClient.hset("values", index, "Nothing yet!");

            // Publish a message to Redis
            await redisPublisher.publish("insert", index);

            // Store the index in Postgres
            await pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

            return h.response({ working: true });
        },
    });

    // Return a custom response with a 404 status code
    server.route({
        method: '*',
        path: '/{path*}',
        handler: async (req, h) => {
            const response = h.response('404 Error: The requested resource was not found.');
            response.code(404);
            return response;
        }
    });

    await server.start();
    console.log(`Server running at ${server.info.uri}`);
};

process.on("unhandledRejection", (err) => {
    console.error(err);
    process.exit(1);
});

const start = async () => {
    try {
        await ensurePostgresConnection();
        await ensureRedisConnection();
        await init();
    } catch (err) {
        console.error("Failed to start API due to dependency connectivity issues:", err.message || err);
        process.exit(1);
    }
};

start();