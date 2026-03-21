import app from "./app";
import { startMirrorNodeIndexer } from "./jobs/mirrorNodePoller";
import { startContractLogIndexer } from "./jobs/contractLogPoller";
import redisClient from "./config/redis";
import prisma from "./config/db";

const port = Number(process.env.PORT ?? 5050);

const startServer = async () => {
  try {
    // 1. Verify Database Connection
    await prisma.$queryRaw`SELECT 1`;
    console.info("✅ PostgreSQL: Connected successfully");

    // 2. Verify Redis Connection
    try {
      await redisClient.connect();
      console.info("✅ Redis: Connected successfully");
    } catch (redisError: any) {
      console.error(`❌ Redis: Connection failed - ${redisError.message}`);
      console.info("💡 Hint: Ensure Redis is running on port 6380 (based on your .env)");
    }

    // 3. Start Express
    app.listen(port, () => {
      console.info("\n🚀 Server is running!");
      console.info(`📡 URL: http://localhost:${port}`);
      console.info(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
      console.info("--------------------------------------------------\n");
    });

    // 4. Start Background Jobs
    startMirrorNodeIndexer();
    startContractLogIndexer();
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
