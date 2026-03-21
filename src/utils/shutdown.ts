import db from "../config/db";
import { logger } from "../config/logger";


// Handle graceful shutdown
export const gracefulShutdown = async () => {
  try {
    await db.$disconnect();
    logger.info("Database connection closed gracefully");
  } catch (err) {
    logger.error("Error closing database connection", err);
  }

 
 

  

  // Force exit after cleanup
  logger.info("Graceful shutdown complete");
  process.exit(0);
};
