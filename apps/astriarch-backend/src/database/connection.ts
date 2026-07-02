import mongoose from "mongoose";
import { getBackendConfig } from "../config/environment";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<void> {
  let connectionString = "";
  try {
    const backendConfig = getBackendConfig();

    // Build connection string
    const { username, password, host, port, gameDbName } = backendConfig.mongodb;

    connectionString = backendConfig.mongodb.connectionString || "";

    if (!connectionString) {
      const auth = username && password ? `${username}:${password}@` : "";
      connectionString = `mongodb://${auth}${host}:${port}/${gameDbName}`;
    }

    logger.info(
      `Attempting to connect to MongoDB with connection string: ${connectionString.replace(/\/\/.*:.*@/, "//***:***@")}`,
    );

    // MongoDB connection options
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(connectionString, options);

    logger.info(`Connected to MongoDB: ${gameDbName}`);

    // Connection event handlers
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      connectionString: connectionString.replace(/\/\/.*:.*@/, "//***:***@"),
    });
    throw error;
  }
}

export function disconnectDatabase(): Promise<void> {
  return mongoose.disconnect();
}
