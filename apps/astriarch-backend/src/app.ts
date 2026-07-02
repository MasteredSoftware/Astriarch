import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";

import { connectDatabase } from "./database/connection";
import { getBackendConfig, validateBackendConfig } from "./config/environment";
import { WebSocketServer } from "./websocket";
import { healthRoutes } from "./routes/healthRoutes";
import { highScoreRoutes } from "./routes/highScoreRoutes";
import { testRoutes } from "./routes/testRoutes";
import { GameController } from "./controllers/GameControllerWebSocket";
import { logger } from "./utils/logger";

const app = express();

const backendConfig = getBackendConfig();

// Server configuration
const serverConfig = {
  host: backendConfig.server.host,
  port: backendConfig.server.port,
  wsPort: backendConfig.websocket.port,
  wsProtocol: backendConfig.websocket.protocol,
};

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow WebSocket connections
  }),
);

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: backendConfig.cors.origin,
  credentials: backendConfig.cors.credentials,
};
app.use(cors(corsOptions));

// Logging
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parsing
const cookieSecret = backendConfig.cookie.secret;
app.use(cookieParser(cookieSecret));

function buildSessionMongoUrl(): string {
  if (backendConfig.mongodb.connectionString) {
    return backendConfig.mongodb.connectionString;
  }

  const auth =
    backendConfig.mongodb.username && backendConfig.mongodb.password
      ? `${backendConfig.mongodb.username}:${backendConfig.mongodb.password}@`
      : "";

  return `mongodb://${auth}${backendConfig.mongodb.host}:${backendConfig.mongodb.port}/${backendConfig.mongodb.sessionDbName}`;
}

// Session configuration
app.use(
  session({
    secret: cookieSecret,
    store: MongoStore.create({
      mongoUrl: buildSessionMongoUrl(),
      touchAfter: 24 * 3600, // lazy session update
    }),
    resave: false,
    saveUninitialized: true, // Changed to true to force session creation
    cookie: {
      maxAge: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Add httpOnly for security
    },
  }),
);

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/highscores", highScoreRoutes);

// Test-only routes — only registered in test environment.
if (process.env.NODE_ENV === "test") {
  app.use("/api/test", testRoutes);
  logger.info("Test routes registered (NODE_ENV=test)");
}

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Express error:", err);
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// Start server
async function startServer() {
  try {
    // Validate env-backed configuration before startup side-effects.
    validateBackendConfig();

    // Connect to database
    await connectDatabase();

    // Create HTTP server
    const server = http.createServer(app);

    // Setup WebSocket server
    const wss = new WebSocketServer(server);

    // Initialize game controller cleanup tasks
    GameController.startGameCleanup();

    // Start listening
    server.listen(serverConfig.port, () => {
      logger.info(`Astriarch Backend Server listening at: ${serverConfig.host}:${serverConfig.port}`);
      logger.info(
        `WebSocket server running on: ${serverConfig.wsProtocol}://${serverConfig.host}:${serverConfig.wsPort}`,
      );
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, shutting down gracefully");
      server.close(() => {
        logger.info("Process terminated");
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();
