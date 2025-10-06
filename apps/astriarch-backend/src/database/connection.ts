import mongoose from "mongoose";
import config from "config";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<void> {
  let connectionString = "";
  try {
    // Build connection string
    const username = process.env.MONGODB_USERNAME || config.get("mongodb.username");
    const password = process.env.MONGODB_PASSWORD || config.get("mongodb.password");
    const host = process.env.MONGODB_HOST || config.get("mongodb.host");
    const port = process.env.MONGODB_PORT || config.get("mongodb.port");
    const database = process.env.MONGODB_DATABASE || config.get("mongodb.gamedb_name");

    connectionString = process.env.MONGODB_CONNECTION_STRING || "";

    if (!connectionString) {
      const auth = username && password ? `${username}:${password}@` : "";
      connectionString = `mongodb://${auth}${host}:${port}/${database}`;
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

    logger.info(`Connected to MongoDB: ${database}`);

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
