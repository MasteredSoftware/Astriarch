import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import config from "config";

import { connectDatabase } from "./database/connection";
import { WebSocketServer } from "./websocket";
import { healthRoutes } from "./routes/healthRoutes";
import { GameController } from "./controllers/GameControllerWebSocket";
import { logger } from "./utils/logger";

const app = express();

// Server configuration
const serverConfig = {
  host: process.env.HOST || config.get("server.host") || "localhost",
  port: process.env.PORT || config.get("server.port") || 8001,
  wsPort: process.env.WS_PORT || config.get("websocket.port") || 8001,
  wsProtocol: process.env.WS_PROTOCOL || config.get("websocket.protocol") || "ws",
};

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow WebSocket connections
  }),
);

// CORS configuration
const baseCorsOptions = config.get("cors") as cors.CorsOptions;
const allowedOrigins = (process.env.CORS_ORIGIN_LIST || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin);

// Create a new CORS options object without mutating the config
const corsOptions: cors.CorsOptions = {
  ...baseCorsOptions,
  ...(allowedOrigins.length > 0 && { origin: allowedOrigins }),
};
app.use(cors(corsOptions));

// Logging
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cookie parsing
const cookieSecret = process.env.COOKIE_SECRET || (config.get("cookie.secret") as string);
app.use(cookieParser(cookieSecret));

// Session configuration
app.use(
  session({
    secret: cookieSecret,
    store: MongoStore.create({
      mongoUrl:
        process.env.MONGODB_CONNECTION_STRING ||
        `mongodb://${config.get("mongodb.host")}:${config.get("mongodb.port")}/${config.get("mongodb.sessiondb_name")}`,
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

// Routes - Only health check needed, everything else goes through WebSocket
app.use("/api/health", healthRoutes);

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
