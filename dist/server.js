"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const mirrorNodePoller_1 = require("./jobs/mirrorNodePoller");
const contractLogPoller_1 = require("./jobs/contractLogPoller");
const redis_1 = __importDefault(require("./config/redis"));
const db_1 = __importDefault(require("./config/db"));
const port = Number(process.env.PORT ?? 5050);
const startServer = async () => {
    try {
        // 1. Verify Database Connection
        await db_1.default.$queryRaw `SELECT 1`;
        console.info("✅ PostgreSQL: Connected successfully");
        // 2. Verify Redis Connection
        try {
            await redis_1.default.connect();
            console.info("✅ Redis: Connected successfully");
        }
        catch (redisError) {
            console.error(`❌ Redis: Connection failed - ${redisError.message}`);
            console.info("💡 Hint: Ensure Redis is running on port 6380 (based on your .env)");
        }
        // 3. Start Express
        app_1.default.listen(port, () => {
            console.info("\n🚀 Server is running!");
            console.info(`📡 URL: http://localhost:${port}`);
            console.info(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
            console.info("--------------------------------------------------\n");
        });
        // 4. Start Background Jobs
        (0, mirrorNodePoller_1.startMirrorNodeIndexer)();
        (0, contractLogPoller_1.startContractLogIndexer)();
    }
    catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
